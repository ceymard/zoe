import { Token } from "parseur"
import { inspect } from 'util'
import * as ch from 'chalk'


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


export class Node {
  _range?: { input: Token[], start: number, end: number }
  type!: T
  constructor() { }

  static new<N extends Node, Args extends any[]>(this: {new (...args: Args): N}, ...a: Args) {
    return new this(...a)
  }

  [inspect.custom]() {
    return ch.grey(`<${this.type}>`)
  }
}


export class Id extends Node {
  type: T.ID = T.ID
  constructor(public value: string) {
    super()
  }
}

export class Expression extends Node {
  type: T.EXPRESSION = T.EXPRESSION
  checked_type?: Type
}

export class LiteralExpression extends Expression {
  etype: E.LITERAL = E.LITERAL
  constructor(public value: 'void' | 'false' | 'true' | 'null') {
    super()
  }

}

export interface Return extends Node {
  t: E.RETURN
}
