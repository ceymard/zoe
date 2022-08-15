import { augment } from "parser/helpers"
import * as tk from "./token"
import * as ast from "parser/ast"


augment(tk.Type, {
  parseTopLevel(p, scope) {
    const id = p.expectIdent(ast.IdentKind.Type)

    if (p.consume(tk.LBrace)) {
      // start of a template expression ?
    }

    const types: ast.Expression[] = []

    //
    p.expect(tk.Assign)
    p.consume(tk.BitOr) // silently consume a |
    while (true) {
      const typexp = p.expression(scope, tk.prio_at)
      if (!typexp.isPotentialTypeExpression()) { }
      types.push(typexp)
      if (!p.consume(tk.BitOr)) { break }
    }

    // we should check if types.length is > 1, in which case we have a tagged union
    // scope.addDeclaration(new ast.TypeDeclaration(id, types))

    // check here if we have template parameters

    // scope.addDeclaration(id, )
  }
})