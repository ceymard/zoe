/**
 * Note: This grammar is purposefully much more permissive than what the language really allows.
 *       The type checker will enforce what is valid or not ; we just don't want to choke on
 *       "grammar" errors that can be easily detected in the parse tree so that we can
 *       output several errors at once.
 */

import { Tokenizer, escape, SeparatedBy, Opt, Seq, Either, Forward, S, Rule, Repeat, Operator, Str, Res, NoMatch, Token } from 'parseur'
import * as ast from './ast'
declare module 'parseur' {
  interface Rule<T> {
    node<N extends ast.Node>(fn: (res: T) => N): Rule<N>
  }
}

Rule.prototype.node = function <N extends ast.Node, T>(this: Rule<T>, fn: (res: T) => N): Rule<N> {
  return this.map((res, input, pos, start) => {
    var r = fn(res)
    // FIXME compute _range here
    return r
  })
}

const tk = new Tokenizer()

const T = {
  // Big, fat regexp for fixed length tokens
  OP_KW: tk.token(new RegExp('(?:' + [
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
  ].map(t => escape(t)).join('|') + ')(?=\\b|[^\w])')).name('Control'),
  // Now follow those that can vary.
  STR: tk.token(/(["'])(\\\1|(?!\1)[^])*\1/).name('String'),
  ID: tk.token(/[a-zA-Z$][\w$]*/).name('Id'),
  NUMBER: tk.token(/(0b|0o|0x)?\d[\d_]*(\.[\d_]+)/i).name('Number'),
  DOCCOMMENT: tk.token(/([\n\s\r\t ]*#\?([^\n]*))+|#\(\?((?!#\))[^])*#\)/).skip().name('Doccomment'), // Skip it generally, except when we will need them
  WS: tk.token(/(?:[\t\n\s ]|#\((?!\?)((?!)#\)[^])*#\)|#(?!\?)[^\n]*)+/).skip().name('WS') // Whitespace !
}


export class ZoeParser {

  Id = T.ID.node(r => ast.Id.create(r.match[0]))


  NamespacedIdentifier = SeparatedBy(S`::`, this.Id)


  Expression: Rule<any> = Either(
    // Forward(() => IfExpression),
    Either(
      S`void`,
      S`true`,
      S`false`,
      S`null`,
      S`stub`
    ).node(r => ast.LiteralExpression.create(r)),
    Forward(() => this.TypeIdentifier),
    Forward(() => this.TraitIdentifier)
  )


  UnaryOp = Seq(
    { op:       Either(S`-`, S`not`) }
  )


  TerminalExpression = Either()

  ParenthesisExpression = Either(S`( ${this.Expression} )`, this.TerminalExpression)

  SuffixExpression = Seq(
    { terminal: this.ParenthesisExpression },
    // function call
    // array access
  )

  FunctionCallExpression = Seq(
              S`(`,
    { args:     SeparatedBy(S`,`, this.Expression, { trailing: true }) }, // We allow a trailing comma
              S`)`
  )

  ArrayAccess = S`[ ${Opt(this.Expression)} ]`

  OperatorExpression = Operator(
    this.SuffixExpression,
    Operator.UnaryRight(Either(this.FunctionCallExpression, this.ArrayAccess)),
    Str('.'),
    Str('*', '/'),
    Str('+', '-'),
    Str('<<', '>>'),
    Str('&', '|', '^'),
    Str('<', '<=', '>', '>=', '==', '!='),
    Str('and', 'or'),
    Operator.UnaryLeft(Str('not')),
    Operator.AssocRight(Str('=', '&=', '|=', '^=', '+=', '-=', '/=', '*='))
  )

  VariableAssignmentExpression = Seq(
    { specifier:    Str('let', 'const') },
    { identifier:   this.Id },
    { typeref:      Opt(Forward(() => this.TypeIdentifier)) },
                    S`=`,
    { value:        this.Expression }
  )


  ArrowExpression = Seq(
                S`=>`,
    { expression: this.Expression }
  )


  Block = Seq(
                  S`{`,
    { expressions:  Repeat(Seq({ exp: this.Expression }, Opt(S`;`)).map(r => r.exp)) },
                  S`}`
  )

  BlockOrArrow = Either(this.Block, this.ArrowExpression)

  BlockOrExpression = Either(this.Block, this.Expression)


  IfThenArm = Seq(
    { condition:    this.Expression },
    { instruction:  this.BlockOrArrow }
  )

  IfExpression = Seq(
                S`if`,
    { then:       this.IfThenArm },
    { elifs:      Repeat(S`elif ${this.IfThenArm}`) },
    { else:       Opt(S`else ${this.BlockOrExpression}`) }
  )


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

  TypeArguments: Rule<any> = Seq(
          S`<`,
    { args:  SeparatedBy(S`,`, this.Expression) },
          S`>`
  )


  DefaultValue = S`= ${this.Expression}`


  // VARIABLE DECLARATIONS

  VariableDefinition = Seq(
    { identifier:     this.Id },
    { type:           Opt(S`: ${this.Expression}`) },
    { default:        Opt(this.DefaultValue) }
  )


  // FUNCTION DECLARATIONS

  FunctionDefinitionArgument = Seq(
    { dotted:         Opt(S`...`) },
    { decl:           this.VariableDefinition }
  )

  FunctionSignature = Seq(
    { type_args:    Opt(this.TypeArguments) },
                  S`(`,
    { args:         SeparatedBy(S`,`, this.FunctionDefinitionArgument) },
                  S`) ->`,
                    this.TypeIdentifier
  )

  NamedFunctionSignature = S`${this.Id} ${this.FunctionSignature}`

  MethodDeclaration = Seq(
    { signature:  this.NamedFunctionSignature },
    { definition: this.BlockOrArrow }
  )

  FunctionDeclaration = S`function ${this.MethodDeclaration}`


  // TYPES

  StructDefinition = Seq(
              S`struct (`,
    { fields:   SeparatedBy(Str(','), this.VariableDefinition, { trailing: true }) },
              S`)`,
  )

  UnionDefinition = SeparatedBy(Str('|'), this.TypeIdentifier, { leading: true })

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


  // IMPORTS STATEMENT

  ImportAs = S`as ${this.Id}`

  ImportIdentifiers = S`( ${SeparatedBy(S`,`, Either(this.Id, this.TraitName), { trailing: true })} )`

  ImportStatementStart = S`import ${T.STR}`

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
    // MISSING Constant declaration
  )


  // TOPLEVEL Declarations
  // FIXME: needs some way of failing if a declaration failed.

  Declarations: Rule<any> = Repeat(this.Declaration)

  constructor() {
    for (var key of Object.getOwnPropertyNames(this)) {
      var p = (this as any)[key]
      if (p instanceof Rule) {
        p.name(key)
      }
    }
    // console.log(this)
  }

  parse(input: string) {

  }
}


export function parse() {

}

import * as fs from 'fs'
import * as ch from 'chalk'
import { inspect } from 'util'
if (process.mainModule === module) {
  var parser = new ZoeParser()

  var tokens = tk.tokenize(fs.readFileSync(process.argv[2], 'utf-8'))
  console.log(tokens?.map((t, i) => { return {t, i} }).filter(t => !!t.t.match[0].trim()).map(t => `${`${ch.gray(t.t.def._name)}:${t.i}<`}${ch.yellowBright(t.t.match[0].replace(/\n/g, '\\n'))}${ch.gray('>')}`).join(' '))
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
      console.log('Match failed')
      console.log(Res.max_res)
    } else {
      console.log(inspect(res.res, {depth: null}))
    }
  }
}
