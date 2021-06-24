
import { Lexer } from "./lexer"
import { Token } from "./lexer/token"
import { T } from "./lexer/token-gen"
import { File } from "./scope"
import { ErrorNode } from "./ast"

/**
 * The base class that exposes the parsing infrastructure, but not the grammar.
 */
export class ParserBase {

  last_token!: Token
  rewound = false

  constructor(
    public file: File,
    contents: string,
  ) {
    this.lexer = new Lexer(contents)
  }

  lexer: Lexer

  reset() {
    this.last_token = undefined!
    this.rewound = false
  }

  /** The next call to next() will return the same token as last time */
  rewind() {
    this.rewound = true
  }

  peekExpect(kind: T) {
    let p = this.peek()
    if (p.kind !== kind)
      this.file.report(p, `expected '${p.repr()}'`)
  }

  peekKind(kind: T): boolean {
    let p = this.peek()
    return p.kind === kind
  }

  peek(): Token {
    let nxt = this.next()
    this.rewind()
    return nxt
  }

  expect<N>(kind: T): boolean
  expect<N>(kind: T, fn: (tk: Token) => N): N | ErrorNode
  expect<N>(kind: T, fn?: (tk: Token) => N): N | ErrorNode | void | boolean {
    let n = this.next()
    if (n.kind !== kind) {
      let message = `expected '${n.repr()}'`
      this.file.report(n, message)
      if (fn) return new ErrorNode(n, message)
      return
    }
    if (fn) { return fn(n) } else { return true }
  }

  /** Will advance the parser if the next token if of kind `kind` and optionally return the callback */
  consume(kind: T): Token | undefined
  consume<N>(kind: T, fn: (tk: Token) => N): N | undefined
  consume<N>(kind: T, fn?: (tk: Token) => N): N | Token | undefined {
    let n = this.next()
    if (n.kind !== kind) {
      this.rewind()
      return
    }
    return fn ? fn(n) : n
  }

  commit() {
    this.next()
  }

  /** Gets the next *meaningful* token */
  next(): Token {
    if (this.rewound) {
      this.rewound = false
      return this.last_token
    }

    let tk: Token
    while ((tk = this.lexer.next())) {
      if (!tk.isSkippable()) break
    }
    this.last_token = tk

    // FIXME add some contextual tokenizing ?
    return tk
  }

}
