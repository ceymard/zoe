import { Token } from "./token"
// import { T } from "./token-gen"
// import * as lsp from "../lsp"

export class Lexer {
  constructor(str: string)
  next(): Token
  rewind(): void
}
// export function lex(str: string, from_pos: lsp.Position): Token
