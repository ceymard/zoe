import type { } from "./ir"
import { Ranged } from "src/parser/range"

export class TypeDef extends Ranged {

}

/** Will be replaced by the definition once scopes and such become available */
export class TypeRefDef extends TypeDef {

}


export class UnionTypeDef extends TypeDef {

}


export class TraitTypeDef extends TypeDef {

}


export class StructureTypeDef extends TypeDef {

}


export class FunctionProtoTypeDef extends TypeDef {
  args: TypeDef[] = []
  return_type: TypeDef = null!
}
