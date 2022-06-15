import { augment } from "parser/helpers"
import * as tk from "./token"
import * as ast from "parser/ast"

augment(tk.While, {
  nud(p) {
    // should we look for the ( ? Is it mandatory ?
    const condition = p.expression(0)
    return new ast.Loop()
  }
})
