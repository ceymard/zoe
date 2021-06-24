
import * as lsp from "../lsp"
// import type { File } from "../scope"
import { T, token_names } from "./token-gen"

export class Token {
  public constructor(
    public kind: T,
    public start: lsp.Position,
    public end: lsp.Position,
    public value: string,
  ) { }

  isSkippable() {
    return this.kind === T.Comment || this.kind === T.Space
  }

  getRange() { return new lsp.Range(this.start, this.end) }

  repr(): string { return token_names[this.kind] }

}


/** Should I parse */
export class Token2 extends lsp.Range {

  nud() { }
  led() { }
}

export class ValueToken extends Token2 {
  constructor(start: lsp.Position, end: lsp.Position, public value: string) { super(start, end) }
}