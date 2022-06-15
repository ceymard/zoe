import { augment } from "parser/helpers"
import * as ast from "parser/ast"
import * as tk from "./token"
import { Parser } from "parser/parser"
import { Scope } from "parser/ast/scope"

// Function called by var, const, but also by fn arguments and struct members
export function parse_variable_holder(p: Parser): ast.Variable | null {
  // first, lookup an identifier
  const id = p.expect(tk.Ident)
  if (!id?.is(tk.Ident)) return null
  const res = new ast.Variable(id.nud(p) as ast.Ident)

  // then, try to see if there is a defined type
  if (p.consume(tk.Colon)) {
    // The expression should be above assign to avoid parsing it
    const type_expression = p.expression(tk.prio_above_assign)

    // We should probably check here that this is a valid type expression
    res.type_expression = type_expression
    res.range.extend(type_expression.range)
    // parse the type
  }

  // then, try to see if there is a default expression
  if (p.consume(tk.Assign)) {
    const def = p.expression(0)
    res.default_expression = def
    res.range.extend(def.range)
  }

  return res
}

augment(tk.Const, {
  parseTopLevel(p, scope) {
    parse_variable_holder(p)
  }
})

augment(tk.Var, {
  parseTopLevel(p, scope) {
    parse_variable_holder(p)
  }
})