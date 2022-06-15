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
      const aid = id.nud(p) as ast.Ident
      scope.addDeclaration(new ast.ImportAs(aid, path.nud(p) as ast.String))
      return
    }

    if (!p.expect(tk.LParen)) return
    do {
      const next = p.next()
      if (next.constructor === tk.RParen) break
      const aid = next.nud(p) as ast.Ident
      if (p.consume(tk.As)) {
        const next = p.next()
        const aid2 = next.nud(p) as ast.Ident
        scope.addDeclaration(new ast.ImportAs(aid2, path.nud(p) as ast.String, aid))
      } else {
        // FIXME as
        scope.addDeclaration(new ast.ImportAs(aid, path.nud(p) as ast.String, aid))
      }
      // try to eat a comma
      p.consume(tk.Comma)
    } while (true)
    // The import "path" (Ident1, ident2, ...)

  }
})