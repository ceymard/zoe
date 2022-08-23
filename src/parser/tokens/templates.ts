/**
 *
 */

import { Parser } from "src/parser/parser"
import * as ast from "src/parser/ast"
import * as tk from "./token"

// Parse expressions like [$T #trait#Structrait, $U]
export function parse_templated_arguments(p: Parser): ast.TemplatedExpression | null {
  if (!p.consume(tk.LBrace)) return null //
  return null
}
