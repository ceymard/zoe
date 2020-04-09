import { Token } from "parseur"


export const enum T {
  TYPE = 'type',
  STRUCT = 'struct',
  EXPRESSION = 'expression',
  ID = 'id'
}


export const enum E {
  RETURN = 'return',
  LITERAL = 'lit',
}


export function node<T, T2>(fn: <N extends Node>(res: T) => Partial<N>) {
  return function <T2>(res: T2, input: Token[], pos: number, start: number): N {
    return null!
  }
}


export interface Node {
  _range?: { input: Token[], start: number, end: number }
  type: T
}


export interface Id extends Node {
  value: string
}

export namespace Id {
  export function create(value: string): Id {
    return { type: T.ID, value }
  }
}

export interface Expression {
  type: T.EXPRESSION
  etype: E
  checked_type?: Type
}

export interface LiteralExpression extends Expression {
  etype: E.LITERAL
  value: 'void' | 'false' | 'true' | 'null'
}


export namespace LiteralExpression {
  export function create(value: string): LiteralExpression {
    return {
      type: T.EXPRESSION, etype: E.LITERAL, value: value as any
    }
  }
}


export interface Return extends Node {
  t: E.RETURN
}
