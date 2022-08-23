import { Ranged } from "src/parser/range"

function er(proto: any, key: string): void {
  const sym = Symbol(key)
  Object.defineProperty(proto, key, {
    get(this: Ranged) {
      return (this as any)[sym]
    },
    set(this: Ranged, v: Ranged) {
      (this as any)[sym] = v
      this.range.extend(v.range)
    }
  })
}

function rea(proto: any, key: string) {
  const sym = Symbol(key)
  Object.defineProperty(proto, key, {
    get(this: Ranged) {
      return (this as any)[sym]
    },
    set(this: Ranged, v: Ranged[]) {
      (this as any)[sym] = v
      for (let i = 0, l = v.length; i < l; i++) this.range.extend(v[i].range)
    }
  })
}


export class Block extends Ranged {
  @rea opcodes: Opcode[] = [] //!!
}

/** An opcode may only interact on operands, and nothing else */
export class Opcode extends Ranged {

}

/** An operand is a simple operation */
export class SimpleValue extends Ranged { }


// Things we need to account for :
//   - the memory region of the ident
//   - branching effectively
//   - variable life time escape
//   - defers and errdefers code location (do we allow them in loops ?, if so, are defers handled at the end of the loop scope ?

export class UnaryOp extends Opcode {
  result = new IntermediateValue()

  @er operand!: SimpleValue //!
}

export class OpRef extends UnaryOp { }
export class OpDeRef extends UnaryOp { }
export class OpBitNot extends UnaryOp { }
export class OpNot extends UnaryOp { }

export class BinOp extends Opcode {
  result = new IntermediateValue()

  @er left!: SimpleValue //!
  @er right!: SimpleValue //!
}

export class OpAssign extends BinOp { }

// ++ becomes val+1 (integer vs. pointer types ?)
export class OpPlus extends BinOp { }
// Unary minus becomes 0-val
// -- becomes val-1
export class OpMinus extends BinOp { }
export class OpMul extends BinOp { }
export class OpDiv extends BinOp { }
export class OpMod extends BinOp { }

export class OpBitShift extends BinOp { }
export class OpXor extends BinOp { }

// Method calls are fn(this, arg1, arg2, ...)
export class OpFunctionCall extends Opcode { }


export class IntermediateValue extends SimpleValue { }
export class NamedVariable extends SimpleValue { }

// Values directly specified as is.
export class ComptimeText extends SimpleValue { }
export class ComptimeFloat extends SimpleValue { }
export class ComptimeInt extends SimpleValue { }
export class ComptimeBoolean extends SimpleValue { }