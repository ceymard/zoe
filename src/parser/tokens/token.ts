import { augment } from "src/parser/helpers"
import { Range, Position, Ranged } from "src/parser/range"
import type { Parser } from "../parser"
import * as ast from "src/parser/ast"

export const keywords: { new (...a: any): Token, kw: string }[] = []

export class Token extends Ranged {
  LBP!: number
  // The following four fields are filled by the lexer.
  offset: number = 0
  length: number = 0
  range: Range

  constructor(lex: Parser) {
    super()
    this.offset = lex.start
    this.length = lex.offset - lex.start

    this.range = new Range(
      new Position(lex.start_line, lex.start_col),
      new Position(lex.line, lex.offset - lex.last_line_offset),
    )
  }

  is<T extends typeof Token>(tkk: T): this is InstanceType<T> {
    // console.log(tkk.classname(), this.classname(), this.repr())
    return this.constructor === tkk
  }

  isEof() { return false }

  repr() { return this.constructor.name }

  _unexpected(p: Parser) {
    p.reportError(this.range, `unexpected token ${this.repr()}`)
    return new ast.Unexpected().extendRange(this)
  }

  // Only tokens expected at the top level need to implement this method,
  // such as import, export, const, var, fn, local, type, struct, enum
  parseTopLevel(p: Parser, block: ast.Block): void {
    this._unexpected(p)
  }

  // only const, var, type, fn and trait
  parseInTypeDecl(p: Parser, block: ast.Block): void { }

  // Everyone can push code here !
  parseInCodeBlock(p: Parser, block: ast.Block): void { }


  nud(p: Parser, block: ast.Block): ast.Node { return this._unexpected(p) }

  nudExpect<T extends ast.Node>(p: Parser, block: ast.Block, kls: new (...a: any[]) => T): T {
    const res = this.nud(p, block)
    if (!(res instanceof kls)) {
      const r = this._unexpected(p)
      // p.rewind()
      return r as T
    }
    return res as T
  }
  nudExpectIdent(p: Parser, block: ast.Block) {
    return this.nudExpect(p, block, ast.Ident)
  }

  nudExpectString(p: Parser, block: ast.Block) {
    return this.nudExpect(p, block, ast.String)
  }

  led(p: Parser, block: ast.Block, left: ast.Node): ast.Node { throw new Error("no led method") }

  parseStatement(p: Parser): ast.Node { return this._unexpected(p) }
  parseVariableDeclaration(p: Parser): ast.Node { return this._unexpected(p) }

  isGenericIdent(): this is GenericIdent { return false }
  toIdent(): ast.Ident { return new ast.Ident().setKind(ast.IdentKind.Bogus).extendRange(this) }
}

// with an LBP of -1, the token can never be selected in expression() as a led candidate.
Token.prototype.LBP = -1

export abstract class ValueToken extends Token {
  value: string
  toIdent(): ast.Ident { return new ast.Ident().setKind(ast.IdentKind.Bogus).setValue(this.value).extendRange(this) }
  constructor(lex: Parser) {
    super(lex)
    this.value = lex.source.slice(lex.start, lex.offset + 1)
  }
  repr() {
    return this.value
  }
}

// Keywords
export abstract class Keyword extends Token {
  static kw: string
  repr() { return (this.constructor as any).kw }
}

/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

export class Eof extends Token { isEof() { return true } }

// the LBP priority in an expression
let __prio = 10

@repr("=") @binop(ast.Assign) export class Assign extends Token { }
@repr("|=") @binop(ast.BitOrAssign) export class BitOrAssign extends Token { }
@repr("&=") @binop(ast.BitAndAssign) export class BitAndAssign extends Token { }
@repr("^=") @binop(ast.BitXorAssign) export class BitXorAssign extends Token { }
@repr("||=") @binop(ast.OrAssign) export class OrAssign extends Token { }
@repr("&&=") @binop(ast.AndAssign) export class AndAssign extends Token { }
@repr("/=") @binop(ast.DivAssign) export class DivAssign extends Token { }
@repr("%=") @binop(ast.ModAssign) export class ModAssign extends Token { }
@repr("*=") @binop(ast.MulAssign) export class MulAssign extends Token { }
@repr("+=") @binop(ast.PlusAssign) export class PlusAssign extends Token { }
@repr("-=") @binop(ast.MinusAssign) export class MinusAssign extends Token { }

export const prio_above_assign = _() // prio

@repr("==") @binop(ast.Eq) export class Eq extends Token { }
@repr("!=") @binop(ast.Neq) export class Neq extends Token { }

_() // prio

@repr("!") @prefix(ast.Not) export class Not extends Token { }

_() // prio

@repr("||") @binop(ast.Or) export class Or extends Token { }

_() // prio

@repr("&&") @binop(ast.And) export class And extends Token { }

_() // prio

@repr(">") @binop(ast.Gt) export class Gt extends Token { }
@repr("<") @binop(ast.Lt) export class Lt extends Token { }
@repr(">=") @binop(ast.Gte) export class Gte extends Token { }
@repr("<=") @binop(ast.Lte) export class Lte extends Token { }

_() // prio

@repr("|") @binop(ast.BitOr) export class BitOr extends Token { }

_() // prio

@repr("^") @binop(ast.BitXor) export class BitXor extends Token { }

_() // prio

@repr("&") @binop(ast.BitAnd) export class BitAnd extends Token { }

_() // prio

@repr(">>") @binop(ast.BitShiftRight) export class BitShiftRight extends Token { }
@repr("<<") @binop(ast.BitShiftLeft) export class BitShiftLeft extends Token { }

_() // prio

@repr("+") @binop(ast.Plus) export class Plus extends Token { }
@repr("-") @binop(ast.Minus) export class Minus extends Token { }

_() // prio

@repr("/") @binop(ast.Div) export class Div extends Token { }
@repr("%") @binop(ast.Mod) export class Mod extends Token { }
@repr("*") @binop(ast.Mul) export class Mul extends Token { }

_() // prio

@repr("~") export class BitNot extends Token { }

_() // prio

@kw("is") @binop(ast.Is) export class Is extends Keyword { }
@kw("as") @binop(ast.As) export class As extends Keyword { }

@repr("++") @prefix(ast.PlusPlusPre) @suffix(ast.PlusPlus)
  export class PlusPlus extends Token { }
@repr("--") @prefix(ast.MinusMinusPre) @suffix(ast.MinusMinus)
  export class MinusMinus extends Token { }

export const prio_at = __prio
@repr("@") @suffix(ast.PtrDereference) export class At extends Token { }
augment(At, {
  nud(p, sc) {
    let right = p.expression(sc, prio_at + 1)
    if (right.isPotentialComptimeTypeExp() || right.isPotentialTypeIdentExp()) {
      return new ast.PtrType().setOperand(right)
    }
    return new ast.PtrReference().setOperand(right)
  }
})

@repr("...") export class Elipsis extends Token { }
@repr(".") @binop(ast.Dot) export class Dot extends Token { }
// @repr("::") @binop(ast.DoubleColon) export class DoubleColon extends Token { }
@kw("in") @binop(ast.In) export class In extends Keyword { }

_() // prio
export const prio_idents = __prio

@repr("(") export class LParen extends Token { }
@repr(")") export class RParen extends Token { }
@repr("{") export class LBracket extends Token { }
@repr("}") export class RBracket extends Token { }
@repr("[") export class LBrace extends Token { }
@repr("]") export class RBrace extends Token { }
@repr(",") export class Comma extends Token { }
@repr("->") export class Arrow extends Token { }
@repr(":") export class Colon extends Token { }
@repr(";") export class SemiColon extends Token { }


export class GenericIdent extends ValueToken {
  kind!: ast.IdentKind
  isGenericIdent(): this is GenericIdent { return this.kind !== ast.IdentKind.Bogus }
  toIdent() {
    return new ast.Ident().setKind(this.kind).setValue(this.value).extendRange(this)
  }
}

@ident(ast.IdentKind.Regular) export class Ident extends GenericIdent { }
@ident(ast.IdentKind.Type) export class TypeIdent extends GenericIdent { }
@ident(ast.IdentKind.Trait) export class TraitIdent extends GenericIdent { }
@ident(ast.IdentKind.StructTrait) export class StructTraitIdent extends GenericIdent { }
@ident(ast.IdentKind.Comptime) export class ComptimeIdent extends GenericIdent { }
@ident(ast.IdentKind.ComptimeType) export class ComptimeTypeIdent extends GenericIdent { }

@literal(ast.Number) export class Number extends ValueToken { }
@literal(ast.String) export class String extends ValueToken { }

export class StringPart extends ValueToken { }
export class StringEnd extends ValueToken { }
export class DocComment extends ValueToken { }
export class Pragma extends ValueToken { }


@kw("while") export class While extends Keyword { }
@kw("do") export class Do extends Keyword { }
@kw("for") export class For extends Keyword { }
@kw("break") export class Break extends Keyword { }
@kw("continue") export class Continue extends Keyword { }
@kw("yield") export class Yield extends Keyword { }
@kw("if") export class If extends Keyword { }
@kw("else") export class Else extends Keyword { }
@kw("return") export class Return extends Keyword { }

@kw("fn") export class Fn extends Keyword { }
@kw("type") export class Type extends Keyword { }
@kw("trait") export class Trait extends Keyword { }
@kw("struct") export class Struct extends Keyword { }
@kw("enum") export class Enum extends Keyword { }

@kw("true") export class True extends Keyword { }
@kw("false") export class False extends Keyword { }
@kw("iso") export class Iso extends Keyword { }
@kw("error") export class ErrorLiteral extends Keyword { }
@kw("this") export class This extends Keyword { }
@kw("This") export class ThisType extends Keyword { }
@kw("void") export class Void extends Keyword { }
@kw("null") export class Null extends Keyword { }
@kw("import") export class Import extends Keyword { }
@kw("export") export class Export extends Keyword { }

@kw("try") export class Try extends Keyword { }
@kw("catch") export class Catch extends Keyword { }
@kw("finally") export class Finally extends Keyword { }
@kw("extern") export class Extern extends Keyword { }

@kw("const") export class Const extends Keyword { }
@kw("var") export class Var extends Keyword { }


export class Unexpected extends ValueToken {
  repr(): string { return this.value }
}

/** Calling this ups the LBP level */
function _() {
  __prio += 10
  return __prio
}

function binop(binop: new () => ast.BinOp) {
  return function _binop(inst: new (...a: any) => Token) {
    let _prio = __prio
    augment(inst, {
      LBP: __prio,
      led(p, sc, left) {
        const right = p.expression(sc, _prio + 1)
        const res = new binop().setLeft(left).setRight(right)
        return res
      }
    })
  }
}

function prefix(unary: new () => ast.UnaryOp) {
  return function _prefix(inst: new (...a: any) => Token) {
    let _prio = __prio
    augment(inst, {
      LBP: __prio,
      nud(p, sc) {
        const right = p.expression(sc, _prio + 1)
        const res = new unary().setOperand(right)
        return res
      }
    })
  }
}

function suffix(unary: new (unary: ast.Node) => ast.UnaryOp) {
  return function _suffix(inst: new (...a: any) => Token) {
    // let _prio = __prio
    augment(inst, {
      LBP: __prio,
      led(p, sc, left) {
        const res = new unary(left)
        return res
      }
    })
  }
}

function literal(node: new () => ast.Literal) {
  return function _suffix(inst: new (...a: any) => ValueToken) {
    // let _prio = __prio
    augment(inst, {
      // LBP: __prio,
      nud() {
        const res: ast.Literal = new node().setValue(this.value).extendRange(this)
        return res
      }
    })
  }
}

function ident(kind: ast.IdentKind) {
  return function _suffix(inst: typeof GenericIdent) {
    // let _prio = __prio
    inst.prototype.kind = kind
    augment(inst, {
      // LBP: __prio,
      nud() {
        const res: ast.Ident = new ast.Ident().setKind(kind).setValue(this.value).extendRange(this)
        return res
      }
    })
  }
}



function kw(kw: string) {
  return function keyword(inst: { new (...a: any): Keyword, kw: string }) {
    keywords.push(inst)
    inst.kw = kw
    augment(inst, {
      repr() { return kw }
    })
  }
}

function repr(str: string) {
  return function (kls: any) {
    kls.prototype.repr = function () { return str }
  }
}
