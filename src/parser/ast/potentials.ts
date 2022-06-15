/**
 * In this module, we answer the question whether a Node represents different kind of expressions,
 * before even trying to resolve them.
 *
 */

import { augment } from "parser/helpers"
import * as ast from "./ast"

augment(ast.ImportAs, {
  isPotentialTypeExpression() {
    return this.sub_ident?.isPotentialTypeExpression() ?? this.name.isPotentialTypeExpression()
  }
})

augment(ast.Dot, {
  isPotentialComptimeExp() {
    return this.right.isPotentialComptimeExp()
  }
})
