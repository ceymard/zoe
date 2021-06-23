#!/usr/bin/env node

import * as A from "./ast"
import { ParserBase } from "./parser-base"
import { Token } from "./lexer/token"
import { T } from "./lexer/token-gen"
import { LBP } from "./rbp"
import { File, Scope } from "./scope"

import * as out from "./console-output"
// import * as lsp from "./lsp"

/////////////////////////////////////////////////

/**
 *
 */
export class Parser extends ParserBase {

  //////////////////////////////////////////////////////
  //// Helper methods
  //////////////////////////////////////////////////////

  parseGroup<T>(
    scope: Scope,
    opts: { end?: T, sep?: T | null, allow_leading?: boolean, allow_trailing?: boolean },
    builder: (scope: Scope, tk: Token) => T
  ): T[] {

  }

  expectId(scope: Scope, rewind_on_error = false): A.Id {
    let tk = this.next()
    let id = new A.Id(scope, tk, this.file.getRangedText(tk))
    if (tk.kind !== T.Ident) {
      let message = `expected an identifier`
      if (rewind_on_error) this.rewind()
      this.file.report(tk, message)
      id.is_an_error = true
    }
    /** Still create an Id, but should be an error ? */
    return id
  }

  //////////////////////////////////////////////////////
  //// Real parsing methods
  //////////////////////////////////////////////////////

  parseNamespace(toplevel = false) {
    let decls: A.Declaration[] = []

    let nxt!: Token
    do {
      nxt = this.next()
      out.printToken(nxt)
      // console.log(nxt.repr())
      switch (nxt.kind) {
        case T.Var:
        case T.Const:

        case T.Fn:
        case T.Type:

        case T.Import:
        case T.Export:

        case T.Local:
        case T.Extern:
      }
    } while (nxt.kind !== T.ZEof && (toplevel || nxt.kind !== T.RBracket))
  }

  /** Parse a var / const statement */
  parseVariableDeclaration(scope: Scope, tk: Token) {
    // A variable, be it an argument or a declaration is *always* of the form
    // Id (":" type: Expression)? ("=" default: Expression)?

    let id = this.expectId(scope)
    let type_expression = this.consume(T.Colon, _ => {
      return this.expression(scope, LBP[T.Equal]+1)
    })
    let def = this.consume(T.Equal, _ => {
      return this.expression(scope, 0)
    })

    return new A.Declaration(
      scope,
      id,
      id instanceof A.Id ? id.value : "<error>",
      new A.VariableDefinition(
        scope,
        id,
        type_expression,
        def,
        tk.kind === T.Const,
      )
    )
  }

  parseDeclarations(scope: Scope, end?: T): A.Declaration[] {
    return []
  }

  parseDefStruct(scope: Scope, tk: Token) {

  }

  parseDefTrait(scope: Scope, tk: Token) {

  }

  parseDefUnion(scope: Scope, tk: Token) {

  }

  parseFor(scope: Scope, tk: Token) {

  }

  parseWhile(scope: Scope, tk: Token) {

  }

  parseFnPrototype(scope: Scope, tk: Token) {
    // tk is the "fn" token.

  }

  parseNudFn(scope: Scope, tk: Token): A.FnDefinition {
    let id = this.expect(T.Ident, _ => scope.file.getRangedText(_))
  }

  parseNudIf(scope: Scope, tk: Token): A.If {
    // tk is on "if"
    let cond = this.expect(T.LParen, _ => {
      let xp = this.expression(scope, 0)
      this.expect(T.RParen)
      return xp
    })

    let then = this.expectCodeBlock(scope)
    let otherwise = this.consume(T.Else, _ => this.expectCodeBlock(scope))
    return new A.If(scope, tk, cond, then, otherwise)
  }

  expectCodeBlock(scope: Scope) {
    return this.expect(T.LBracket, _ => {
      let sub = scope.subScope()
      let exps: A.Expression[] = []

      while (!this.consume(T.RBracket)) {
        let xp = this.expression(sub, 0)
        exps.push(xp)
        this.consume(T.Semicolon) // we may have semi colons at the end of expressions.
      }

      if (exps.length === 0) return new A.Empty(_)
      if (exps.length === 1) return exps[0]
      return new A.Block(sub, _, exps)
    })
  }

  parseNudFor(scope: Scope, tk: Token): A.Loop {
    let sub = scope.subScope()

    return new A.Loop(sub, tk, )
  }

  /**
   * Pratt's algorithm's expression function.
   * The easiest ast construction call are done here.
   */
  expression(scope: Scope, rbp: number): A.Expression {
    let res!: A.Expression

    let tk = this.next()

    switch (tk.kind) {

      case T.For:   { res = this.parseNudFor(scope, tk); break }
      case T.Fn:    { res = this.parseNudFn(scope, tk); break }
      case T.If:    { res = this.parseNudIf(scope, tk); break }

      case T.Ident: { res = new A.Id(scope, tk, tk.getText(this.file_contents)); break }
      case T.False: { res = new A.False(scope, tk, "false"); break }
      case T.True:  { res = new A.True(scope, tk, "true"); break }
      case T.Null:  { res = new A.Null(scope, tk, "null"); break }
      case T.Void:  { res = new A.Void(scope, tk, "void"); break }

      case T.At:    { res = new A.UnaOpRef(scope, tk, this.expression(scope, LBP[T.At])); break }

      default:
        let message = `unexpected`
        this.file.report(tk, message)
        // parser is not rewound
        // we should probably check if what follows is a part of an expression to see if we keep
        // trying to get an expression, or if we should stop there.
        res = new A.ErrorNode(tk, message) // ???
        break
    }

    let next_lbp!: number
    let nxt = () => this.expression(scope, next_lbp)
    // let nxt_min = () => this.expression(next_lbp - 1)

    do {
      tk = this.next()
      next_lbp = LBP[tk.kind]

      if (rbp >= next_lbp) {
        // this is the end condition. We either didn't find a suitable token to continue the expression,
        // or the token has a binding power too low.
        this.rewind()
        return res
      }

      switch (tk.kind) {

        case T.At:            { res = new A.UnaOpDeref(scope, tk, nxt()) }

        case T.AssignAnd:     { res = A.binop_assign(A.BinOpAnd, scope, tk, res, nxt()); break }
        case T.AssignOr:      { res = A.binop_assign(A.BinOpOr, scope, tk, res, nxt()); break }
        case T.AssignBitAnd:  { res = A.binop_assign(A.BinOpBitAnd, scope, tk, res, nxt()); break }
        case T.AssignBitOr:   { res = A.binop_assign(A.BinOpBitOr, scope, tk, res, nxt()); break }
        case T.AssignXor:     { res = A.binop_assign(A.BinOpBitXor, scope, tk, res, nxt()); break }
        case T.AssignSub:     { res = A.binop_assign(A.BinOpSub, scope, tk, res, nxt()); break }
        case T.AssignAdd:     { res = A.binop_assign(A.BinOpAdd, scope, tk, res, nxt()); break }
        case T.AssignMul:     { res = A.binop_assign(A.BinOpMul, scope, tk, res, nxt()); break }
        case T.AssignDiv:     { res = A.binop_assign(A.BinOpDiv, scope, tk, res, nxt()); break }
        case T.AssignModulo:  { res = A.binop_assign(A.BinOpModulo, scope, tk, res, nxt()); break }

        case T.Assign:        { res = new A.BinOpAssign(scope, tk, res, nxt()); break }
        case T.Equal:         { res = new A.BinOpEqual(scope, tk, res, nxt()); break }
        case T.Differ:        { res = new A.BinOpDiffer(scope, tk, res, nxt()); break }
        case T.Gte:           { res = new A.BinOpGte(scope, tk, res, nxt()); break }
        case T.Gt:            { res = new A.BinOpGt(scope, tk, res, nxt()); break }
        case T.Lte:           { res = new A.BinOpLte(scope, tk, res, nxt()); break }
        case T.Lt:            { res = new A.BinOpLt(scope, tk, res, nxt()); break }
        case T.BitNot:        { res = new A.BinOpBitNot(scope, tk, res, nxt()); break }
        case T.BitAnd:        { res = new A.BinOpBitAnd(scope, tk, res, nxt()); break }
        case T.BitXor:        { res = new A.BinOpBitXor(scope, tk, res, nxt()); break }
        case T.BitOr:         { res = new A.BinOpBitOr(scope, tk, res, nxt()); break }
        case T.Not:           { res = new A.BinOpNot(scope, tk, res, nxt()); break }
        case T.And:           { res = new A.BinOpAnd(scope, tk, res, nxt()); break }
        case T.Or:            { res = new A.BinOpOr(scope, tk, res, nxt()); break }
        case T.Mul:           { res = new A.BinOpMul(scope, tk, res, nxt()); break }
        case T.Div:           { res = new A.BinOpDiv(scope, tk, res, nxt()); break }
        case T.Modulo:        { res = new A.BinOpModulo(scope, tk, res, nxt()); break }
        case T.Add:           { res = new A.BinOpAdd(scope, tk, res, nxt()); break }
        case T.Sub:           { res = new A.BinOpSub(scope, tk, res, nxt()); break }

        case T.Is:            { res = new A.BinOpIs(scope, tk, res, nxt()); break }
        case T.IsNot:         { res = new A.BinOpIsNot(scope, tk, res, nxt()); break }
        case T.DotQuestion:   { res = new A.BinOpDotQuestion(scope, tk, res, nxt()); break }
        case T.Dot:           { res = new A.BinOpDot(scope, tk, res, nxt()); break }

        default:
          // this should never happend
          throw new Error(`parser implementation error: unhandled token in operator expression`)
      }

    } while (true)
  }

}


if (process.mainModule === module) {
  for (let a of process.argv.slice(2)) {
    const fs = require("fs") as typeof import("fs")
    const file = new File(a, fs.readFileSync(a, "utf-8"))
    let p = new Parser(file)
    p.parseNamespace(true)
  }
}
