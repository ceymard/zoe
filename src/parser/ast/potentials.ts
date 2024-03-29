/**
 * In this module, we answer the question whether a Node represents different kind of expressions,
 * before even trying to resolve them.
 *
 */

import { augment } from "src/parser/helpers"
import * as ast from "./ast"

augment(ast.ImportAs, {
  isPotentialTypeExpression() {
    return this.sub_ident?.isPotentialTypeExpression() ?? this.ident.isPotentialTypeExpression()
  }
})

augment(ast.Dot, {
  isPotentialComptimeExp() {
    return this.right.isPotentialComptimeExp()
  }
})
