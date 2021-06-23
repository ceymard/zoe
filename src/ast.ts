// import { Token } from "./lexer/token"
// import * as ch from 'chalk'
import { Token } from "./lexer/token"
import { T } from "./lexer/token-gen"
import { Scope } from "./scope"
import * as Y from "./types"
import * as lsp from "./lsp"

const sym_range = Symbol("range")

export abstract class Node implements lsp.Ranged {

  private [sym_range]?: lsp.Range

  range: lsp.Range
  constructor(
    public scope: Scope,
    ranged: lsp.Ranged
  ) {
    this.range = ranged.getRange()
  }

  getText(str: string) { return this.range.getText(str) }

  getRange(): lsp.Range {
    let rng = this[sym_range]
    if (!rng) {
      rng = this.range
      for (let prop of Object.getOwnPropertyNames(this)) {
        let value = this[prop as keyof this]
        if (value instanceof Node) {
          let vrng = value.getRange()
          rng.extend(vrng.start, vrng.end)
        }
      }
      this[sym_range] = rng
    }
    return rng
  }
}

export class Declaration extends Node {

  constructor(
    scope: Scope,
    range: lsp.Ranged,
    public name: Id,
    public definition: Definition
  ) {
      super(scope, range)
  }

  local = false
  setLocal(): this {
    this.local = true
    return this
  }

}

export abstract class Definition extends Node { }

export class VariableDefinition extends Definition {
  constructor(
    scope: Scope,
    range: lsp.Ranged,
    public type?: Expression,
    public value?: Expression,
    public is_const = false,
  ) { super(scope, range) }
}

/** Any expression that can have a type */
export abstract class Expression extends Node {
  // abstract getType(): Y.Type
}

/** Any expression that can resolve into a type expression */
export abstract class TypeExpression extends Expression { }

export abstract class PathExpression extends TypeExpression { }

/** Binary operator */
export abstract class BinOp extends Expression {
  constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public left: Expression,
    public right: Expression,
  ) { super(scope, range) }
}

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

export class Loop extends Expression {
  constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public cond: Expression,
    public init?: Expression,
    public step?: Expression,
  ) { super(scope, range) }
}

export class If extends Expression {
  constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public cond: Expression,
    public then: Expression,
    public otherwise?: Expression,
  ) { super(scope, range) }
}

export class FnPrototype extends Expression {
  constructor(
    scope: Scope,
    range: lsp.Ranged,
    public args: Expression[],
    public return_type: Expression | undefined,
  ) { super(scope, range) }
}

export class FnDefinition extends Definition {
  constructor(
    scope: Scope,
    range: lsp.Ranged,
    public prototype: FnPrototype,
    public body: Expression[],
  ) { super(scope, range) }
}

export class FnCall extends Expression {
  constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public fnxp: Expression,
    public args: Expression[]
  ) { super(scope, range) }
}

export class Tuple extends Expression {
  constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public expressions: Expression[]
  ) { super(scope, range) }
}

export class Block extends Expression {
  constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public expressions: Expression[],
  ) { super(scope, range) }
}

export class BinOpAssign extends BinOp { }
export class BinOpEqual extends BinOp { }
export class BinOpDiffer extends BinOp { }
export class BinOpGte extends BinOp { }
export class BinOpGt extends BinOp { }
export class BinOpLte extends BinOp { }
export class BinOpLt extends BinOp { }
export class BinOpBitNot extends BinOp { }
export class BinOpBitAnd extends BinOp { }
export class BinOpBitXor extends BinOp { }
export class BinOpBitOr extends BinOp { }
export class BinOpNot extends BinOp { }
export class BinOpAnd extends BinOp { }
export class BinOpOr extends BinOp { }
export class BinOpMul extends BinOp { }
export class BinOpDiv extends BinOp { }
export class BinOpModulo extends BinOp { }
export class BinOpAdd extends BinOp { }
export class BinOpSub extends BinOp { }
export class BinOpIs extends BinOp { }
export class BinOpIsNot extends BinOp { }
export class BinOpDotQuestion extends BinOp { }
export class BinOpDot extends BinOp { }


export function binop_assign(
  kls: new (scope: Scope, tk: lsp.Ranged, left: Expression, right: Expression) => BinOp,
  scope: Scope,
  tk: lsp.Ranged,
  left: Expression,
  right: Expression
) {
  return new BinOpAssign(scope, tk, left, new kls(scope, tk, left, right))
}


/** Unary operator */
export class UnaOp extends Expression {
  constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public target: Expression
  ) { super(scope, range) }
}

export class UnaOpDeref extends UnaOp { }
export class UnaOpRef extends UnaOp { }
export class UnaOpPlus extends UnaOp { }
export class UnaOpMinus extends UnaOp { }

export class Literal extends Expression {
  public constructor(
    public scope: Scope,
    range: lsp.Ranged,
    public value: string
  ) { super(scope, range) }
}

export class Id extends Literal {
  is_an_error = false
}
export class Number extends Literal { }
export class True extends Literal { }
export class False extends Literal { }
export class Null extends Literal { }
export class Void extends Literal { }

/** empty expression. Its type is Unit */
export class Empty extends Expression {
  constructor(range: lsp.Ranged) {
    super(null!, range)
  }
}


export class ErrorNode extends Expression {
  constructor(range: lsp.Ranged, public message: string) { super(null!, range) }
}
