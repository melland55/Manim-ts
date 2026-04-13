import { describe, it, expect } from "vitest";
import { flattenIterableParameters } from "../../src/utils/parameter_parsing/index.js";

describe("flattenIterableParameters", () => {
  it("returns flat list unchanged", () => {
    const result = flattenIterableParameters([1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  it("flattens nested arrays one level deep", () => {
    const result = flattenIterableParameters([[1, 2], [3, 4]]);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it("flattens mixed scalars and arrays", () => {
    const result = flattenIterableParameters<number>([1, [2, 3], 4, [5]]);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles an empty outer iterable", () => {
    const result = flattenIterableParameters([]);
    expect(result).toEqual([]);
  });

  it("handles nested empty arrays", () => {
    const result = flattenIterableParameters([[], [], []]);
    expect(result).toEqual([]);
  });

  it("handles a single-element nested array", () => {
    const result = flattenIterableParameters([[42]]);
    expect(result).toEqual([42]);
  });

  it("accepts a generator as the outer iterable", () => {
    function* gen(): Generator<number[]> {
      yield [1, 2];
      yield [3, 4];
    }
    const result = flattenIterableParameters(gen());
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it("accepts a generator as an inner iterable", () => {
    function* inner(): Generator<number> {
      yield 10;
      yield 20;
    }
    const result = flattenIterableParameters<number>([inner(), 30]);
    expect(result).toEqual([10, 20, 30]);
  });

  it("works with string elements treated as non-iterable scalars", () => {
    // Strings should NOT be spread character-by-character
    const result = flattenIterableParameters(["hello", "world"]);
    expect(result).toEqual(["hello", "world"]);
  });

  it("preserves order across mixed nesting", () => {
    const result = flattenIterableParameters<number>([[3, 1], 4, [1, 5], 9]);
    expect(result).toEqual([3, 1, 4, 1, 5, 9]);
  });
});
