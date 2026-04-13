import { describe, it, expect } from "vitest";
import { np } from "../../src/core/math/index.js";
import {
  adjacentNTuples,
  adjacentPairs,
  allElementsAreInstances,
  batchByProperty,
  concatenateLists,
  listDifferenceUpdate,
  listUpdate,
  listify,
  tuplify,
  makeEven,
  makeEvenByCycling,
  removeListRedundancies,
  removeNones,
  resizeArray,
  resizePreservingOrder,
  resizeWithInterpolation,
  stretchArrayToLength,
  uniqChain,
  hashObj,
} from "../../src/utils/iterables/index.js";

// ─── adjacentNTuples / adjacentPairs ─────────────────────────

describe("adjacentNTuples", () => {
  it("produces cyclic 2-tuples", () => {
    expect(adjacentNTuples([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1],
    ]);
  });

  it("produces cyclic 3-tuples", () => {
    expect(adjacentNTuples([1, 2, 3, 4], 3)).toEqual([
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 1],
      [4, 1, 2],
    ]);
  });

  it("works for single-element arrays", () => {
    expect(adjacentNTuples([42], 2)).toEqual([[42, 42]]);
  });
});

describe("adjacentPairs", () => {
  it("is an alias for adjacentNTuples with n=2", () => {
    expect(adjacentPairs([1, 2, 3, 4])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1],
    ]);
  });
});

// ─── allElementsAreInstances ──────────────────────────────────

describe("allElementsAreInstances", () => {
  it("returns true when all are instances", () => {
    // Use boxed Number objects since primitives are not instanceof Number
    expect(allElementsAreInstances([new Number(1), new Number(2)], Number)).toBe(true);
  });

  it("returns false when one is not an instance", () => {
    expect(allElementsAreInstances([new Number(1), "two", new Number(3)], Number)).toBe(false);
  });

  it("returns true for empty iterable", () => {
    expect(allElementsAreInstances([], Number)).toBe(true);
  });
});

// ─── batchByProperty ─────────────────────────────────────────

describe("batchByProperty", () => {
  it("groups consecutive same-property items", () => {
    const result = batchByProperty(
      [[1, 2], [3, 4], [5, 6, 7], [8, 9]] as number[][],
      (x) => x.length,
    );
    expect(result).toEqual([
      [[[1, 2], [3, 4]], 2],
      [[[5, 6, 7]], 3],
      [[[8, 9]], 2],
    ]);
  });

  it("handles empty input", () => {
    expect(batchByProperty([], (x) => x)).toEqual([]);
  });
});

// ─── concatenateLists ─────────────────────────────────────────

describe("concatenateLists", () => {
  it("flattens multiple lists", () => {
    expect(concatenateLists([1, 2], [3, 4], [5])).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles empty lists", () => {
    expect(concatenateLists([], [1], [])).toEqual([1]);
  });
});

// ─── listDifferenceUpdate ─────────────────────────────────────

describe("listDifferenceUpdate", () => {
  it("removes l2 elements from l1", () => {
    expect(listDifferenceUpdate([1, 2, 3, 4], [2, 4])).toEqual([1, 3]);
  });

  it("returns full list when no overlap", () => {
    expect(listDifferenceUpdate([1, 2, 3], [4, 5])).toEqual([1, 2, 3]);
  });
});

// ─── listUpdate ───────────────────────────────────────────────

describe("listUpdate", () => {
  it("removes overlap from l1, appends l2 unchanged", () => {
    expect(listUpdate([1, 2, 3], [2, 4, 4])).toEqual([1, 3, 2, 4, 4]);
  });

  it("handles empty l1", () => {
    expect(listUpdate([], [1, 2])).toEqual([1, 2]);
  });
});

// ─── listify ──────────────────────────────────────────────────

describe("listify", () => {
  it("wraps a string without splitting", () => {
    expect(listify("str")).toEqual(["str"]);
  });

  it("converts iterables to arrays", () => {
    expect(listify([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("wraps non-iterable primitives", () => {
    expect(listify(42)).toEqual([42]);
  });
});

// ─── tuplify ──────────────────────────────────────────────────

describe("tuplify", () => {
  it("wraps a string without splitting", () => {
    expect(tuplify("str")).toEqual(["str"]);
  });

  it("converts an array to readonly tuple", () => {
    expect(tuplify([1, 2])).toEqual([1, 2]);
  });

  it("wraps non-iterable primitives", () => {
    expect(tuplify(99)).toEqual([99]);
  });
});

// ─── makeEven ─────────────────────────────────────────────────

describe("makeEven", () => {
  it("extends shorter list, favouring earlier elements", () => {
    const [a, b] = makeEven([1, 2], [3, 4, 5, 6]);
    expect(a).toEqual([1, 1, 2, 2]);
    expect(b).toEqual([3, 4, 5, 6]);
  });

  it("leaves equal-length lists unchanged", () => {
    const [a, b] = makeEven([1, 2], [3, 4]);
    expect(a).toEqual([1, 2]);
    expect(b).toEqual([3, 4]);
  });
});

// ─── makeEvenByCycling ────────────────────────────────────────

describe("makeEvenByCycling", () => {
  it("cycles shorter list to match longer", () => {
    const [a, b] = makeEvenByCycling([1, 2], [3, 4, 5, 6]);
    expect(a).toEqual([1, 2, 1, 2]);
    expect(b).toEqual([3, 4, 5, 6]);
  });

  it("odd-length longer list cycles correctly", () => {
    const [a, b] = makeEvenByCycling([1, 2], [3, 4, 5, 6, 7]);
    expect(a).toEqual([1, 2, 1, 2, 1]);
    expect(b).toEqual([3, 4, 5, 6, 7]);
  });
});

// ─── removeListRedundancies ───────────────────────────────────

describe("removeListRedundancies", () => {
  it("removes duplicate, keeping last occurrence", () => {
    // last occurrence of 1 is index 3, so in output it appears after 2
    expect(removeListRedundancies([1, 2, 1, 3])).toEqual([2, 1, 3]);
  });

  it("leaves list with no dupes unchanged", () => {
    expect(removeListRedundancies([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

// ─── removeNones ──────────────────────────────────────────────

describe("removeNones", () => {
  it("removes falsy values", () => {
    expect(removeNones(["m", "", "l", 0, 42, false, true])).toEqual([
      "m",
      "l",
      42,
      true,
    ]);
  });

  it("handles all-falsy list", () => {
    expect(removeNones([null, undefined, 0, false, ""])).toEqual([]);
  });
});

// ─── resizeArray ─────────────────────────────────────────────

describe("resizeArray", () => {
  it("cycles elements when extending", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    const result = resizeArray(arr, 3);
    expect(result.shape).toEqual([3, 2]);
    // cycled: [[1,2],[3,4],[1,2]]
    expect(result.toArray()).toEqual([[1, 2], [3, 4], [1, 2]]);
  });

  it("truncates when shrinking", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    const result = resizeArray(arr, 1);
    expect(result.shape).toEqual([1, 2]);
    expect(result.toArray()).toEqual([[1, 2]]);
  });

  it("returns same array when length matches", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    const result = resizeArray(arr, 2);
    expect(result.toArray()).toEqual([[1, 2], [3, 4]]);
  });
});

// ─── resizePreservingOrder ────────────────────────────────────

describe("resizePreservingOrder", () => {
  it("returns zeros for empty input", () => {
    const empty = np.zeros([0, 2]);
    const result = resizePreservingOrder(empty, 3);
    expect(result.shape).toEqual([3, 2]);
    expect(result.toArray()).toEqual([[0, 0], [0, 0], [0, 0]]);
  });

  it("extends array favouring earlier elements", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    const result = resizePreservingOrder(arr, 3);
    // indices: floor(0*2/3)=0, floor(1*2/3)=0, floor(2*2/3)=1 → [[1,2],[1,2],[3,4]]
    expect(result.toArray()).toEqual([[1, 2], [1, 2], [3, 4]]);
  });

  it("truncates when shrinking", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    expect(resizePreservingOrder(arr, 1).toArray()).toEqual([[1, 2]]);
  });
});

// ─── resizeWithInterpolation ──────────────────────────────────

describe("resizeWithInterpolation", () => {
  it("returns same array when length matches", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    expect(resizeWithInterpolation(arr, 2).toArray()).toEqual([[1, 2], [3, 4]]);
  });

  it("interpolates when extending", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    const result = resizeWithInterpolation(arr, 4);
    expect(result.shape).toEqual([4, 2]);
    // First row should be [1,2], last row [3,4]
    const data = result.toArray() as number[][];
    expect(data[0][0]).toBeCloseTo(1);
    expect(data[3][0]).toBeCloseTo(3);
  });
});

// ─── stretchArrayToLength ────────────────────────────────────

describe("stretchArrayToLength", () => {
  it("stretches array by repeating elements", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    const result = stretchArrayToLength(arr, 4);
    expect(result.shape).toEqual([4, 2]);
  });

  it("returns same array when length matches", () => {
    const arr = np.array([[1, 2], [3, 4]]);
    expect(stretchArrayToLength(arr, 2).toArray()).toEqual([[1, 2], [3, 4]]);
  });
});

// ─── uniqChain ────────────────────────────────────────────────

describe("uniqChain", () => {
  it("returns unique elements across all iterables, preserving order", () => {
    expect(uniqChain([1, 2], [2, 3], [1, 4, 4])).toEqual([1, 2, 3, 4]);
  });

  it("handles empty inputs", () => {
    expect(uniqChain([], [])).toEqual([]);
  });
});

// ─── hashObj ──────────────────────────────────────────────────

describe("hashObj", () => {
  it("produces the same hash for equal objects", () => {
    expect(hashObj([1, 2, 3])).toBe(hashObj([1, 2, 3]));
  });

  it("produces different hashes for different objects", () => {
    expect(hashObj([1, 2, 3])).not.toBe(hashObj([1, 2, 4]));
  });

  it("hashes strings deterministically", () => {
    expect(hashObj("hello")).toBe(hashObj("hello"));
    expect(hashObj("hello")).not.toBe(hashObj("world"));
  });

  it("handles null without throwing", () => {
    expect(() => hashObj(null)).not.toThrow();
  });

  it("hashes Maps", () => {
    const m1 = new Map([["a", 1], ["b", 2]]);
    const m2 = new Map([["a", 1], ["b", 2]]);
    expect(hashObj(m1)).toBe(hashObj(m2));
  });
});
