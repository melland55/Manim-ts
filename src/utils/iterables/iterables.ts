/**
 * Operations on iterables.
 *
 * TypeScript port of manim/utils/iterables.py
 */

import { np } from "../../core/math/index.js";
import type { NDArray } from "../../core/math/index.js";

// ─── Adjacent tuples ─────────────────────────────────────────

/**
 * Returns the Sequence objects cyclically split into n-length tuples.
 *
 * @example
 * [...adjacentNTuples([1, 2, 3, 4], 2)]
 * // [[1,2],[2,3],[3,4],[4,1]]
 */
export function adjacentNTuples<T>(objects: T[], n: int): Array<T[]> {
  const result: Array<T[]> = [];
  const len = objects.length;
  for (let i = 0; i < len; i++) {
    const tuple: T[] = [];
    for (let k = 0; k < n; k++) {
      tuple.push(objects[(i + k) % len]);
    }
    result.push(tuple);
  }
  return result;
}

// Satisfy TypeScript — int is just number
type int = number;

/**
 * Alias for ``adjacentNTuples(objects, 2)``.
 *
 * @example
 * [...adjacentPairs([1, 2, 3, 4])]
 * // [[1,2],[2,3],[3,4],[4,1]]
 */
export function adjacentPairs<T>(objects: T[]): Array<[T, T]> {
  return adjacentNTuples(objects, 2) as Array<[T, T]>;
}

// ─── Type checks ─────────────────────────────────────────────

/**
 * Returns true if all elements of iterable are instances of Class.
 */
export function allElementsAreInstances(
  iterable: Iterable<unknown>,
  Class: new (...args: unknown[]) => unknown,
): boolean {
  for (const e of iterable) {
    if (!(e instanceof Class)) return false;
  }
  return true;
}

// ─── Batch by property ───────────────────────────────────────

/**
 * Groups items into consecutive batches sharing the same property value.
 * Order is preserved; chaining all batches recreates the original sequence.
 *
 * @example
 * batchByProperty([[1,2],[3,4],[5,6,7],[8,9]], x => x.length)
 * // [ [[[1,2],[3,4]], 2], [[[5,6,7]], 3], [[[8,9]], 2] ]
 */
export function batchByProperty<T, U>(
  items: Iterable<T>,
  propertyFunc: (item: T) => U,
): Array<[T[], U | null]> {
  const result: Array<[T[], U | null]> = [];
  let currBatch: T[] = [];
  let currProp: U | null = null;
  let first = true;

  for (const item of items) {
    const prop = propertyFunc(item);
    if (first || prop !== currProp) {
      if (!first && currBatch.length > 0) {
        result.push([currBatch, currProp]);
      }
      currProp = prop;
      currBatch = [item];
      first = false;
    } else {
      currBatch.push(item);
    }
  }
  if (currBatch.length > 0) {
    result.push([currBatch, currProp]);
  }
  return result;
}

// ─── List operations ─────────────────────────────────────────

/**
 * Combines the provided Iterables into one flat list.
 *
 * @example
 * concatenateLists([1,2],[3,4],[5]) // [1,2,3,4,5]
 */
export function concatenateLists<T>(...listOfLists: Iterable<T>[]): T[] {
  const result: T[] = [];
  for (const lst of listOfLists) {
    for (const item of lst) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Returns a list of all elements in l1 that are not in l2.
 *
 * @example
 * listDifferenceUpdate([1,2,3,4],[2,4]) // [1,3]
 */
export function listDifferenceUpdate<T>(l1: Iterable<T>, l2: Iterable<T>): T[] {
  const exclude = new Set(l2);
  return [...l1].filter((e) => !exclude.has(e));
}

/**
 * Returns l1 with elements that appear in l2 removed, then l2 appended.
 * Preserves order; removes overlap from l1 not l2.
 *
 * @example
 * listUpdate([1,2,3],[2,4,4]) // [1,3,2,4,4]
 */
export function listUpdate<T>(l1: Iterable<T>, l2: Iterable<T>): T[] {
  const l2Array = [...l2];
  const l2Set = new Set(l2Array);
  return [...l1].filter((e) => !l2Set.has(e)).concat(l2Array);
}

// ─── Listify / Tuplify ───────────────────────────────────────

/**
 * Converts obj to an array intelligently.
 * - string → [string] (not split into chars)
 * - Iterable → Array.from(iterable)
 * - anything else → [obj]
 *
 * @example
 * listify("str")  // ["str"]
 * listify([1,2])  // [1,2]
 * listify(42)     // [42]
 */
export function listify<T>(obj: string | Iterable<T> | T): string[] | T[] {
  if (typeof obj === "string") {
    return [obj];
  }
  if (obj != null && typeof (obj as Iterable<T>)[Symbol.iterator] === "function") {
    return [...(obj as Iterable<T>)];
  }
  return [obj as T];
}

/**
 * Converts obj to a tuple (readonly array) intelligently.
 * - string → [string] (not split into chars)
 * - Iterable → tuple of elements
 * - anything else → [obj]
 *
 * @example
 * tuplify("str")  // ["str"]
 * tuplify([1,2])  // [1,2]
 * tuplify(42)     // [42]
 */
export function tuplify<T>(obj: string | Iterable<T> | T): readonly string[] | readonly T[] {
  if (typeof obj === "string") {
    return [obj] as readonly string[];
  }
  if (obj != null && typeof (obj as Iterable<T>)[Symbol.iterator] === "function") {
    return [...(obj as Iterable<T>)] as readonly T[];
  }
  return [obj as T] as readonly T[];
}

// ─── Make even ───────────────────────────────────────────────

/**
 * Extends the shorter of the two arrays until both have the same length.
 * Favours earlier elements (no cycling).
 *
 * @example
 * makeEven([1,2],[3,4,5,6]) // [[1,1,2,2],[3,4,5,6]]
 */
export function makeEven<T, U>(
  iterable1: Iterable<T>,
  iterable2: Iterable<U>,
): [T[], U[]] {
  const list1 = [...iterable1];
  const list2 = [...iterable2];
  const len1 = list1.length;
  const len2 = list2.length;
  const length = Math.max(len1, len2);
  return [
    Array.from({ length }, (_, n) => list1[Math.floor((n * len1) / length)]),
    Array.from({ length }, (_, n) => list2[Math.floor((n * len2) / length)]),
  ];
}

/**
 * Extends the shorter of the two arrays by cycling its elements.
 *
 * @example
 * makeEvenByCycling([1,2],[3,4,5,6]) // [[1,2,1,2],[3,4,5,6]]
 */
export function makeEvenByCycling<T, U>(
  iterable1: Iterable<T>,
  iterable2: Iterable<U>,
): [T[], U[]] {
  const arr1 = [...iterable1];
  const arr2 = [...iterable2];
  const length = Math.max(arr1.length, arr2.length);
  if (arr1.length === 0 || arr2.length === 0) {
    return [
      Array.from({ length: arr1.length === 0 ? 0 : length }, (_, i) => arr1[i % arr1.length]),
      Array.from({ length: arr2.length === 0 ? 0 : length }, (_, i) => arr2[i % arr2.length]),
    ];
  }
  return [
    Array.from({ length }, (_, i) => arr1[i % arr1.length]),
    Array.from({ length }, (_, i) => arr2[i % arr2.length]),
  ];
}

// ─── Remove redundancies / nones ─────────────────────────────

/**
 * Like `Array.from(new Set(lst))` but keeps the LAST occurrence of each element.
 */
export function removeListRedundancies<T>(lst: T[]): T[] {
  const used = new Set<T>();
  const reversed: T[] = [];
  for (let i = lst.length - 1; i >= 0; i--) {
    const x = lst[i];
    if (!used.has(x)) {
      reversed.push(x);
      used.add(x);
    }
  }
  reversed.reverse();
  return reversed;
}

/**
 * Removes falsy elements (null, undefined, 0, "", false, NaN).
 *
 * @example
 * removeNones(["m","",42,false,true]) // ["m",42,true]
 */
export function removeNones<T>(sequence: Iterable<T | null | undefined | false | 0 | "">): T[] {
  return [...sequence].filter(Boolean) as T[];
}

// ─── Array resizing ──────────────────────────────────────────

/**
 * Extends/truncates an NDArray so that ``result.shape[0] === length``.
 * Elements are cycled to fill (uses np.resize semantics).
 *
 * @example
 * resizeArray(np.array([[1,2],[3,4]]), 3)
 * // [[1,2],[3,4],[1,2]]
 */
export function resizeArray(nparray: NDArray, length: int): NDArray {
  if (nparray.shape[0] === length) return nparray;
  const shape = [length, ...nparray.shape.slice(1)];
  return np.resize(nparray, shape);
}

/**
 * Extends/truncates an NDArray so that ``result.shape[0] === length``.
 * Elements are duplicated favouring earlier ones (no cycling).
 * Returns a zeros array of the given length when the input is empty.
 *
 * @example
 * resizePreservingOrder(np.array([[1,2],[3,4]]), 3)
 * // [[1,2],[1,2],[3,4]]
 */
export function resizePreservingOrder(nparray: NDArray, length: int): NDArray {
  if (nparray.shape[0] === 0) {
    return np.zeros([length, ...nparray.shape.slice(1)]);
  }
  if (nparray.shape[0] === length) return nparray;
  const n = nparray.shape[0];
  const indices: number[] = Array.from({ length }, (_, i) => Math.floor((i * n) / length));
  return np.take(nparray, indices, 0);
}

/**
 * Extends/truncates an NDArray to the given length using linear interpolation.
 *
 * @example
 * resizeWithInterpolation(np.array([[1,2],[3,4]]), 4)
 * // [[1,2],[1.667,2.667],[2.333,3.333],[3,4]]
 */
export function resizeWithInterpolation(nparray: NDArray, length: int): NDArray {
  if (nparray.shape[0] === length) return nparray;
  const n = nparray.shape[0];
  const contIndices = np.linspace(0, n - 1, length);
  const ciArray = contIndices.toArray() as number[];
  const rows: NDArray[] = [];
  for (let i = 0; i < length; i++) {
    const ci = ciArray[i];
    const lh = Math.floor(ci);
    const rh = Math.ceil(ci);
    const a = ci % 1;
    // Extract rows via np.take along axis 0
    const lower = np.take(nparray, [lh], 0);  // shape [1, ...]
    const upper = np.take(nparray, [rh], 0);  // shape [1, ...]
    // (1 - a) * lower + a * upper, squeeze back to row shape
    const row = np.take(
      np.vstack([
        lower.multiply(1 - a).add(upper.multiply(a)),
      ]),
      [0],
      0,
    );
    rows.push(row);
  }
  return np.vstack(rows);
}

/**
 * Stretches an NDArray to the given length by repeating earlier elements.
 * Raises a warning if length is shorter than the current length.
 *
 * @example
 * stretchArrayToLength(np.array([[1,2],[3,4],[5,6]]), 6)
 */
export function stretchArrayToLength(nparray: NDArray, length: int): NDArray {
  const currLen = nparray.shape[0];
  if (currLen > length) {
    console.warn("Trying to stretch array to a length shorter than its own");
  }
  const indices: number[] = Array.from({ length }, (_, i) => Math.floor((i / length) * currLen));
  return np.take(nparray, indices, 0);
}

// ─── Unique chaining ─────────────────────────────────────────

/**
 * Returns an array of all unique elements from the provided iterables,
 * preserving first-occurrence order.
 *
 * @example
 * uniqChain([1,2],[2,3],[1,4,4]) // [1,2,3,4]
 */
export function uniqChain<T>(...args: Iterable<T>[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const iterable of args) {
    for (const x of iterable) {
      if (!seen.has(x)) {
        seen.add(x);
        result.push(x);
      }
    }
  }
  return result;
}

// ─── Hash ─────────────────────────────────────────────────────

/**
 * Determines a hash for potentially mutable objects by recursively
 * hashing their contents. Returns a numeric hash value.
 */
export function hashObj(obj: unknown): number {
  if (obj === null || obj === undefined) {
    return 0;
  }
  if (obj instanceof Map) {
    const entries = [...obj.entries()].map(([k, v]) => hashObj(k) * 31 + hashObj(v));
    entries.sort();
    return entries.reduce((acc, h) => (acc * 31 + h) | 0, 17);
  }
  if (obj instanceof Set) {
    const hashes = [...obj].map(hashObj).sort();
    return hashes.reduce((acc, h) => (acc * 31 + h) | 0, 19);
  }
  if (Array.isArray(obj)) {
    return obj.reduce((acc: number, e) => (acc * 31 + hashObj(e)) | 0, 23);
  }
  if (typeof obj === "string") {
    let h = 0;
    for (let i = 0; i < obj.length; i++) {
      h = (Math.imul(31, h) + obj.charCodeAt(i)) | 0;
    }
    return h;
  }
  if (typeof obj === "number") {
    return obj | 0;
  }
  if (typeof obj === "boolean") {
    return obj ? 1 : 0;
  }
  // Fallback: hash the JSON representation
  return hashObj(JSON.stringify(obj));
}
