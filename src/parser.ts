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

import { Parseur, SeparatedBy, Opt, Seq, Either, Forward, Rule, Repeat, Res, NoMatch, Token, setDebug, RecOperator, Context } from 'parseur'
import * as ast from './ast'
declare module 'parseur' {
  interface Token {
    [inspect.custom]: () => any
  }
}

setDebug()


Token.prototype[inspect.custom] = function () {
    // return { value: this.match , token: this.def._name }
    return `${ch.grey('TK:')}${ch.grey(this.def.Name + ':')}${ch.green(this.str)}`
}

const mkbinop = ast.BinOpExpression.fromParse
const mkunaryleft = ast.UnaryExpression.fromParse
const mkunaryright = (op: string | ast.Operator, operand: ast.Expression) => ast.UnaryExpression.fromParse(op, operand, false)

var P: ZoeParser['P'] = undefined!

export class ZoeParser extends Parseur {

  __ = P = this.P // just a cheat to get P out of here

  ID = this.token(/[a-zA-Z$_][\w$_]*/, '_$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
  NUM = this.token(/(0b|0o|0x)?\d[\d_]*(\.[\d_]+)?/i, '0123456789')
  STR = this.token(/(["'])(\\\1|(?!\1)[^])*\1/, `"'`)

  DOCCOMMENT = this.token(/#\?([^\n]*)\n?|#\(\?(?:(?!#\))[^])*#\)/, '#').skip() // Skip it generally, except when we will need them
  COMMENT = this.token(/#[^\n]\n?/, '#').skip()
  WS = this.token(/[\t\n\s ]+/, '\t\n\s ').skip() // Whitespace !

  // FIXME set range !
  Id = this.ID.then(r => new ast.Id()
    .set('value', r.str)
  )


  NamespacedIdentifier = SeparatedBy(P`::`, this.Id)
    .then(r => new ast.NamespacedId(r))


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

  Expression: Rule<ast.Expression> = RecOperator(
      Forward(() => this.TerminalExpression)
    )
    .Prefix(P`@`, mkunaryleft)
    .Suffix(Forward(() => Either(this.FunctionCallExpression, this.TemplateCallExpression, this.ArrayAccess, this.SliceAccess)),
      mkunaryright
    )
    // @ is both unary and binary !
    .Binary(P`@`, mkbinop)
    .Binary(P`.`, mkbinop)
    .Binary(Either(P`*`, P`/`), mkbinop)
    .Binary(Either(P`+`, P`-`), mkbinop)
    .Binary(Either(P`<`, P`<=`, P`>`, P`>=`, P`==`, P`!=`), mkbinop)
    .Prefix(P`not`, mkunaryleft)
    .Binary(P`and`, mkbinop)
    .Binary(P`or`, mkbinop)
    .Prefix(P`return`, mkunaryleft)

  FunctionCallExpression = P`( ${SeparatedBy(P`,`, this.Expression, { trailing: true })} )`
    .then(args => new ast.FunctionCall(args))

  TemplateCallExpression = P`< ${SeparatedBy(P`,`, this.Expression, { trailing: true })} >`
    .then(args => new ast.TemplateCall(args))

  ArrayAccess = P`[ ${Opt(this.Expression)} ]`
    .then(expr => new ast.ArrayAccess(expr))

  SliceAccess = P`[ ${Opt(this.Expression)} : ${Opt(this.Expression)} ]`
    .then(([start, end]) => new ast.SliceAccess()
      .set('start', start)
      .set('end', end)
    )


  TerminalExpression: Rule<ast.Expression> = Either(
    P`( ${this.Expression} )`,
    this.NUM.then(s => new ast.NumberExpression(s.str)),
    this.NamespacedIdentifier,
    Forward(() => this.Block),
    Forward(() => this.IfExpression),
    this.STR.then(s => new ast.StringExpression(s.str)),
    Either(
      P`void`,
      P`true`,
      P`false`,
      P`null`,
      P`stub`
    ).then(r => new ast.KeywordExpression(r as any)), // FIXME range !
  )

  VariableAssignmentExpression = Seq(
    { specifier:    Either(P`let`, P`const`) },
    { identifier:   this.NamespacedIdentifier },
    { typeref:      Opt(Forward(() => this.TypeIdentifier)) },
                    P`=`,
    { value:        this.Expression }
  )


  ArrowExpression = P`=> ${this.Expression}`

  // A block is a sequence of expressions optionally separated by semicolons.
  Block = P`{ ${SeparatedBy(Repeat(P`;`), this.Expression, { trailing: true, leading: true })} }`
  .then(r => new ast.Block()
    .set('expressions', r)
  )

  // Used by both if statements or function definitions
  BlockOrArrow = Either(this.Block, this.ArrowExpression)

  IfExpression = Seq(
                    P`if`,
    { condition:    this.Expression },
    { instruction:  this.BlockOrArrow },
                // { elifs:      Repeat(S`elif ${this.IfThenArm}`) },
    { else:         Opt(P`else ${Either(this.Block, this.Expression)}`) }
  ).then(r => new ast.IfExpression(r.condition, r.instruction, r.else))


  ReturnExpression = Seq(
                P`return`,
    { expression: this.Expression }
  )


  TypeNameWithTypeParameters = Seq({
    name:     this.NamespacedIdentifier,
    arguments:  SeparatedBy(P`,`, Forward(() => this.TypeArguments))
  })

  TraitIdentifier: Rule<any> = Seq(
              P`@`,
    { name:      this.NamespacedIdentifier },
    { arguments: Forward(() => this.TypeArguments) }
  )

  TypeIdentifier = Seq(
    { name:         this.NamespacedIdentifier },
    { arguments:    Opt(Forward(() => this.TypeArguments)) },
    { traits:       Opt(Repeat(this.TraitIdentifier)) },
  )

  TypeArguments = P`< ${SeparatedBy(P`,`, this.Expression)} >`


  DefaultValue = P`= ${this.Expression}`


  // VARIABLE DECLARATIONS

  VariableDefinition = Seq(
    { identifier:     this.Id },
    { type:           Opt(P`: ${this.Expression}`) },
    { default:        Opt(this.DefaultValue) }
  ).then(r => new ast.VariableDefinition()
    .set('name', r.identifier)
    .set('typ', r.type)
    .set('def', r.default)
  )


  // FUNCTION DECLARATIONS

  FunctionDefinitionArgument = Seq(
    { dotted:         Opt(P`...`) },
    { decl:           this.VariableDefinition }
  ).then(r => r.decl
    .set('dotted', !!r.dotted)
  )

  FunctionDefinition = Seq(
    { type_args:    Opt(this.TypeArguments) },
                  P`(`,
    { args:         Opt(SeparatedBy(P`,`, this.FunctionDefinitionArgument, { trailing: true })) },
                  P`) ->`,
    { result:     this.Expression },
    { definition: Opt(this.BlockOrArrow) },
  ).then(r => new ast.FunctionDefinition()
    .set('type_args', r.type_args)
    .set('args', r.args)
    .set('return_type', r.result)
    .set('definition', r.definition)
  )

  MethodDeclaration = Seq(
    { name: this.NamespacedIdentifier },
    { definition:  this.FunctionDefinition },
  ).then(r => new ast.Declaration(r.name, r.definition))

  FunctionDeclaration = Seq(
    P`function`,
    { name: this.NamespacedIdentifier },
    { definition: this.FunctionDefinition }
  ).then(r => new ast.Declaration(r.name, r.definition))


  // TYPES

  StructDefinition = Seq(
              P`struct (`,
    { fields:   SeparatedBy(Opt(P`,`), this.VariableDefinition, { trailing: true }) },
              P`)`,
  ).then(r => new ast.StructDefinition(r.fields))

  UnionDefinition = SeparatedBy(P`|`, this.Expression, { leading: true })
    .then(r => new ast.UnionDefinition(r))

  TypeDeclaration = Seq(
                P`type`,
    { name:     this.NamespacedIdentifier },
                P`=`,
    { def:      Either(this.StructDefinition, this.UnionDefinition) },
  ).then(r => new ast.Declaration(r.name, r.def))

  // TRAIT

  TraitName = P`@ ${this.Id}`

  TraitDeclaration = Seq(
    { name:       this.TraitName },
    { fields:     SeparatedBy(P`,`, Either(
                      this.VariableDefinition,
                      this.MethodDeclaration,
    ))}
  )


  // NAMESPACE DECLARATION

  NamespaceDeclaration = Seq(
    { name: P`namespace ${this.NamespacedIdentifier} (` },
      { declarations: Forward(() => this.Declarations) },
    P`)`
  )

  // IMPLEMENTATIONS

  ImplementDeclaration = Seq(
              P`implement`,
    { type:   this.NamespacedIdentifier },
    { trait:  Opt(this.TraitIdentifier) },
    { decls:  P`( ${Repeat(this.MethodDeclaration)} )` }
  )

  // IMPORTS STATEMENT

  ImportAs = P`as ${this.Id}`

  ImportIdentifiers = P`( ${SeparatedBy(P`,`, Either(this.Id, this.TraitName), { trailing: true })} )`

  ImportStatementStart = P`import ${this.STR}`

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

    var res = this.parseRule(input, this.Declarations, tokens => new Context(tokens), { enable_line_counts: true, forget_skips: false })
    return res
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
          // console.log(res.result?.map(r => r.constructor.name).join(' '))
          console.log(res.result?.map(r => r.debug()).join(' '))
          // console.log(inspect(res.result, { depth: null, colors: true }))
        }
      } else {
        console.log(`  ${ch.bold.redBright('⛌')} ${basename}`)
        if (res.tokens) console.log(res.tokens.map((tok, i) => { return {tok, i}})
          .filter(t => !!t.tok.str.trim())
          .map(t => `${ch.grey(`${t.tok.def.Name}:${t.i} `)}${ch.greenBright(t.tok.str)} `)
          .join(' ')
        )
        if (res.ctx) {
          console.log(inspect(res.ctx, { depth: null, colors: true }))
        }
        break
      }
    }

    // console.log(files)
  }

}

export const parser = new ZoeParser()
// console.log(parser.NamespaceDeclaration.startTokenDebug)

export function parse() {

}

if (process.mainModule === module) {
  // var parser = new ZoeParser()
  parser.testAll(process.argv[2])

  // parser.parse(fs.readFileSync(process.argv[2], 'utf-8'))
}
