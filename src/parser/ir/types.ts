import type { } from "./ir"
import { Ranged } from "src/parser/range"

export class Type extends Ranged {

}

/** Will be replaced by the definition once scopes and such become available */
export class TypeRef extends Type {

}


export class UnionType extends Type {

}


export class TraitType extends Type {

}


export class StructureType extends Type {

}


export class FunctionProtoType extends Type {
  args: Type[] = []
  return_type: Type = null!
}
