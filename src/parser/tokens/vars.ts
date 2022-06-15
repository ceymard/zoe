import { augment } from "parser/helpers"
import { Parser } from "parser/parser"
import * as ast from "parser/ast"
import * as tk from "./token"

declare module "parser" {
  interface Parser {
    parse_variable_declaration(): ast.Node
    try_parse_variable_declaration(): ast.Node | null
  }
}

augment(Parser, {
  parse_variable_declaration() {
    const tk = this.next()
    // if tk is not ident, should we fail spectacularly ?
    return ast.Unexpected()
  }
})
