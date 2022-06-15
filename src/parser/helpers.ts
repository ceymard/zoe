
/**
 * Augment a class by redefining methods on its prototype
 */
export function augment<Kls extends new (...a: any) => any>(
  proto: Kls,
  ...methods: {[K in keyof InstanceType<Kls>]?:
    InstanceType<Kls>[K] extends Function ?
      (this: InstanceType<Kls>, ...args: Parameters<InstanceType<Kls>[K]>) => ReturnType<InstanceType<Kls>[K]>
    : InstanceType<Kls>[K]}[]
) {
  for (let m of methods) {
    for (let key in m) {
      proto.prototype[key] = m[key]
    }
  }
}
