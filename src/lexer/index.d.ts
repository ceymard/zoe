import { Token } from "./token"
import { T } from "./token-gen"
import * as lsp from "../lsp"

export function lex(str: string, from_pos: lsp.Position): Token
