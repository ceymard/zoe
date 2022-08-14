import { augment } from "parser/helpers"
import * as tk from "./token"
import * as ast from "parser/ast"

augment(tk.Import, {
  parseTopLevel(p, scope) {
    const path = p.expect(tk.String)
    if (path == null) return

    if (p.consume(tk.As)) {
      // Import as
      const id = p.expect(tk.Ident)
      if (id == null) return
      const aid = id.nudExpectIdent(p, scope)
      scope.addDeclaration(aid, new ast.ImportAs(aid, path.nudExpectString(p, scope)))
      return
    }

    if (!p.expect(tk.LParen)) return
    do {
      if (p.consume(tk.RParen))
        break
      const next = p.next()

      const aid = next.nudExpectIdent(p, scope)
      if (p.consume(tk.As)) {
        const next = p.next()
        const aid2 = next.nudExpect(p, scope, ast.Ident)
        scope.addDeclaration(aid2, new ast.ImportAs(aid2, path.nudExpectString(p, scope), aid))
      } else {
        // FIXME as
        scope.addDeclaration(aid, new ast.ImportAs(aid, path.nudExpectString(p, scope), aid))
      }
      // try to eat a comma
      p.consume(tk.Comma)
    } while (true)
    // The import "path" (Ident1, ident2, ...)

  }
})