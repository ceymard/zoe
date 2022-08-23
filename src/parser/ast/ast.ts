import { Ranged } from "src/parser/range"
// import * as tk from "parser/tokens"

export class Node extends Ranged {
  parent: Node | null = null

  setParent(parent: Node) { parent.extendRange(this); this.parent = parent; return this }

  registerSymbol(sym: Ident, def: Node) {
    if (!this.parent) throw new Error(`symbol "${sym}" could not be registered`)
    this.parent.registerSymbol(sym, def)
  }

  getSymbol(sym: string): Node | undefined {
    return this.parent?.getSymbol(sym)
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

export class Scope extends Statement {

  sym_map = new Map<string, Node>()
  statements: Statement[] = [] //!

  getSymbol(symbol: string): Node | undefined {
    return this.sym_map.get(symbol) ?? this.parent?.getSymbol(symbol)
  }

  registerSymbol(sym: Ident, def: Node) {
    if (sym.isBogus()) return // do not add bogus names
    this.sym_map.set(sym.value, def)
  }

}

export class Declaration extends Statement {
  // constructor(public name: Ident, ...ranges: Ranged[]) { super() }
}

export class Expression extends Statement { }
export class Operation extends Expression { }

let __intermediary = 0
export class IntermediaryResult extends Expression {
  internal_name = `_tmp_${__intermediary++}`
}

export class BinOp extends Expression {
  left: Node = undefined as any //!
  right: Node = undefined as any //!
}

export class UnaryOp extends Expression {
  operand!: Node //!
}

export class Literal extends Expression {
  value!: string //!!
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
  value = "?"
  kind: IdentKind = IdentKind.Regular //!!
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
  condition!: Node //!
  then!: Node //!
  otherwise: Node | null = null //!
}

// All loops (for, while, do..while) get transformed into Loop
export class Loop extends Node {
  init: Node | null = null //!
  body: Statement | null = null //!
}

// Templated expressions instanciate their types
//
export class TemplatedExpression extends Declaration {

}

export class ImportAs extends Declaration {
  ident: Ident = undefined as any //!
  path: string = undefined as any //!!
  sub_ident: Ident | null = null //!
}

export class Scoped extends Statement {

}

export class Block extends Statement {
  statements: Statement[] = [] //!
}

export class FnDefinition extends Statement {
  ident: Ident | null = null //!
  args: Variable[] = [] //!
  body: Block | null = null //!
}

export class FnDeclaration extends Declaration {
  extern: boolean = false //!!
  args: Node[] = [] //!
  ident!: Ident //!
}

export class TypeDeclaration extends Declaration {
  ident!: Ident //!
  decls: Expression[] = [] //!
}

export class Variable extends Declaration {
  type_expression: Expression | null = null //!
  default_expression: Expression | null = null //!
}
