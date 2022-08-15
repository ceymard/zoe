import { setup_mutation_observer, o, IfResolved, Repeat, $observe, If, } from "elt"
import { Button, rule, style, Styling as S, theme, ColorTheme } from "elt-ui"
import * as tk from "../parser/tokens"
import { Parser } from "../parser/parser"
import * as a from "parser/ast"

// console.log("????")
let th = ColorTheme.fromColors({
  bg: "#fff",
  fg: "#3c3c3b",
  tint: "#458493",
  green: "#349A43",
  magenta: "#993399",
})

const BASE = "/fs"
const o_path = o((localStorage.path as string) ?? "/parsing")
const o_file_name = o((localStorage.filename as string) ?? "")

type Contents = {
  directories: string[]
  files: string[]
}

const o_dir_contents = o_path.tf(pth => {
  return fetch(`${BASE}/${pth}`).then(async r => await r.json() as Contents)
})

const o_file_contents = o.join(o_file_name, o_path).tf(([f, p]) => !f ? Promise.resolve("") :
  fetch(`${BASE}/${p}/${f}`).then(r => r.text())
)

const o_lexed = o_file_contents.tf(async _f => {
  let f = await _f
  if (!f) return []
  let res: tk.Token[] = []
  const p = new Parser(f)
  do {
    let n = p.next()
    res.push(n)
    if (n.isEof()) break
  } while (true)

  return res
})

const o_parsed = o_file_contents.tf(async _f => {
  let f = await _f
  const p = new Parser(f)
  const nodes = p.parseAll()
  // console.log(p.diagnostics)
  return { diagnostics: p.diagnostics, ast: nodes }
})


function display_token(token: tk.Token) {
  return <span style={{display: "inline-block"}} class={[stylemap.get(token.constructor as typeof tk.Token)]} title={`@${token.range.start?.line+1}:${token.range.start?.character+1} (${token.constructor.name})`}>{token.repr()}</span>
}

function obj_renderer(obj: any, indent = 0, pname: string = "") {
  if (!obj) return <div>null</div>
  function prop_renderer(key: string, v: any) {
    if (key === "parent") return
    if (!(v instanceof a.Node) && !(Array.isArray(v) && v[0] instanceof a.Node)) return null
    return Array.isArray(v) ? v.map((v, i) => obj_renderer(v, indent + 1, key + "[" + i + "]")) : obj_renderer(v, indent + 1, key)
  }

  return <div style={{marginLeft: `${indent?1:0}em`}}>
    <span class={stylemapast.get(obj.constructor)} title={obj?.constructor?.name ?? "null"}>
      {obj instanceof a.Literal ? obj.value : obj?.constructor?.name ?? "null"}
      <span class={css.prop}>{pname}</span>
    </span>
    {Object.keys(obj).map(o => prop_renderer(o, obj[o]))}
  </div>
}

setup_mutation_observer(document.body)

const stylemap = new Map<typeof tk.Token, string>()
const stylemapast = new Map<typeof a.Node, string>()

namespace css {
  export const keyword = style("keyword", S.text.bold.color(theme.tint))
  export const operator = style("operator", S.text.color(theme.fg50))
  export const error = style("error", S.text.color("red"))
  export const type = style("type", S.text.color("magenta"))
  export const trait = style("trait", S.text.color("darkorange"))
  export const prop = style("prop", S.text.color("#aaaaaa").size("0.75em").box.marginLeft("0.5em"))
  export const eof = style("eof", S.text.color("#ddd"))

  export const all_spaced = style("allspaced", {
    whiteSpace: "normal",
    width: "100%"
  })
  export const green = style("green", S.text.color(th.tint), th.green)
  export const magenta = style("magenta", S.text.color(th.tint), th.magenta)
  rule`${all_spaced} > *`({ marginRight: '8px' })
  // export const root =
}

add_style(css.keyword,
  tk.Var, tk.Const, tk.Struct, tk.Fn, tk.Import, tk.Export, tk.Extern, tk.Finally, tk.Try, tk.If, tk.Else, tk.Catch, tk.As, tk.While, tk.For, tk.Yield, tk.Return, tk.Is, tk.Type, tk.Trait, tk.Iso, tk.Extern, tk.Enum
)
add_style(css.green, tk.String, tk.StringPart, tk.StringEnd)
add_style(css.magenta, tk.Number, tk.True, tk.False, tk.Null, tk.This, tk.ErrorLiteral)
add_style(css.operator, tk.Plus, tk.Minus, tk.Mul, tk.Assign, tk.Arrow, tk.Dot, tk.Colon, tk.SemiColon)
add_style(css.error, tk.Unexpected)
add_style(css.type, tk.TypeIdent, tk.ComptimeTypeIdent)
add_style(css.trait, tk.TraitIdent, tk.StructTraitIdent)
add_style(css.eof, tk.Eof)

add_style_ast(css.green, a.String)
add_style_ast(css.magenta, a.True, a.False, a.Number)
add_style_ast(css.error, a.Unexpected)

function add_style(css_class: string, ...tks: (typeof tk.Token)[]) {
  for (let tk of tks) stylemap.set(tk, css_class)
}

function add_style_ast(css_class: string, ...ast: (new (...a: any[]) => a.Node)[]) {
  for (let tk of ast) stylemapast.set(tk, css_class)
}

document.body.appendChild(<div class={[S.box.fullScreen.flex.gappedRow(16).box.padding(16), th.getClass()]}>
  {$observe(o_path, pth => localStorage.path = pth)}
  {$observe(o_file_name, fil => localStorage.filename = fil)}
  <div class={S.flex.column}>{IfResolved(o_dir_contents, o_dir => <>
    <div class={S.flex.column}>
      {If(o_path.tf(p => !!p && p !== "/"), _ => <Button click={_ => o_path.set(o_path.get().replace(/\/[^]*$/, ''))}>..</Button>)}
      {Repeat(o_dir.p("directories"), o_dir => <Button click={_ => o_path.set(o_path.get() + "/" + o_dir.get())}>{o_dir}</Button>)}
    </div>
    <div class={S.flex.column}>{Repeat(o_dir.p("files"), o_file => <Button click={_ => o_file_name.set(o_file.get())}>{o_file}</Button>)}</div>
  </>)}</div>
  <div style={{overflow: "auto", fontFamily: "monospace"}} class={S.text.pre.flex.absoluteGrow(1).box}>{IfResolved(o_file_contents, o_f => o_f)}</div>
  <div style={{overflowY: "auto", flex: "3 0"}} class={[S.flex.gappedColumn(16)]}>
    {IfResolved(o_lexed, o_lexed => <div class={css.all_spaced}>
      {o_lexed.tf(l => l.map(tk => display_token(tk)))}
    </div>)}
    {IfResolved(o_parsed, o_p => <>
      {o_p.tf(p => {
        console.log(p.diagnostics)
        console.log(p.ast)
        return obj_renderer(p.ast)
      })}
      <div>{Repeat(o_p.p("diagnostics"), o_diag => <div>line {o_diag.tf(d => d.range.start?.line+1 ?? "??")}: {o_diag.p("message")}</div>)}</div>
    </>)}
  </div>
</div>)
