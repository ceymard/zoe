/**
 * Note: This grammar is purposefully much more permissive than what the language really allows.
 *       The type checker will enforce what is valid or not ; we just don't want to choke on
 *       "grammar" errors that can be easily detected in the parse tree so that we can
 *       output several errors at once.
 */

import * as fs from 'fs'
import * as pth from 'path'
import * as ch from 'chalk'
import { inspect } from 'util'

import { Tokenizer, escape, SeparatedBy, Opt, Seq, Either, Forward, S, Rule, Repeat, Operator, Str, Res, NoMatch, Token, setDebug } from 'parseur'
import * as ast from './ast'
declare module 'parseur' {
  interface Token {
    [inspect.custom]: () => any
  }
}

setDebug()


Token.prototype[inspect.custom] = function () {
    // return { value: this.match , token: this.def._name }
    return `${ch.grey('TK:')}${ch.grey(this.def._name + ':')}${ch.green(this.str)}`
}

const mkbinop = ast.BinOpExpression.fromParse
const mkunary = ast.UnaryExpression.fromParse


export class ZoeParser extends Tokenizer {

  CTRL = this.token(new RegExp('(?:' + [
    '=>', '==', '=',
    '...', '.',
    '::',
    ',',
    ':',
    '>=', '>',
    '<=', '<',
    '->', '-=', '--', '-',
    '++', '+=', '+',
    '%=', '%',
    '/=', '/',
    '*=', '*',
    '&=', '&', '|=', '|', '^=', '^',
    '[', ']', '{', '}', '(', ')',
    '@',
    'and', 'or', 'in', 'is',
    'type', 'union', 'struct', 'enum', 'function',
    'true', 'false', 'void', 'null', 'stub'
  ].map(t => escape(t)).join('|') + ')(?=\\b|[^\w]|$)'))
  // Now follow those that can vary.
  STR = this.token(/(["'])(\\\1|(?!\1)[^])*\1/)
  ID = this.token(/[a-zA-Z$][\w$]*/)
  NUM = this.token(/(0b|0o|0x)?\d[\d_]*(\.[\d_]+)?/i)
  DOC = this.token(/([\n\s\r\t ]*#\?([^\n]*))+|#\(\?((?!#\))[^])*#\)/).skip() // Skip it generally, except when we will need them
  WS = this.token(/(?:[\t\n\s ]|#\((?!\?)((?!)#\)[^])*#\)|#(?!\?)[^\n]*)+/).skip() // Whitespace !


  // FIXME set range !
  Id = this.ID.map(r => new ast.Id()
    .set('value', r.str)
  )


  NamespacedIdentifier = SeparatedBy(S`::`, this.Id)
    .map(r => new ast.NamespacedId(r))


  //   Operator.UnaryRight(),
  //   Str('@') // for trait access !
  //   Str('.'),
  //   Str('*', '/'),
  //   Str('+', '-'),
  //   Str('<<', '>>'),
  //   Str('&', '|', '^'),
  //   Str('<', '<=', '>', '>=', '==', '!='),
  //   Str('and', 'or'),
  //   Operator.UnaryLeft(Str('not')),
  //   Operator.AssocRight(Str('=', '&=', '|=', '^=', '+=', '-=', '/=', '*='))
  // )

  Expression: Rule<ast.Expression> = Operator(
      Forward(() => this.TerminalExpression)
    )
    .prefix(10, Str('return'), mkunary)
    // @ is both unary and binary !
    .binary(90, Str('@'), mkbinop)
    .binary(90, Str('.'), mkbinop)
    .suffix(80, Forward(() => Either(this.FunctionCallExpression, this.TemplateCallExpression, this.ArrayAccess, this.SliceAccess)),
      mkunary
    )
    .binary(70, Str('.'), mkbinop)
    .binary(60, Str('*', '/'), mkbinop)
    .binary(50, Str('+', '-'), mkbinop)

  FunctionCallExpression = S`( ${SeparatedBy(S`,`, this.Expression, { trailing: true })} )`
    .map(args => new ast.FunctionCall(args))

  TemplateCallExpression = S`< ${SeparatedBy(S`,`, this.Expression, { trailing: true })} ) >`
    .map(args => new ast.TemplateCall(args))

  ArrayAccess = S`[ ${Opt(this.Expression)} ]`
    .map(expr => new ast.ArrayAccess(expr))

  SliceAccess = S`[ ${Opt(this.Expression)} : ${Opt(this.Expression)} ]`
    .map(([start, end]) => new ast.SliceAccess()
      .set('start', start)
      .set('end', end)
    )


  TerminalExpression: Rule<ast.Expression> = Either(
    S`( ${this.Expression} )`,
    this.NUM.map(s => new ast.NumberExpression(s.str)),
    Forward(() => this.Block),
    Forward(() => this.IfExpression),
    this.NamespacedIdentifier,
    this.STR.map(s => new ast.StringExpression(s.str)),
    Either(
      S`void`,
      S`true`,
      S`false`,
      S`null`,
      S`stub`
    ).map(r => new ast.KeywordExpression(r as any)), // FIXME range !
  )

  VariableAssignmentExpression = Seq(
    { specifier:    Str('let', 'const') },
    { identifier:   this.NamespacedIdentifier },
    { typeref:      Opt(Forward(() => this.TypeIdentifier)) },
                    S`=`,
    { value:        this.Expression }
  )


  ArrowExpression = S`=> ${this.Expression}`

  // A block is a sequence of expressions optionally separated by semicolons.
  Block = S`{ ${SeparatedBy(Repeat(Str(';')), this.Expression, { trailing: true, leading: true })} }`
  .map(r => new ast.Block()
    .set('expressions', r)
  )

  // Used by both if statements or function definitions
  BlockOrArrow = Either(this.Block, this.ArrowExpression)

  IfExpression = Seq(
                    S`if`,
    { condition:    this.Expression },
    { instruction:  this.BlockOrArrow },
                // { elifs:      Repeat(S`elif ${this.IfThenArm}`) },
    { else:         Opt(S`else ${Either(this.Block, this.Expression)}`) }
  ).map(r => new ast.IfExpression(r.condition, r.instruction, r.else))


  ReturnExpression = Seq(
                S`return`,
    { expression: this.Expression }
  )


  TypeNameWithTypeParameters = Seq({
    name:     this.NamespacedIdentifier,
    arguments:  SeparatedBy(S`,`, Forward(() => this.TypeArguments))
  })

  TraitIdentifier: Rule<any> = Seq(
              S`@`,
    { name:      this.NamespacedIdentifier },
    { arguments: Forward(() => this.TypeArguments) }
  )

  TypeIdentifier = Seq(
    { name:         this.NamespacedIdentifier },
    { arguments:    Opt(Forward(() => this.TypeArguments)) },
    { traits:       Opt(Repeat(this.TraitIdentifier)) },
  )

  TypeArguments = S`< ${SeparatedBy(S`,`, this.Expression)} >`


  DefaultValue = S`= ${this.Expression}`


  // VARIABLE DECLARATIONS

  VariableDefinition = Seq(
    { identifier:     this.Id },
    { type:           Opt(S`: ${this.Expression}`) },
    { default:        Opt(this.DefaultValue) }
  ).map(r => new ast.VariableDefinition()
    .set('name', r.identifier)
    .set('typ', r.type)
    .set('def', r.default)
  )


  // FUNCTION DECLARATIONS

  FunctionDefinitionArgument = Seq(
    { dotted:         Opt(S`...`) },
    { decl:           this.VariableDefinition }
  ).map(r => r.decl
    .set('dotted', !!r.dotted)
  )

  FunctionSignature = Seq(
    { type_args:    Opt(this.TypeArguments) },
                  S`(`,
    { args:         Opt(SeparatedBy(S`,`, this.FunctionDefinitionArgument, { trailing: true })) },
                  S`) ->`,
    { result:     this.Expression },
  ).map(r => new ast.FunctionDefinition()
    .set('type_args', r.type_args)
    .set('args', r.args)
    .set('return_type', r.result)
  )

  NamedFunctionSignature = Seq({
    name: this.NamespacedIdentifier,
    signature: this.FunctionSignature
  }).map(r => r.signature
    .set('name', r.name)
  )

  MethodDeclaration = Seq(
    { signature:  this.NamedFunctionSignature },
    { definition: this.BlockOrArrow }
  ).map(r => r.signature
    .set('definition', r.definition)
  )

  FunctionDeclaration = S`function ${this.MethodDeclaration}`


  // TYPES

  StructDefinition = Seq(
              S`struct (`,
    { fields:   SeparatedBy(Opt(Str(',')), this.VariableDefinition, { trailing: true }) },
              S`)`,
  )

  UnionDefinition = SeparatedBy(Str('|'), Either(this.TypeIdentifier, this.TraitIdentifier), { leading: true })

  TypeDeclaration = Seq(
                Str('type'),
    { name:     this.Id },
                Str('='),
    { def:      Either(this.StructDefinition, this.UnionDefinition) },
  )

  // TRAIT

  TraitName = S`@ ${this.Id}`

  TraitDeclaration = Seq(
    { name:       this.TraitName },
    { fields:     SeparatedBy(S`,`, Either(
                      this.VariableDefinition,
                      this.NamedFunctionSignature
    ))}
  )


  // NAMESPACE DECLARATION

  NamespaceDeclaration = Seq(
    { name: S`namespace ${this.NamespacedIdentifier} (` },
      { declarations: Forward(() => this.Declarations) },
    S`)`
  )

  // IMPLEMENTATIONS

  ImplementDeclaration = Seq(
              Str('implement'),
    { type:   this.NamespacedIdentifier },
    { trait:  Opt(this.TraitIdentifier) },
    { decls:  S`( ${Repeat(this.MethodDeclaration)} )` }
  )

  // IMPORTS STATEMENT

  ImportAs = S`as ${this.Id}`

  ImportIdentifiers = S`( ${SeparatedBy(S`,`, Either(this.Id, this.TraitName), { trailing: true })} )`

  ImportStatementStart = S`import ${this.STR}`

  ImportStatement = Seq(
    { module:     this.ImportStatementStart },
    { import:     Either(this.ImportAs, this.ImportIdentifiers) }
  )


  // DECLARATION

  Declaration = Either(
    this.ImportStatement,
    this.NamespaceDeclaration,
    this.TraitDeclaration,
    // StructDeclaration,
    this.FunctionDeclaration,
    this.VariableAssignmentExpression,
    this.TypeDeclaration,
    this.ImplementDeclaration,
    // MISSING Constant declaration
  )


  // TOPLEVEL Declarations
  // FIXME: needs some way of failing if a declaration failed.

  Declarations: Rule<any> = Repeat(this.Declaration)

  parse(input: string) {
    var tokens = this.tokenize(input, { enable_line_counts: true, forget_skips: true })
    Res.max_res = null
    // console.log('??')
    if (tokens) {
      var res = parser.Declarations.parse(tokens, 0)

      var failed = true
      if (res !== NoMatch) {
        var pos = res.pos
        var _tk: Token | undefined
        while ((_tk = tokens[pos], _tk && _tk.is_skip)) { pos++ }
        failed = !!_tk
      }

      if (res === NoMatch || failed) {
        // console.log('Match failed')
        return { status: 'nok', max_res: Res.max_res, tokens }
        // console.log(Res.max_res)
      } else {
        return { status: 'ok', result: res.res }
        // console.log(inspect(res.res, {depth: null}))
      }
    }
    return { status: 'nok' }
  }

  constructor() {
    super()
    this.nameRules()
  }

  testAll(filter?: string) {
    const testpth = pth.join(__dirname, '../tests/parsing')
    var files = fs.readdirSync(testpth, {encoding: 'utf-8' })

    if (filter) {
      var flt = new RegExp(filter, 'i')
      files = files.filter(f => f.match(flt))
    }

    for (var f of files) {
      const path = pth.join(testpth, f)
      const basename = pth.basename(path)
      const contents = fs.readFileSync(path, 'utf-8')
      var res = this.parse(contents)

      if (res.status === 'ok') {
        console.log(`  ${ch.green('✓')} ${basename}`)
        if (filter) {
          console.log(inspect(res.result, { depth: null, colors: true }))
        }
      } else {
        console.log(`  ${ch.bold.redBright('⛌')} ${basename}`)
        if (res.tokens) console.log(res.tokens.map((tok, i) => { return {tok, i}})
          .filter(t => !!t.tok.str.trim())
          .map(t => `${ch.grey(`${t.tok.def._name}:${t.i} `)}${ch.greenBright(t.tok.str)} `)
          .join(' ')
        )
        if (res.max_res) {
          console.log(inspect(res.max_res, { depth: null, colors: true }))
        }
        break
      }
    }

    // console.log(files)
  }

}


export function parse() {

}

if (process.mainModule === module) {
  var parser = new ZoeParser()
  parser.testAll(process.argv[2])

  // parser.parse(fs.readFileSync(process.argv[2], 'utf-8'))
}
