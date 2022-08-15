import { augment } from "parser/helpers"
import * as tk from "parser/tokens/token"
import * as ast from "parser/ast"

augment(tk.ThisType, {
  nud() { return new ast.ThisType().extendRange(this) }
})

augment(tk.This, {
  nud() { return new ast.This().extendRange(this) }
})

augment(tk.True, {
  nud() { return new ast.True().extendRange(this) }
})

augment(tk.False, {
  nud() { return new ast.False().extendRange(this) }
})
