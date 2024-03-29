import * as fs from "fs"
import * as path from "path"

const cts = fs.readFileSync(path.join(__dirname, "./ast.ts"), "utf-8")
const re = /^(export class ([^{ ]+))|^  ([a-zA-Z0-9_$]+)!?: ([a-zA-Z0-9]+)(\[\])?.*?\/\/!(!)?/mg

let classname = ""
type Prop = { name: string, type: string, isArray: boolean, isNode: boolean }
let mp: {[name: string]: Prop[]} = {}
do {
  const match = re.exec(cts)
  if (!match) break
  if (match[1]) {
    classname = match[2]
    // console.log(classname)
  } else {
    let prop = match[3]
    let type = match[4]
    let is_array = !!match[5]
    let isNode = !match[6]
    // console.log("  ", prop, ": ", type, " - ", is_array);
    ;(mp[classname] ??= []).push({
      name: prop, type, isArray: is_array, isNode
    })
  }
} while (true)

const out = fs.createWriteStream(path.join(__dirname, "./ast-augment.ts"), "utf-8")

out.write(`
/* this file is auto-generated by "esr __mkaugments.ts", DO NOT EDIT */
import * as ast from "./ast"\n

declare module "./ast" {
`)

for (let classname in mp) {
  const props = mp[classname]
  out.write(`  interface ${classname} {\n`)
  for (let prop of props) {
    const cap = prop.name.replace(/(^|_)(\w)/g, (m, underscore, letter) => letter.toUpperCase())
    if (prop.isArray)
      out.write(`    add${cap.slice(0, -1)}(value: ${prop.type}): this\n`)
    else
      out.write(`    set${cap}(${prop.name}: ${prop.type}): this\n`)
  }
  out.write(`  }\n\n`)
  // console.log(classname, props)
}

out.write(`}\n\n`)


for (let classname in mp) {
  const props = mp[classname]
  for (let prop of props) {
    const cap = prop.name.replace(/(^|_)(\w)/g, (m, underscore, letter) => letter.toUpperCase())
    if (prop.isArray) {
      out.write(`ast.${classname}.prototype.add${cap.slice(0, -1)} = function (value) {\n  this.${prop.name}.push(value)\n`)
      if (prop.isNode) {
        out.write(`  value.setParent(this)\n`)
      }
      out.write(`  return this\n}\n\n`)
    } else {
      out.write(`ast.${classname}.prototype.set${cap} = function (value) {\n  this.${prop.name} = value\n`)
      if (prop.isNode) {
        out.write(`  value.setParent(this)\n`)
      }
      out.write(`  return this\n}\n\n`)
    }

  }
}

out.end()