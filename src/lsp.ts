
export type DocumentURI = string

export interface Ranged {
  getRange(): Range
}

export class Position {
  constructor(public line: number, public character: number, public offset: number) { }

  getRange() {
    return new Range(this, new Position(this.line, this.character + 1, this.offset + 1))
  }

  /** used to communicate with LSP */
  toJSON(): string {
    return `{"line":${this.line},"character":${this.character}}`
  }

  min(other: Position) {
    if (other.line < this.line || other.line === this.line && other.character < this.character) return other
    return this
  }

  max(other: Position) {
    if (other.line > this.line || other.line === this.line && other.character > this.character) return other
    return this
  }

}

export class Range {
  constructor(public start: Position, public end: Position) { }

  getRange() { return this }

  extend(...pos: Position[]) {
    for (let p of pos) {
      this.start = this.start.min(p)
      this.end = this.end.max(p)
    }
  }

  getText(str: string) {
    return str.slice(this.start.offset, this.end.offset)
  }
}

export class Location {
  constructor(public uri: DocumentURI, public range: Range) { }
}

export const enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export const enum DiagnosticTag {
  Unnecessary = 1,
  Deprecated = 2,
}

export type CodeDescription = string

export class DiagnosticRelatedInformation {
  constructor(public location: Location, public message: string) { }
}

export interface SupplDiagnostics {
  data?: unknown
  tags?: DiagnosticTag[]
  code?: number | string
  codeDescription?: CodeDescription
  source?: string
  relatedInformation?: DiagnosticRelatedInformation[]
}

export class Diagnostic {
  data?: unknown
  tags?: DiagnosticTag[]
  source?: string
  code?: number | string
  codeDescription?: CodeDescription
  relatedInformation?: DiagnosticRelatedInformation[]

  constructor(
    public range: Range,
    public message: string,
    public severity: DiagnosticSeverity,
    suppl?: SupplDiagnostics
  ) {
    for (let prop in suppl) {
      (this as any)[prop] = suppl[prop as keyof typeof suppl]
    }
  }
}