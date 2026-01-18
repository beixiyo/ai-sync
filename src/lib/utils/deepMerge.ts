/**
 * 判断值是否为对象类型（排除 null 和数组）
 *
 * @param value 要检查的值
 * @returns 如果是对象类型则返回 true，否则返回 false
 */
export function isObj(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 深度合并对象
 * 将源对象的属性深度合并到目标对象中，保留目标对象中源对象未包含的属性
 *
 * @param target 目标对象
 * @param mergeSource 源对象（要合并的对象）
 * @returns 合并后的新对象
 *
 * @example
 * ```ts
 * const target = { a: 1, b: { c: 2, d: 3 } }
 * const mergeSource = { b: { c: 4 } }
 * deepMerge(target, mergeSource) // { a: 1, b: { c: 4, d: 3 } }
 * ```
 *
 * @remarks
 * 本函数是用户提供的深度合并实现，具有以下特点：
 * - 只合并源对象的自有属性
 * - 跳过 undefined 值
 * - 深度合并嵌套对象（排除数组）
 * - 数组、基本类型和 null 直接替换
 * - 保留目标对象中源对象未包含的属性
 */
export function deepMerge<T extends Record<string, any>>(target: T, mergeSource: Partial<T>): T {
  const result = { ...target }

  for (const key in mergeSource) {
    /** 只检查自有属性，避免遍历原型链 */
    if (!Object.prototype.hasOwnProperty.call(mergeSource, key)) {
      continue
    }

    const sourceValue = mergeSource[key]

    /** 只跳过 undefined，null 是有效值应该被合并 */
    if (sourceValue === undefined) {
      continue
    }

    const targetValue = target[key]

    /** 处理对象类型的合并（排除数组和 null） */
    if (
      isObj(sourceValue)
      && !Array.isArray(sourceValue)
      && isObj(targetValue)
      && !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue)
    }
    else {
      /** 直接赋值（包括数组、基本类型、null） */
      result[key] = sourceValue as T[Extract<keyof T, string>]
    }
  }

  return result
}
