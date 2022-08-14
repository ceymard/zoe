import { Range, Ranged } from "parser/range"
// import * as tk from "parser/tokens"

export class Node {
  range: Range = new Range()
  constructor(ranges: Ranged[]) {
    for (const r of ranges) this.range.extend(r.range)
  }

  is<NKls extends new (...a: any[]) => Node>(kls: NKls): this is InstanceType<NKls> {
    return this.constructor === kls
  }

  /** Return true if this node can be used to resolve to a type declaration */
  isPotentialTypeExpression() { return false }

  isPotentialIdentExp() { return false }
  isPotentialTypeIdentExp() { return false }
  isPotentialTraitExp() { return false }
  isPotentialStructTraitIdentExp() { return false }
  isPotentialComptimeExp() { return false }
  isPotentialComptimeTypeExp() { return false }
  isFunctionDeclaration() { return false }
}


export class Statement extends Node { }

export class Declaration extends Statement {
  constructor(public name: Ident, ...ranges: Ranged[]) { super(ranges) }
}

export class Expression extends Statement { }

export class BinOp extends Expression {
  constructor(public left: Node, public right: Node) {
    super([left]) // FIXME
  }
}

export class UnaryOp extends Expression {
  constructor(public operand: Node) {
    super([operand])
  }
}

export class Literal extends Expression {
  constructor(range: Ranged, public value: string) { super([range]) }
  isBogus(){ return false }
}


export class Unexpected extends Node { }

export class This extends Node { }
export class ThisType extends Node { }
export class True extends Node { }
export class False extends Node { }
export class Null extends Node { }
export class Void extends Node { }
export class ErrorLiteral extends Node { }
export class Number extends Literal { }
export class String extends Literal { }

export const enum IdentKind {
  Regular = "regular",
  Type = "type",
  Trait = "trait",
  Struct = "struct",
  StructTrait = "struct trait",
  Comptime = "comptime",
  ComptimeType = "comptime type",
  Bogus = "bogus"
}

export class Ident extends Literal {
  constructor(rng: Ranged, value: string, public kind: IdentKind) { super(rng, value) }
  isTypeIdent() { return this.kind === IdentKind.Type }
  isTraitIdent() { return this.kind === IdentKind.Trait }
  isBogus() { return this.kind === IdentKind.Bogus }
}

//export class StringPart extends Node { }
//export class StringEnd extends Node { }

export class DocComment extends Node { }
export class Pragma extends Node { }

export class Assign extends BinOp { }
export class BitOrAssign extends BinOp { }
export class BitAndAssign extends BinOp { }
export class BitXorAssign extends BinOp { }
export class OrAssign extends BinOp { }
export class AndAssign extends BinOp { }
export class DivAssign extends BinOp { }
export class ModAssign extends BinOp { }
export class MulAssign extends BinOp { }
export class PlusAssign extends BinOp { }
export class MinusAssign extends BinOp { }
export class Eq extends BinOp { }
export class Neq extends BinOp { }
export class Not extends UnaryOp { }
export class Or extends BinOp { }
export class And extends BinOp { }
export class Gt extends BinOp { }
export class Lt extends BinOp { }
export class Gte extends BinOp { }
export class Lte extends BinOp { }
export class BitOr extends BinOp { }
export class BitXor extends BinOp { }
export class BitAnd extends BinOp { }
export class BitShiftRight extends BinOp { }
export class BitShiftLeft extends BinOp { }
export class Plus extends BinOp { }
export class Minus extends BinOp { }
export class Div extends BinOp { }
export class Mod extends BinOp { }
export class Mul extends BinOp { }
export class BitNot extends UnaryOp { }
export class Is extends BinOp { }
export class As extends BinOp { }
export class Dot extends BinOp { }
export class PlusPlusPre extends UnaryOp { }
export class MinusMinusPre extends UnaryOp { }
export class PlusPlus extends UnaryOp { }
export class MinusMinus extends UnaryOp { }
export class PtrType extends UnaryOp { }
export class PtrReference extends UnaryOp { }
export class PtrDereference extends UnaryOp { }
export class In extends BinOp { }


export class Branch extends Node {
  constructor(
    public condition: Node,
    public then: Node,
    public otherwise: Node,
  ) { super([condition, then, otherwise]) }
}

// All loops (for, while, do..while) get transformed into Loop
export class Loop extends Node {
  constructor(
    public init: Node,
    public body: Node[],
  ) { super([init, ...body]) }
}

// Templated expressions instanciate their types
//
export class TemplatedExpression extends Declaration {

}

export class ImportAs extends Declaration {
  constructor(ident: Ident, public path: String, public sub_ident: Ident | null = null) {
    super(ident, ident, path)
    if (sub_ident) this.range.extend(sub_ident.range)
  }
}

export class Block extends Statement {
  constructor(public statements: Statement[]) { super([...statements]) }
}

export class FnDefinition extends Statement {
  constructor(public ident: Ident | null, public args: Variable[], public body: Statement | null) {
    const ranges = [...args, ...(body ? [body] : [])]
    super(ranges, /* ...args */)
  }
}

export class FnDeclaration extends Declaration {
  extern = false
  args: Node[] = []
  constructor(ident: Ident) {
    super(ident, ident)
  }
}

export class TypeDeclaration extends Declaration {
  constructor(ident: Ident, public decls: Expression[]) {
    super(ident, ident)
  }
}

export class Variable extends Declaration {
  type_expression: Expression | null = null
  default_expression: Expression | null = null
}
