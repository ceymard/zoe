import { Range as IRange, Position as IPosition } from "vscode-languageserver"

export class Position implements IPosition {
  public constructor(public line: number, public character: number) { }
}

export class Ranged {
  range: Range = new Range
  extendRange(rng?: Ranged | null | undefined) { if(rng) this.range.extend(rng.range); return this }
}

export class Range implements IRange {

  constructor(
    public start: Position = new Position(-1, -1),
    public end: Position = new Position(-1, -1),
  ) { }

  clone(): Range {
    return new Range(
      new Position(this.start.line, this.start.character),
      new Position(this.end.line, this.end.character)
    )
  }

  extend(rng: Range) {

    if (this.start.line === -1) {
      this.start.line = rng.start.line
      this.start.character = rng.start.character
      this.end.line = rng.end.line
      this.end.character = rng.end.character
      return
    }

    if (this.start.line > rng.start.line) {
      this.start.line = rng.start.line
      this.start.character = rng.start.character
    } else if (this.start.line === rng.start.line) {
      this.start.character = Math.min(this.start.character, rng.start.character)
    }

    if (this.end.line < rng.end.line) {
      this.end.line = rng.end.line
      this.end.character = rng.end.character
    } else if (this.end.line === rng.end.line) {
      this.end.character = Math.max(this.end.character, rng.end.character)
    }

  }

}
