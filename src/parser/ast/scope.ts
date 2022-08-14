import * as ast from "./ast"

export class Scope extends Map<string, ast.Node> {

  statements: ast.Statement[] = []

  constructor(public parent: Scope | null = null) { super() }

  subScope() {
    return new Scope(this)
  }

  get(symbol: string): ast.Node | undefined {
    const local = super.get(symbol)
    if (local != null) return local
    return this.parent?.get(symbol)
  }

  addDeclaration(name: ast.Ident, decl: ast.Statement) {
    if (name.isBogus()) return // do not add bogus names
    this.set(name.value, decl)
    this.statements.push(decl)
  }
}