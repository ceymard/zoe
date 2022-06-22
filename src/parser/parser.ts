import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver"
import * as ast from "parser/ast"
import * as tk from "./tokens"
import { Scope } from "./ast/scope"

function char(str: string) { return str.charCodeAt(0) }

const PART_OF_IDENT = 0b1110
const LETTER =    0b1100
const UPPERCASE = 0b1000
const LOWERCASE = 0b0100
const DIGIT =     0b0010
const SPACE =     0b0001

const charmap = define_keywords(tk.keywords)


export class Parser {
  offset = -1
  line = 0
  last_line_offset = 0
  start = -1
  start_line = -1
  start_col = -1
  length = 0

  updateStart() {
    this.start = this.offset
    this.start_line = this.line
    this.start_col = this.offset - this.last_line_offset
  }

  diagnostics: Diagnostic[] = []

  inside_string_interpolate = 0

  constructor(public source: string) { this.length = this.source.length }

  rewound = false
  last!: tk.Token
  rewind() {
    this.rewound = true
  }

  consume<T extends tk.Token>(t: new (...a: any) => T): T | null {
    const nxt = this.next()
    if (nxt.is(t)) {
      return nxt
    }
    this.rewind()
    return null
  }

  expect<T extends tk.Token>(t: new (...a: any) => T): T | null {
    const r = this.consume(t)
    if (!r) {
      this.reportError(this.last.range, `unexpected ${this.last.repr()}, expected ${t.name}`)
    }
    return r
  }

  expectIdent(): ast.Ident {
    const id = this.next()
    if (id.is(tk.Ident)) {
      return id.toAstIdent()
    }
    this.reportError(id.range, "expected an identifier")
    this.rewind()
    return new ast.Ident(id.range, "--bogus-ident--")
    // Maybe we shouldn't expect that ?
  }

  next() {
    if (this.rewound) {
      this.rewound = false
      return this.last
    }
    this.last = this._next()
    return this.last
  }

  parseAll(): Scope {
    const scope = new Scope()
    while (!this.last || !this.last.isEof()) {
      const tk = this.next()
      tk.parseTopLevel(this, scope)
    }
    // console.log(res)
    return scope
  }

  expression(rbp: number): ast.Node {
    let tk = this.next()
    if (tk.isEof()) return tk._unexpected(this)
    let left = tk.nud(this)

    do {
      tk = this.next()
      if (rbp >= tk.LBP || tk.isEof()) {
        this.rewind()
        break
      }
      left = tk.led(this, left)
    } while (true)
    return left
  }

  reportError(rng: Range, message: string) {
    this.diagnostics.push({
      range: rng,
      message: message,
      severity: DiagnosticSeverity.Error,
    })
  }

  newline() {
    this.last_line_offset = this.offset + 1
    this.line++
  }

  hasMore() {
    return this.offset < this.length - 1
  }

  unexpected(): tk.Token {
    const r = new tk.Unexpected(this)
    this.reportError(r, `unexpected '${r.value}'`)
    return r
  }

  isEof() {
    return this.offset >= this.length
  }

  try(code: number) {
    if (this.offset < this.length - 1 && this.source.charCodeAt(this.offset + 1) === code) {
      this.offset++
      return code
    }
  }

  handleLineComment(): tk.Token | null {
    let is_pragma = (this.source.charCodeAt(this.offset + 1) === C.exclamation_mark)
    do {
      this.offset++
      if (this.isEof()) break
      const ch = this.source.charCodeAt(this.offset)
      if (ch === C.linefeed) {
        // \n is part of the line comment
        this.newline()
        break
      }
    } while (true)
    return !is_pragma ? null : new tk.Pragma(this)
  }

  handleMultilineComment(): tk.Token | null {
    const is_doc_comment = this.source.charCodeAt(this.offset + 1) === C.question_mark
    do {
      this.offset++
      if (this.isEof()) {
        // FIXME: report an error !
        return this.unexpected()
      }
      const ch = this.source.charCodeAt(this.offset)

      if (ch === C.asterisk && this.try(C.solidus)) {
        break
      } else if (ch === C.linefeed) {
        this.newline()
      }

    } while (true)
    if (is_doc_comment) return new tk.DocComment(this)
    return null
  }

  handleString(start: number): tk.Token {
    do {
      if (this.isEof()) {
        // probably report error
        this.offset--
        return new tk.Eof(this)
      }
      const ch = this.source.charCodeAt(++this.offset)
      if (ch === C.reverse_solidus) {
        this.offset++
        continue
      } else if (ch === C.left_curly_bracket) {
        this.inside_string_interpolate += 1
        break
      } else if (ch === C.quotation_mark) {
        break
      } else if (ch === C.linefeed) {
        this.newline()
        continue
      }
      if (this.isEof()) {
        this.offset--
        // REPORT WRONG EOF ?
        // return new tk
        break
      }

    } while (true)
    if (this.inside_string_interpolate > 0) {
      return new tk.StringPart(this)
    } else if (start === C.right_curly_bracket) {
      return new tk.StringEnd(this)
    } else {
      return new tk.String(this)
    }
  }

  handleNumber(): tk.Token {
    const ch = this.source.charCodeAt(this.offset)
    const starts_with_zero = ch == C.zero
    let nb = 0
    let dot_found = false
    let accept_hexa = false
    let only_binary = false
    let only_octal = false
    do {
      nb++
      const ch2 = this.source.charCodeAt(++this.offset)

      if (starts_with_zero && nb === 1) {
        if (ch2 === C.small_x) {
          accept_hexa = true
          continue
        } else if (ch2 === C.small_b) {
          only_binary = true
          continue
        } else if (ch2 === C.small_o) {
          only_octal = true
          continue
        }
      }

      if (accept_hexa) {
        switch (ch2) {
          case C.small_a:
          case C.small_b:
          case C.small_c:
          case C.small_d:
          case C.small_e:
          case C.small_f:
            continue
        }
      }

      if (ch2 === C.low_line) {
        continue
      } else if (ch2 === C.full_stop && !dot_found) {
        dot_found = true
        continue
      } else if (!(c[ch2] & DIGIT) || only_octal && ch2 >= C.eight || only_binary && ch2 >= C.two) {
        this.offset--
        break
      }
    } while (true)

    return new tk.Number(this)
  }

  handleIdent(kind: number | null): tk.Token {
    const src = this.source
    // we do not advance the offset here, because we want to know what kind of char we've landed on
    const ch = src.charCodeAt(this.offset)
    const upper = c[ch] & UPPERCASE
    let _mp: CharMap | undefined = charmap.get(ch) as CharMap | undefined
    do {
      const ch = src.charCodeAt(++this.offset)
      if (!(c[ch] & PART_OF_IDENT)) {
        this.offset-- //
        const k = _mp?.get(0)
        if (k) {
          return new (k as new (...a: any[]) => tk.Token)(this)
        } else {
          break
        }
      }
      if (_mp) _mp = _mp.get(ch) as CharMap | undefined
      // this is where we should check if we have a keyword, one way or another
    } while (true)

    if (kind === C.dollar_sign) {
      return upper ? new tk.ComptimeTypeIdent(this) : new tk.ComptimeIdent(this)
    } else if (kind === C.number_sign) {
      return upper ? new tk.StructTraitIdent(this) : new tk.TraitIdent(this)
    }
    return upper ? new tk.TypeIdent(this) : new tk.Ident(this)
  }

  _next(): tk.Token {
    let src = this.source
    let len = this.source.length

    do {
      this.offset++
      this.updateStart()
      if (this.offset >= len) return new tk.Eof(this)

      const ch = char(src[this.offset])

      // simple cases with known symbols
      switch (ch) {

        case C.asterisk:
          if (this.try(C.equals_sign))
            return new tk.MulAssign(this)
          return new tk.Mul(this)

        // =
        case C.equals_sign: {
          if (this.try(C.equals_sign)) {
            // ==
            return new tk.Eq(this)
          }
          // =
          return new tk.Assign(this)
        }

        case C.linefeed:
          // \n
          this.newline()
          continue

        case C.exclamation_mark: {
          const ch2 = this.source.charCodeAt(++this.offset)
          if (ch2 === C.equals_sign) {
            return new tk.Neq(this)
          }
          this.offset--
          return new tk.Not(this)
        }

        case C.percent_sign:
          return new tk.Mod(this)

        case C.ampersand: {
          const ch2 = this.source.charCodeAt(++this.offset)
          if (ch2 === C.ampersand) {
            // ||
            return new tk.And(this)
          }
          this.offset--
          return new tk.BitAnd(this)
        }

        case C.vertical_line: {
          const ch2 = this.source.charCodeAt(++this.offset)
          if (ch2 === C.vertical_line) {
            // ||
            return new tk.Or(this)
          }
          this.offset--
          return new tk.BitOr(this)
        }

        case C.hyphen_minus: {
          const ch2 = this.source.charCodeAt(++this.offset)
          if (ch2 === C.hyphen_minus) {
            // --
            return new tk.MinusMinus(this)
          } else if (ch2 === C.equals_sign) {
            // -=
            return new tk.MinusAssign(this)
          } else if (ch2 === C.greater_than_sign) {
            // ->
            return new tk.Arrow(this)
          }
          this.offset--
          return new tk.Minus(this)
        }
        case C.plus_sign: {
          const ch2 = this.source.charCodeAt(++this.offset)
          if (ch2 === C.plus_sign) {
            // ++
            return new tk.PlusPlus(this)
          } else if (ch2 === C.equals_sign) {
            // +=
            return new tk.PlusAssign(this)
          }
          this.offset--
          return new tk.Plus(this)
        }
        // >
        case C.greater_than_sign: {
          if (this.hasMore()) {
            this.offset++
            const ch2 = this.source.charCodeAt(this.offset)
            if (ch2 === C.equals_sign) {
              // >=
              return new tk.Gte(this)
            } else if (ch2 === C.greater_than_sign) {
              // >>
              return new tk.BitShiftRight(this)
            } else {
              this.offset--
            }
          }
          return new tk.Gt(this)
        }
        // <
        case C.less_than_sign: {
          if (this.hasMore()) {
            this.offset++
            const ch2 = this.source.charCodeAt(this.offset)
            if (ch2 === C.equals_sign) {
              // <=
              return new tk.Lte(this)
            } else if (ch2 === C.less_than_sign) {
              // <<
              return new tk.BitShiftLeft(this)
            } else {
              this.offset--
            }
          }
          return new tk.Lt(this)
        }
        // /
        case C.solidus:
          if (this.hasMore()) {
            this.offset++
            const ch2 = this.source.charCodeAt(this.offset)
            if (ch2 === C.solidus) {
              // // line comment
              const res = this.handleLineComment()
              if (res != null) return res
              continue
            } else if (ch2 === C.asterisk) {
              // /* multi-line comment
              const res = this.handleMultilineComment()
              if (res != null) return res
              continue
            } else if (ch2 === C.equals_sign) {
              // /=
              return new tk.DivAssign(this)
            } else {
              this.offset--
            }
          }
          return new tk.Div(this)

        // #
        case C.dollar_sign:
        case C.number_sign:
          if (this.hasMore()) {
            this.offset++
            const ch2 = this.source.charCodeAt(this.offset)
            if (c[ch2] & LETTER)
              return this.handleIdent(ch)
            this.offset--
          }
          return ch === C.dollar_sign ? new tk.ComptimeIdent(this) : new tk.TraitIdent(this)

        // ;
        case C.semicolon:
          return new tk.SemiColon(this)

        case C.quotation_mark:
          return this.handleString(ch)

        // :
        case C.colon:
          // ::
          // if (this.try(C.colon))
          //   return new tk.DoubleColon(this)
          return new tk.Colon(this)

        // @
        case C.commercial_at:
          return new tk.At(this)

        // ,
        case C.comma:
          return new tk.Comma(this)

        // .
        case C.full_stop: {
          if (this.source.charCodeAt(this.offset + 1) === C.full_stop && this.source.charCodeAt(this.offset + 2) === C.full_stop) {
            this.offset += 2
            return new tk.Elipsis(this)
          }
          return new tk.Dot(this)
        }

        // [
        case C.left_square_bracket:
          return new tk.LBrace(this)

        // ]
        case C.right_square_bracket:
          return new tk.RBrace(this)

        // (
        case C.left_parenthesis:
          return new tk.LParen(this)

        // )
        case C.right_parenthesis:
          return new tk.RParen(this)

        // {
        case C.left_curly_bracket:
          if (this.inside_string_interpolate)
            this.inside_string_interpolate++
          return new tk.LBracket(this)

        // }
        case C.right_curly_bracket:
          if (this.inside_string_interpolate) {
            // decrease the count of bracket stack
            this.inside_string_interpolate--
            // if 0, it means this is the last one.
            if (this.inside_string_interpolate === 0) {
              // should probably indicate that this is the last string part
              return this.handleString(C.right_curly_bracket)
            }
          }
          return new tk.RBracket(this)
      }

      // If these weren't classical characters, start checking patterns
      if (c[ch] & SPACE) {
        // Space, just skip it.
        continue
      } else if (c[ch] & DIGIT) {
        // Number
        return this.handleNumber()
      } else if (c[ch] & LETTER) {
        // Small ident
        return this.handleIdent(null)
      } else {
        return this.unexpected()
      }

    } while (true)
  }
}


type CharMap = Map<number, CharMap | { new (...a: any): tk.Token, kw: string }>
function define_keywords(keywords: { new (...a: any): tk.Token, kw: string }[]) {
  keywords = keywords.sort((a, b) => a.kw < b.kw ? -1 : a.kw > b.kw ? 1 : 0)
  const mp: CharMap = new Map()
  for (let k of keywords) {
    let _mp = mp
    for (let i = 0; i < k.kw.length; i++) {
      const letter = k.kw.charCodeAt(i)
      if (i === k.kw.length - 1) {
        // last letter
        const nmp: CharMap = new Map()
        nmp.set(0, k) // 0 is the real key to retrieve it
        _mp.set(letter, nmp)
      } else {
        const nmp: CharMap = (_mp.get(letter) as CharMap) ?? new Map()
        _mp.set(letter, nmp)
        _mp = nmp
      }
    }
  }
  return mp
}


const c = new Uint8Array(34627)
function _(v: number, args: (number | [number, number])[]) { for (let a of args) {
  if (Array.isArray(a)) {
    const e = a[1]
    for (let i = a[0]; i <= e; i++) c[i] = v
  } else {
    c[a] = v
  }
}}

// spaces
_(1, [10,32,160,[8192,8202],8287])
// digits
_(2, [[48,57]])
// lowercase
_(4, [95, [97,122],[223,246],[249,255],259,263,267,271,275,279,283,287,291,295,299,303,307,[311,312],316,320,324,[328,329],333,337,341,345,349,353,357,361,365,369,373,378,[382,384],389,[396,397],405,[410,411],417,421,[426,427],432,438,442,[446,447],457,462,466,470,474,477,481,485,489,493,496,501,507,511,515,519,523,527,531,535,539,543,547,551,555,559,[563,569],[575,576],583,587,[591,659],[662,687],883,[891,893],[940,974],977,[982,983],987,991,995,999,1003,[1007,1011],1016,1020,[1073,1119],1123,1127,1131,1135,1139,1143,1147,1151,1163,1167,1171,1175,1179,1183,1187,1191,1195,1199,1203,1207,1211,1215,1220,1224,1228,1231,1235,1239,1243,1247,1251,1255,1259,1263,1267,1271,1275,1279,1283,1287,1291,1295,1299,1303,1307,1311,1315,1319,1323,1327,[1377,1416],[4305,4346],[4350,4351],[5113,5117],[7297,7304],[7425,7467],[7532,7543],[7546,7578],7683,7687,7691,7695,7699,7703,7707,7711,7715,7719,7723,7727,7731,7735,7739,7743,7747,7751,7755,7759,7763,7767,7771,7775,7779,7783,7787,7791,7795,7799,7803,7807,7811,7815,7819,7823,7827,[7830,7837],7841,7845,7849,7853,7857,7861,7865,7869,7873,7877,7881,7885,7889,7893,7897,7901,7905,7909,7913,7917,7921,7925,7929,7933,[7936,7943],[7953,7957],[7969,7975],[7985,7991],[8001,8005],[8017,8023],[8033,8039],[8049,8061],[8065,8071],[8081,8087],[8097,8103],[8113,8116],8119,[8130,8132],8135,[8145,8147],8151,[8161,8167],[8179,8180],8183,[8462,8463],8495,8505,8509,[8519,8521],8580,[11313,11359],[11365,11366],11370,11377,11380,[11383,11387],11395,11399,11403,11407,11411,11415,11419,11423,11427,11431,11435,11439,11443,11447,11451,11455,11459,11463,11467,11471,11475,11479,11483,11487,[11491,11492],11502,[11520,11557],11565,42563,42567,42571,42575,42579,42583,42587,42591,42595,42599,42603,42625,42629,42633,42637,42641,42645,42649,42787,42791,42795,[42799,42801],42805,42809,42813,42817,42821,42825,42829,42833,42837,42841,42845,42849,42853,42857,42861,[42865,42872],42876,42881,42885,42892,42897,[42900,42901],42905,42909,42913,42917,42921,42933,42937,42941,42945,42952,42961,42965,42969,43002,[43825,43866],[43873,43880],[43889,43967],[64257,64262],[64276,64279],[65346,65370],[66601,66639],[66777,66811],[66968,66977],[66980,66993],[66996,67001],67004,[68801,68850],[71873,71903],[93793,93823],[119835,119859],[119887,119892],[119895,119911],[119939,119963],[119991,119993],[119997,120003],[120006,120015],[120043,120067],[120095,120119],[120147,120171],[120199,120223],[120251,120275],[120303,120327],[120355,120379],[120407,120431],[120459,120485],[120515,120538],[120541,120545],[120573,120596],[120599,120603],[120631,120654],[120657,120661],[120689,120712],[120715,120719],[120747,120770],[120773,120777],[122624,122633],[122636,122654],[125219,125251]])
// uppercase
_(8, [[65,90],[193,214],[217,222],258,262,266,270,274,278,282,286,290,294,298,302,306,310,315,319,323,327,332,336,340,344,348,352,356,360,364,368,372,[376,377],381,386,[390,391],[394,395],[399,401],404,[407,408],413,416,420,423,428,431,[434,435],[439,440],452,458,463,467,471,475,480,484,488,492,497,[502,504],508,512,516,520,524,528,532,536,540,544,548,552,556,560,[570,571],574,[579,582],586,590,882,895,[904,906],[910,911],[914,929],[932,939],[978,980],986,990,994,998,1002,1006,1015,1018,[1022,1071],1122,1126,1130,1134,1138,1142,1146,1150,1162,1166,1170,1174,1178,1182,1186,1190,1194,1198,1202,1206,1210,1214,1217,1221,1225,1229,1234,1238,1242,1246,1250,1254,1258,1262,1266,1270,1274,1278,1282,1286,1290,1294,1298,1302,1306,1310,1314,1318,1322,1326,[1330,1366],[4257,4293],4301,[5025,5109],[7313,7354],[7358,7359],7682,7686,7690,7694,7698,7702,7706,7710,7714,7718,7722,7726,7730,7734,7738,7742,7746,7750,7754,7758,7762,7766,7770,7774,7778,7782,7786,7790,7794,7798,7802,7806,7810,7814,7818,7822,7826,7838,7842,7846,7850,7854,7858,7862,7866,7870,7874,7878,7882,7886,7890,7894,7898,7902,7906,7910,7914,7918,7922,7926,7930,7934,[7945,7951],[7961,7965],[7977,7983],[7993,7999],[8009,8013],8027,8031,[8041,8047],[8121,8123],[8137,8139],[8153,8155],[8169,8172],[8185,8187],8455,[8460,8461],[8465,8466],[8473,8477],8486,[8490,8493],[8497,8499],8511,8579,[11265,11311],[11362,11364],11369,[11373,11376],11381,[11391,11392],11396,11400,11404,11408,11412,11416,11420,11424,11428,11432,11436,11440,11444,11448,11452,11456,11460,11464,11468,11472,11476,11480,11484,11488,11499,11506,42562,42566,42570,42574,42578,42582,42586,42590,42594,42598,42602,42624,42628,42632,42636,42640,42644,42648,42786,42790,42794,42798,42804,42808,42812,42816,42820,42824,42828,42832,42836,42840,42844,42848,42852,42856,42860,42873,[42877,42878],42882,42886,42893,42898,42904,42908,42912,42916,42920,[42923,42926],[42929,42932],42936,42940,42944,[42948,42951],42960,42968,[65313,65338],[66561,66599],[66737,66771],[66929,66938],[66941,66954],[66957,66962],66965,[68737,68786],[71841,71871],[93761,93791],[119809,119833],[119861,119885],[119913,119937],[119966,119967],[119973,119974],[119978,119980],[119983,119989],[120017,120041],120069,[120072,120074],[120078,120084],[120087,120092],120121,[120124,120126],[120129,120132],[120138,120144],[120173,120197],[120225,120249],[120277,120301],[120329,120353],[120381,120405],[120433,120457],[120489,120512],[120547,120570],[120605,120628],[120663,120686],[120721,120744],[125184,125217]])

const enum C {
  /** ? */ question_mark = 63,
  /** . */ full_stop = 46,
  /** = */ equals_sign = 61,
  /** ! */ exclamation_mark = 33,
  /** + */ plus_sign = 43,
  /** - */ hyphen_minus = 45,
  /** / */ solidus = 47,
  /** % */ percent_sign = 37,
  /** * */ asterisk = 42,
  /** @ */ commercial_at = 64,
  /** # */ number_sign = 35,
  /** $ */ dollar_sign = 36,
  /** ; */ semicolon = 59,
  /** , */ comma = 44,
  /** : */ colon = 58,
  /** \ */ reverse_solidus = 92,
  /** | */ vertical_line = 124,
  /** & */ ampersand = 38,
  /** ^ */ circumflex_accent = 94,
  /** ~ */ tilde = 126,
  /** " */ quotation_mark = 34,
  /** ' */ apostrophe = 39,
  /** ` */ grave_accent = 96,
  /** ( */ left_parenthesis = 40,
  /** ) */ right_parenthesis = 41,
  /** [ */ left_square_bracket = 91,
  /** ] */ right_square_bracket = 93,
  /** { */ left_curly_bracket = 123,
  /** } */ right_curly_bracket = 125,
  /** < */ less_than_sign = 60,
  /** > */ greater_than_sign = 62,
  /** _ */ low_line = 95,
  /** 0 */ zero = 48,
  /** 1 */ one = 49,
  /** 2 */ two = 50,
  /** 3 */ three = 51,
  /** 4 */ four = 52,
  /** 5 */ five = 53,
  /** 6 */ six = 54,
  /** 7 */ seven = 55,
  /** 8 */ eight = 56,
  /** 9 */ nine = 57,
  /** a */ small_a = 97,
  /** b */ small_b = 98,
  /** c */ small_c = 99,
  /** d */ small_d = 100,
  /** e */ small_e = 101,
  /** f */ small_f = 102,
  /** g */ small_g = 103,
  /** h */ small_h = 104,
  /** i */ small_i = 105,
  /** j */ small_j = 106,
  /** k */ small_k = 107,
  /** l */ small_l = 108,
  /** m */ small_m = 109,
  /** n */ small_n = 110,
  /** o */ small_o = 111,
  /** p */ small_p = 112,
  /** q */ small_q = 113,
  /** r */ small_r = 114,
  /** s */ small_s = 115,
  /** t */ small_t = 116,
  /** u */ small_u = 117,
  /** v */ small_v = 118,
  /** w */ small_w = 119,
  /** x */ small_x = 120,
  /** y */ small_y = 121,
  /** z */ small_z = 122,
  /** \n */ linefeed = 10,
}
