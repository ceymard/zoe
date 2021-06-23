import * as ch from "chalk"
import type * as lsp from "./lsp"
import type { File } from "./scope"
import type { Token } from "./lexer/token"


export function printToken(tk: Token) {
  console.log(`${tk.value != null ? ch.green(`'${tk.value}' `) : ""}${ch.grey(tk.repr())} ${ch.blue(tk.start.line+1)}:${ch.blueBright(tk.start.character+1)}`)
}

export function printDiagnostic(file: File, diag: lsp.Diagnostic) {
  console.log(`  ${ch.grey(file.uri)} ${ch.green(diag.range.start.line + 1)} ${diag.message}`)
}
