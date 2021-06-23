import * as ch from "chalk"
import type * as lsp from "./lsp"
import type { File } from "./scope"
import { Token } from "./lexer/token"
import { inspect } from "util"
import { Node } from "./ast"

function set_printer<K extends new (...a: any[]) => any>(k: K, fn: (this: InstanceType<K>) => void) {
  k.prototype[inspect.custom] = fn
}

set_printer(Token, function () {
  return `${this.value != null ? ch.green(`'${this.value}' `) : ""}${ch.grey(this.repr())} ${ch.blue(this.start.line+1)}:${ch.blueBright(this.start.character+1)}`
})


let LB = ch.grey("{ ")
let RB = ch.grey(" }")

set_printer(Node as any, function () {
  let prps: string[] = []
  for (let p of Object.getOwnPropertyNames(this)) {
    switch (p) {
      case "scope":
      case "range":
        continue
    }
    prps.push(inspect(this[p], false, null, true))
  }
  return `${LB}${ch.red(this.constructor.name)}${prps.length ? " " + prps.join(" ") : ""}${RB}`
})


export function printDiagnostic(file: File, diag: lsp.Diagnostic) {
  console.log(`  ${ch.grey(file.uri)} ${ch.green(diag.range.start.line + 1)} ${diag.message}`)
}
