
export const enum T {
  MODULE,
  TYPE,
  VTABLE,
  EXPRESSION
}

export interface Module {
  type: T.MODULE
  name: string
  path: string
  types: Type[]
  vtables: VTable[] // ???
  functions: Fn[]
}

export interface Fn {

}

export interface Type {
  type: T.TYPE
  name: string
}

export interface VTable {
  type: T.VTABLE
  name: string
  // Offsets of properties
  properties: Map<string, number>[]
  // Offset of entries
  entries: Map<string, number>[]
}

export interface Expression {
  type: T.EXPRESSION
}

export interface BinOp {
  op: string // the operator of the binop
  lhs: any
  rhs: any
}
