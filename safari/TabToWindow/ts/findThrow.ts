export const findThrow = <T>(
  array: Readonly<T[]>,
  predicate: (value: T) => boolean,
  message = "Item not found",
) => {
  const found = array.find(predicate);
  if (found === undefined) {
    throw new Error(message);
  }
  return found;
};
