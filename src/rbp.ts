import { T } from "./lexer/token-gen"

export const LBP: number[] = new Array(T.ZEof + 1).fill(-1)
let _prio = 10
function _(...tk: T[]) {
  for (let t of tk) { LBP[t] = _prio }
  _prio += 10
}

/////////////////////////////////////////////////
//// Defining operator RBP
//// Each call to _ augments the RBP, which means the first calls have the lowest priority.

_(
  T.Assign,
  T.AssignOr, T.AssignAnd,
  T.AssignBitAnd, T.AssignBitOr, T.AssignXor,
  T.AssignDiv, T.AssignAdd, T.AssignSub, T.AssignMul, T.AssignModulo,
)                       // = ||= &&= &= |= ^= /= += -= *= %=


_(T.Equal, T.Differ)    // == !=

_(T.Not)                // !

_(T.And, T.Or)          // && ||

_(T.Gt, T.Gte, T.Lt, T.Lte) // < <= >= >

_(T.BitXor, T.BitOr)    // ^ |
_(T.BitAnd)             // &

_(T.Sub, T.Add)         // - +
_(T.Div, T.Mul, T.Modulo) // / * %

_(T.Is, T.IsNot)        // is   is not

// Type expressions are above
_(T.At)                 // @
_(T.LParen)             // call()
_(T.Cast)               // ::
_(T.LBrace)           // index[]
_(T.Dot, T.DotQuestion) // . ?.
