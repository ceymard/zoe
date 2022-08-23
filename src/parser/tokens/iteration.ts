import { augment } from "src/parser/helpers"
import * as tk from "./token"
// import * as ast from "parser/ast"

augment(tk.While, {
  parseTopLevel(p, scope) {
    // const subscope = scope.subScope()
  }
})
