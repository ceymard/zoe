import * as ast from "./node"

export class Block {
  statements: ast.Statement[] = []

  addStatement(stmt: ast.Statement) {
    this.statements.push(stmt)
    return this
  }
}
