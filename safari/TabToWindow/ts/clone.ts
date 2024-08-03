/**
 * Creates a deep copy of an object or array (no references to existing objects)
 * WARNING: This is designed for making deep copies of plain data, it does not handle circular dependencies.
 * It also does not handle Date objects, Map, Set, symbols etc
 *
 * @param src object or array to be cloned
 * @returns a deep copy of `src`
 */
export const clone = <T>(src: T): T => {
  // handle primitive
  const isObject = src instanceof Object;
  const isArray = Array.isArray(src);

  if (src === undefined || src === null || (!isObject && !isArray)) {
    return src;
  }

  // handle array
  if (isArray) {
    return src.map<unknown>((value) => clone(value)) as unknown as T;
  }

  // handle object
  if (isObject) {
    const copy = Object.fromEntries(
      Object.entries(src).map(([key, value]) => [key, clone(value)]),
    ) as T;

    return copy;
  }

  throw new TypeError("Cloning does not support this type");
};
