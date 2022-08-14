import { augment } from "parser/helpers"
import * as ast from "parser/ast"
import * as tk from "./token"

import { parse_templated_arguments } from "./templates"
import { Parser } from "parser/parser"
import { Scope } from "parser/ast/scope"
import { parse_variable_holder } from "./vars"

function parse_function(p: Parser, sc: Scope) {
  const ident = p.consumeIdent() ?? p.consumeIdent(ast.IdentKind.Comptime)
  const tpl = parse_templated_arguments(p)

  const args: ast.Variable[] = []
  // There are arguments !
  if (p.consume(tk.LParen)) {
    // parse arguments
    while (true) {
      if (p.consume(tk.RParen)) break
      // there is no ), so there has to be a variable-like declaration
      const va = parse_variable_holder(p, sc)
      args.push(va)
      p.consume(tk.Comma) // Consume a comma
    }
  }

  // There is a body !
  if (p.consume(tk.LBracket)) {
    const subscope = sc.subScope()
    const fndef = new ast.FnDefinition(ident, args, null)
    if (ident) subscope.addDeclaration(ident, fndef)

    // If there is an ident, this is the scope where we want to add it.

    return fndef
  } else {
    return new ast.FnDefinition(ident, args, null)
  }
}


augment(tk.Fn, {
  parseTopLevel(p, scope) {
    // const fn = new ast.FnDeclaration(ident)

    const fn = parse_function(p, scope)
    if (!fn.ident)
      p.reportError(fn.range, "top level function definitions must be named")
    else {
      scope.addDeclaration(fn.ident, fn)
    }
  },
  nud(p, scope) {
    const fn = parse_function(p, scope)
    return fn
  }
})