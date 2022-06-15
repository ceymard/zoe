import { augment } from "parser/helpers"
import * as ast from "parser/ast"
import * as tk from "./token"

augment(tk.Extern, {
  parseTopLevel(p, scope) {
    const prevlen = scope.statements.length
    p.next().parseTopLevel(p, scope)
    const fn = scope.statements[prevlen]

    if (prevlen === scope.statements.length || !fn.is(ast.FnDeclaration)) {
      // FIXME : also error
      p.reportError(this.range, "extern may only precede an expression declaration")
      return
    }

    fn.extern = true
  },
  parseInCodeBlock(p, scope) {
    return this.parseTopLevel(p, scope)
  },
  parseInTypeDecl(p, scope) {
    p.reportError(this.range, "extern can only be used for top level functions")
  }
})