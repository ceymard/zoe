import { augment } from "src/parser/helpers"
import * as ast from "src/parser/ast"
import { Parser } from "src/parser/parser"
import * as tk from "./token"

// Function called by var, const, but also by fn arguments and struct members
export function parse_variable_holder(p: Parser, block: ast.Block): ast.Variable {
  // first, lookup an identifier
  const id = p.expectIdent()
  const res = new ast.Variable()

  // then, try to see if there is a defined type
  if (p.consume(tk.Colon)) {
    // The expression should be above assign to avoid parsing it
    const type_expression = p.expression(block, tk.prio_above_assign)

    // We should probably check here that this is a valid type expression
    res.type_expression = type_expression
    res.range.extend(type_expression.range)
    // parse the type
  }

  // then, try to see if there is a default expression
  if (p.consume(tk.Assign)) {
    const def = p.expression(block, 0)
    res.default_expression = def
    res.range.extend(def.range)
  }

  return res
}

augment(tk.Const, {
  parseTopLevel(p, scope) {
    const v = parse_variable_holder(p, scope)
    // scope.addDeclaration(v.name, v)
  }
})

augment(tk.Var, {
  parseTopLevel(p, scope) {
    const v = parse_variable_holder(p, scope)
    // scope.addDeclaration(v.name, v)
  }
})