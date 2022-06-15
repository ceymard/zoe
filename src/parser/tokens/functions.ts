import { augment } from "parser/helpers"
import * as ast from "parser/ast"
import * as tk from "./token"

augment(tk.Fn, {
  nud(p) {
    const ident = p.expression(0)
    return new ast.FnDeclaration(ident)
  }
})