---
title: Iterables
sidebar_position: 4
---

# Iterables

Array and list utility functions ported from Python Manim's `utils/iterables.py`. These provide common operations for working with arrays, tuples, and sequences throughout the codebase.

```ts
import {
  adjacentNTuples,
  adjacentPairs,
  resizeArray,
  removeListRedundancies,
  listify,
} from "manim-ts";
```

## Tuple Functions

### `adjacentNTuples<T>(items: T[], n: number): T[][]`

Returns sliding windows of size `n` over the array. Each tuple contains `n` consecutive elements.

```ts
adjacentNTuples([1, 2, 3, 4, 5], 2);
// => [[1, 2], [2, 3], [3, 4], [4, 5]]

adjacentNTuples([1, 2, 3, 4, 5], 3);
// => [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
```

### `adjacentPairs<T>(items: T[]): [T, T][]`

Shorthand for `adjacentNTuples(items, 2)`. Returns consecutive pairs.

```ts
adjacentPairs(["a", "b", "c", "d"]);
// => [["a", "b"], ["b", "c"], ["c", "d"]]
```

### `batchByProperty<T, P>(items: T[], propertyFunc: (item: T) => P): [T[], P][]`

Groups consecutive items that share the same property value. Returns an array of `[group, propertyValue]` tuples.

```ts
const items = [
  { name: "a", type: "circle" },
  { name: "b", type: "circle" },
  { name: "c", type: "square" },
  { name: "d", type: "square" },
  { name: "e", type: "circle" },
];

batchByProperty(items, (item) => item.type);
// => [
//   [["a", "b"], "circle"],
//   [["c", "d"], "square"],
//   [["e"], "circle"],
// ]
```

## List Operations

### `listDifferenceUpdate<T>(list: T[], toRemove: T[]): T[]`

Returns a new array with elements from `toRemove` removed, preserving order. Uses reference equality.

```ts
listDifferenceUpdate([1, 2, 3, 4, 5], [2, 4]);
// => [1, 3, 5]
```

### `listUpdate<T>(list: T[], toAdd: T[]): T[]`

Returns a new array with elements from `toAdd` appended, but only if they are not already present.

```ts
listUpdate([1, 2, 3], [3, 4, 5]);
// => [1, 2, 3, 4, 5]
```

### `concatenateLists<T>(...lists: T[][]): T[]`

Concatenates multiple arrays into a single array.

```ts
concatenateLists([1, 2], [3, 4], [5, 6]);
// => [1, 2, 3, 4, 5, 6]
```

### `removeListRedundancies<T>(list: T[]): T[]`

Returns a new array with duplicate elements removed, keeping the first occurrence. Preserves order.

```ts
removeListRedundancies([1, 2, 3, 2, 1, 4]);
// => [1, 2, 3, 4]
```

### `removeNones<T>(list: (T | null | undefined)[]): T[]`

Filters out `null` and `undefined` values from an array.

```ts
removeNones([1, null, 2, undefined, 3]);
// => [1, 2, 3]
```

## Resizing Functions

### `resizeArray<T>(array: T[], length: number): T[]`

Resizes an array to the specified length. If shorter, truncates. If longer, repeats the last element.

```ts
resizeArray([1, 2, 3], 5);
// => [1, 2, 3, 3, 3]

resizeArray([1, 2, 3, 4, 5], 3);
// => [1, 2, 3]
```

### `resizePreservingOrder<T>(array: T[], length: number): T[]`

Resizes an array while distributing elements evenly to preserve the overall pattern. New elements are duplicated from nearby existing elements.

```ts
resizePreservingOrder([1, 2, 3], 6);
// => [1, 1, 2, 2, 3, 3]
```

### `resizeWithInterpolation(array: NDArray, length: number): NDArray`

Resizes a numerical array using linear interpolation. Used for resizing point arrays (e.g., when matching the number of bezier curves between two mobjects).

```ts
// Resize a 3-point array to 5 points with interpolation
resizeWithInterpolation(np.array([0, 5, 10]), 5);
// => [0, 2.5, 5, 7.5, 10]
```

### `stretchArrayToLength<T>(array: T[], length: number): T[]`

Stretches an array to a target length by evenly distributing duplicates.

```ts
stretchArrayToLength([1, 2, 3], 7);
// => [1, 1, 1, 2, 2, 3, 3]
```

### `makeEven(arrayOrIterator: any[]): any[]`

Ensures an array has an even number of elements by duplicating the last element if necessary.

```ts
makeEven([1, 2, 3]);
// => [1, 2, 3, 3]

makeEven([1, 2, 3, 4]);
// => [1, 2, 3, 4] (already even)
```

### `makeEvenByCycling(array: any[]): any[]`

Ensures an array has an even number of elements by cycling from the beginning.

```ts
makeEvenByCycling([1, 2, 3]);
// => [1, 2, 3, 1]
```

## Utility Functions

### `hashObj(obj: any): string`

Returns a string hash of an object. Used for caching and comparison.

```ts
hashObj({ x: 1, y: 2 });  // => deterministic string hash
```

### `uniqChain<T>(...arrays: T[][]): T[]`

Concatenates multiple arrays and removes duplicates.

```ts
uniqChain([1, 2], [2, 3], [3, 4]);
// => [1, 2, 3, 4]
```

### `listify<T>(value: T | T[]): T[]`

Wraps a value in an array if it is not already an array. If the value is already an array, returns it unchanged.

```ts
listify(5);       // => [5]
listify([5, 6]);  // => [5, 6]
```

### `tuplify<T>(value: T | [T]): [T]`

Similar to `listify`, but specifically for single-element tuples.

```ts
tuplify(5);    // => [5]
tuplify([5]);  // => [5]
```
