import type { Declaration, Node } from "./ast"
import * as lsp from "./lsp"
import * as A from "./ast"
import { Token } from "./lexer/token"

export class Scope {

  decls = new Map<string, Declaration>()

  constructor(public file: File, public parent: Scope | null = null) { }

  subScope(): Scope {
    return new Scope(this.file, this)
  }

  register(id: A.Id, def: Declaration) {
    // do not register faulty ids
    if (id.is_an_error) return
    this.decls.set(id.value, def)
    return this
  }

  has(name: string): boolean {
    if (this.decls.has(name)) return true
    if (this.parent == null) return false
    return this.parent.has(name)
  }

  find(name: string): Declaration | null {
    let t1 = this.decls.get(name)
    if (t1) return t1
    if (!this.parent) return null
    return this.parent.find(name)
  }

  /** Resolve a dotted path to get back to the original declaration */
  resolve(node: Node): Declaration | null {
    return null
  }
}


export class File {
  doc_comments = new Map<A.Node, Token>()
  root_scope = new Scope(this)

  declarations: A.Declaration[] = []

  diagnostics: lsp.Diagnostic[] = []
  has_errors = false

  constructor(
    public uri: lsp.DocumentURI,
    public contents: string,
  ) { }

  getRangedText(
    rng: lsp.Ranged,
  ) {
    let r = rng.getRange()
    return this.contents.slice(r.start.offset, r.end.offset)
  }

  /** Report a diagnostic to either later print on terminal or to send back to the LSP client */
  report(
    rng: lsp.Ranged,
    message: string,
    severity: lsp.DiagnosticSeverity = lsp.DiagnosticSeverity.Error,
    suppl?: lsp.SupplDiagnostics)
  {
    if (severity === lsp.DiagnosticSeverity.Error) {
      this.has_errors = true
    }
    this.diagnostics.push(new lsp.Diagnostic(rng.getRange(), message, severity, suppl))
  }

}
