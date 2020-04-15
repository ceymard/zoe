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

import { Parseur, SeparatedBy, Opt, Seq, Either, Forward, Rule, Repeat, TdopOperator, Res, NoMatch, Token, setDebug } from 'parseur'
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
const mkunaryleft = ast.UnaryExpression.fromParse
const mkunaryright = (op: string | ast.Operator, operand: ast.Expression) => ast.UnaryExpression.fromParse(op, operand, false)


export class ZoeTokenizer extends Parseur {

  ID = this.token(/[a-zA-Z$_][\w$_]*/, '_$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
  NUM = this.token(/(0b|0o|0x)?\d[\d_]*(\.[\d_]+)?/i, '0123456789')
  STR = this.token(/(["'])(\\\1|(?!\1)[^])*\1/, `"'`)

  DOCCOMMENT = this.token(/#\?([^\n]*)\n?|#\(\?(?:(?!#\))[^])*#\)/, '#').skip() // Skip it generally, except when we will need them
  COMMENT = this.token(/#[^\n]\n?/, '#').skip()
  WS = this.token(/[\t\n\s ]+/, '\t\n\s ').skip() // Whitespace !

}

export const TK = new ZoeTokenizer
export const T = TK.S.bind(TK)


export class ZoeParser extends Parseur {

  // FIXME set range !
  Id = TK.ID.map(r => new ast.Id()
    .set('value', r.str)
  )


  NamespacedIdentifier = SeparatedBy(T`::`, this.Id)
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

  Expression: Rule<ast.Expression> = TdopOperator(
      Forward(() => this.TerminalExpression)
    )
    .prefix(10, T`return`, mkunaryleft)
    // @ is both unary and binary !
    .binary(90, T`@`, mkbinop)
    .binary(90, T`.`, mkbinop)
    .suffix(80, Forward(() => Either(this.FunctionCallExpression, this.TemplateCallExpression, this.ArrayAccess, this.SliceAccess)),
      mkunaryright
    )
    .binary(70, T`.`, mkbinop)
    .binary(60, Either(T`*`, T`/`), mkbinop)
    .binary(50, Either(T`+`, T`-`), mkbinop)

  FunctionCallExpression = T`( ${SeparatedBy(T`,`, this.Expression, { trailing: true })} )`
    .map(args => new ast.FunctionCall(args))

  TemplateCallExpression = T`< ${SeparatedBy(T`,`, this.Expression, { trailing: true })} ) >`
    .map(args => new ast.TemplateCall(args))

  ArrayAccess = T`[ ${Opt(this.Expression)} ]`
    .map(expr => new ast.ArrayAccess(expr))

  SliceAccess = T`[ ${Opt(this.Expression)} : ${Opt(this.Expression)} ]`
    .map(([start, end]) => new ast.SliceAccess()
      .set('start', start)
      .set('end', end)
    )


  TerminalExpression: Rule<ast.Expression> = Either(
    T`( ${this.Expression} )`,
    TK.NUM.map(s => new ast.NumberExpression(s.str)),
    this.NamespacedIdentifier,
    Forward(() => this.Block),
    Forward(() => this.IfExpression),
    TK.STR.map(s => new ast.StringExpression(s.str)),
    Either(
      T`void`,
      T`true`,
      T`false`,
      T`null`,
      T`stub`
    ).map(r => new ast.KeywordExpression(r as any)), // FIXME range !
  )

  VariableAssignmentExpression = Seq(
    { specifier:    Either(T`let`, T`const`) },
    { identifier:   this.NamespacedIdentifier },
    { typeref:      Opt(Forward(() => this.TypeIdentifier)) },
                    T`=`,
    { value:        this.Expression }
  )


  ArrowExpression = T`=> ${this.Expression}`

  // A block is a sequence of expressions optionally separated by semicolons.
  Block = T`{ ${SeparatedBy(Repeat(T`;`), this.Expression, { trailing: true, leading: true })} }`
  .map(r => new ast.Block()
    .set('expressions', r)
  )

  // Used by both if statements or function definitions
  BlockOrArrow = Either(this.Block, this.ArrowExpression)

  IfExpression = Seq(
                    T`if`,
    { condition:    this.Expression },
    { instruction:  this.BlockOrArrow },
                // { elifs:      Repeat(S`elif ${this.IfThenArm}`) },
    { else:         Opt(T`else ${Either(this.Block, this.Expression)}`) }
  ).map(r => new ast.IfExpression(r.condition, r.instruction, r.else))


  ReturnExpression = Seq(
                T`return`,
    { expression: this.Expression }
  )


  TypeNameWithTypeParameters = Seq({
    name:     this.NamespacedIdentifier,
    arguments:  SeparatedBy(T`,`, Forward(() => this.TypeArguments))
  })

  TraitIdentifier: Rule<any> = Seq(
              T`@`,
    { name:      this.NamespacedIdentifier },
    { arguments: Forward(() => this.TypeArguments) }
  )

  TypeIdentifier = Seq(
    { name:         this.NamespacedIdentifier },
    { arguments:    Opt(Forward(() => this.TypeArguments)) },
    { traits:       Opt(Repeat(this.TraitIdentifier)) },
  )

  TypeArguments = T`< ${SeparatedBy(T`,`, this.Expression)} >`


  DefaultValue = T`= ${this.Expression}`


  // VARIABLE DECLARATIONS

  VariableDefinition = Seq(
    { identifier:     this.Id },
    { type:           Opt(T`: ${this.Expression}`) },
    { default:        Opt(this.DefaultValue) }
  ).map(r => new ast.VariableDefinition()
    .set('name', r.identifier)
    .set('typ', r.type)
    .set('def', r.default)
  )


  // FUNCTION DECLARATIONS

  FunctionDefinitionArgument = Seq(
    { dotted:         Opt(T`...`) },
    { decl:           this.VariableDefinition }
  ).map(r => r.decl
    .set('dotted', !!r.dotted)
  )

  FunctionSignature = Seq(
    { type_args:    Opt(this.TypeArguments) },
                  T`(`,
    { args:         Opt(SeparatedBy(T`,`, this.FunctionDefinitionArgument, { trailing: true })) },
                  T`) ->`,
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

  FunctionDeclaration = T`function ${this.MethodDeclaration}`


  // TYPES

  StructDefinition = Seq(
              T`struct (`,
    { fields:   SeparatedBy(Opt(T`,`), this.VariableDefinition, { trailing: true }) },
              T`)`,
  )

  UnionDefinition = SeparatedBy(T`|`, Either(this.TypeIdentifier, this.TraitIdentifier), { leading: true })

  TypeDeclaration = Seq(
                T`type`,
    { name:     this.Id },
                T`=`,
    { def:      Either(this.StructDefinition, this.UnionDefinition) },
  )

  // TRAIT

  TraitName = T`@ ${this.Id}`

  TraitDeclaration = Seq(
    { name:       this.TraitName },
    { fields:     SeparatedBy(T`,`, Either(
                      this.VariableDefinition,
                      this.NamedFunctionSignature
    ))}
  )


  // NAMESPACE DECLARATION

  NamespaceDeclaration = Seq(
    { name: T`namespace ${this.NamespacedIdentifier} (` },
      { declarations: Forward(() => this.Declarations) },
    T`)`
  )

  // IMPLEMENTATIONS

  ImplementDeclaration = Seq(
              T`implement`,
    { type:   this.NamespacedIdentifier },
    { trait:  Opt(this.TraitIdentifier) },
    { decls:  T`( ${Repeat(this.MethodDeclaration)} )` }
  )

  // IMPORTS STATEMENT

  ImportAs = T`as ${this.Id}`

  ImportIdentifiers = T`( ${SeparatedBy(T`,`, Either(this.Id, this.TraitName), { trailing: true })} )`

  ImportStatementStart = T`import ${TK.STR}`

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

  Declarations: Rule<ast.Declaration[]> = Repeat(this.Declaration)

  parse(input: string) {
    var tokens = TK.tokenize(input, { enable_line_counts: true, forget_skips: true })
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

  // constructor() {
  //   super()
  //   // this.nameRules()
  // }

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
          // console.log(res.result)
          console.log(res.result?.map(r => r.constructor.name).join(' '))
          console.log(res.result?.map(r => r.debug()).join(' '))
          // console.log(inspect(res.result, { depth: null, colors: true }))
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

export const parser = new ZoeParser()
// console.log(parser.ImportStatement.start_tokens)

export function parse() {

}

if (process.mainModule === module) {
  // var parser = new ZoeParser()
  parser.testAll(process.argv[2])

  // parser.parse(fs.readFileSync(process.argv[2], 'utf-8'))
}
