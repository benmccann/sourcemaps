/**
 * FastStringArray acts like a `Set` (allowing only one occurrence of a string
 * `key`), but provides the index of the `key` in the backing array.
 *
 * This is designed to allow synchronizing a second array with the contents of
 * the backing array, like how `sourcesContent[i]` is the source content
 * associated with `source[i]`, and there are never duplicates.
 */
export class FastStringArray {
  indexes = Object.create(null) as { [key: string]: number };
  array = [] as ReadonlyArray<string>;
}

/**
 * Puts `key` into the backing array, if it is not already present. Returns
 * the index of the `key` in the backing array.
 */
export function put(strarr: FastStringArray, key: string): number {
  const { array, indexes } = strarr;
  // The key may or may not be present. If it is present, it's a number.
  let index = indexes[key] as number | undefined;

  // If it's not yet present, we need to insert it and track the index in the
  // indexes.
  if (index === undefined) {
    index = indexes[key] = array.length;
    (array as string[]).push(key);
  }

  return index;
}

