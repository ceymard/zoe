import { Token } from "parseur"
import { inspect } from 'util'
import * as ch from 'chalk'


const i = (a: any) => inspect(a, { colors: true, depth: null })
const C = inspect.custom


export const enum T {
  TYPE = 'type',
  STRUCT = 'struct',
  OPERATOR = 'operator',
  EXPRESSION = 'expression',
  FUNC = 'function',
  VAR = 'var',
}


export const enum E {
  RETURN = 'return',
  LITERAL = 'lit',
  BLOCK = 'block',
  ID = 'id',
  NMSP = 'nmspid',
}


export class Disp {
  [C]() {

  }
}


export class Node {
  _range?: { input: Token[], start: number, end: number }
  type!: T
  constructor() { }

  static new<N extends Node, Args extends any[]>(this: {new (...args: Args): N}, ...a: Args) {
    return new this(...a)
  }

  set<K extends keyof this>(key: K, value: this[K]): this {
    this[key] = value
    return this
  }

  get debug_type() {
    return ch.grey(`<${this.type}>`)
  }

  debug(): any[] {
    return []
  }

  [C]() {
    return this.debug().filter(d => !!d)//.map(d => i(d))
    // return ch.grey(`<${this.type} ${this.debug().filter(d => d != undefined).join(' ')}>`)
  }
}


export class VariableDefinition extends Node {
  type: T.VAR = T.VAR
  name: Id | undefined
  typ: Expression | undefined
  def: Expression | undefined
  dotted = false // used mostly in function arguments
}


/**
 * This node is both a function definition and a signature
 * What differenciates the two is whether it has a definition
 */
export class FunctionDefinition extends Node {
  type: T.FUNC = T.FUNC

  name: NamespacedId | undefined = undefined
  type_args: Expression[] | undefined = undefined
  args: VariableDefinition[] | undefined = undefined
  return_type: Expression | undefined = undefined
  definition: Expression | undefined = undefined

  debug() { return [i(this.name), i(this.type_args), i(this.args), i(this.return_type), i(this.definition)] }

}

export class Expression extends Node {
  type: T.EXPRESSION = T.EXPRESSION
  // checked_type?: Type
}

export class Id extends Expression {
  etype: E.EXPRESSION = T.EXPRESSION
  value: string = ''

  debug() { return [this.value] }

}

export class NamespacedId extends Expression {
  etype: E.NMSP = E.NMSP
  ids: Id[] = []

  debug() { return [this.ids.map(i).join('::')] }
}

export class Operator extends Node {
  type: T.OPERATOR = T.OPERATOR
}

export class OperatorLiteral extends Operator {
  value: string = ''
}

export class FunctionCall extends Operator {
  args: Expression[] = []
}

export class TemplateCall extends Operator {
  args: Expression[] = []
}

// Can also represent the array type definition
export class ArrayAccess extends Operator {
  expr: Expression | undefined
}

export class SliceAccess extends Operator {
  start: Expression | undefined
  end: Expression | undefined
}

export const NoOperator = new OperatorLiteral().set('value', '#N/A')

// export class UnaryOperator extends

export class BinOpExpression extends Expression {
  op: Operator = NoOperator
  lhs: Expression | undefined
  rhs: Expression | undefined
}

export class Block extends Expression {
  type: T.EXPRESSION = T.EXPRESSION
  etype: E.BLOCK = E.BLOCK
  expressions: Expression[] = []
}

export class LiteralExpression extends Expression {
  etype: E.LITERAL = E.LITERAL
  value: 'void' | 'false' | 'true' | 'null' | 'stub' = 'void'
}

export interface Return extends Node {
  t: E.RETURN
}
