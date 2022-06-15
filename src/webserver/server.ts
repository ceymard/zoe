#!/usr/bin/env node

import * as fs from "fs"
import * as pth from "path"
import Koa from "koa"
import Router from "koa-router"

let appjs = ""
const appjspth = pth.join(__dirname, "client.js")
function readappjs() {
  console.log("reloading client.js")
  appjs = fs.readFileSync(appjspth, "utf-8")
}
fs.watchFile(appjspth, (st) => {
  if (st.isFile())
    readappjs()
})
readappjs()

const app = new Koa()
const rt = new Router()

rt.get("index", "/", ctx => {
  ctx.body = `<html>
  <title>Zoe test page</title>
  <meta charset="utf-8">
<body>
  <script src="/client.js"></script>
</body>
</html>`
})

rt.get("appjs", "/client.js", ctx => {
  ctx.body = appjs
})

const root = pth.normalize(pth.join(__dirname, "../tests"))
rt.get("fs", "/fs/:path(.*)", async ctx => {
  const p = pth.join(root, ctx.params.path ?? "")
  const st = fs.statSync(p)
  if (st.isDirectory()) {
    console.log(`  * [dir] requesting directory ${p}`)
    let contents = fs.readdirSync(p)
    const directories: string[] = []
    const files: string[] = []
    for (let f of contents) {
      if (fs.statSync(pth.join(p, f)).isDirectory()) {
        directories.push(f)
      } else {
        files.push(f)
      }
    }
    ctx.body = JSON.stringify({directories, files})
    ctx.type = "application/json"
  } else {
    console.log(`  * requesting file ${p}`)
    ctx.type = "text/plain"
    ctx.body = fs.readFileSync(p, "utf-8")
  }
})

app.use(rt.routes())
app.listen(8080)
