import { describe, it, expect, beforeEach } from "vitest";
import {
  KEYS_TO_FILTER_OUT,
  getJson,
  getHashFromPlayCall,
  _Memoizer,
} from "../../src/utils/hashing/index.js";

const PLACEHOLDER = _Memoizer.ALREADY_PROCESSED_PLACEHOLDER;

// Reset memoizer state before each test (mirrors Python autouse fixture)
beforeEach(() => {
  _Memoizer.resetAlreadyProcessed();
});

// ─── KEYS_TO_FILTER_OUT ───────────────────────────────────────────────────

describe("KEYS_TO_FILTER_OUT", () => {
  it("contains the expected filter keys", () => {
    expect(KEYS_TO_FILTER_OUT.has("original_id")).toBe(true);
    expect(KEYS_TO_FILTER_OUT.has("background")).toBe(true);
    expect(KEYS_TO_FILTER_OUT.has("pixel_array")).toBe(true);
    expect(KEYS_TO_FILTER_OUT.has("pixel_array_to_cairo_context")).toBe(true);
  });

  it("does not contain unrelated keys", () => {
    expect(KEYS_TO_FILTER_OUT.has("color")).toBe(false);
    expect(KEYS_TO_FILTER_OUT.has("width")).toBe(false);
  });
});

// ─── getJson — basic types ────────────────────────────────────────────────

describe("getJson", () => {
  it("serializes a number", () => {
    expect(getJson(42)).toBe("42");
    expect(getJson(3.14)).toBe("3.14");
  });

  it("serializes a string", () => {
    expect(getJson("hello")).toBe('"hello"');
  });

  it("serializes null", () => {
    expect(getJson(null)).toBe("null");
  });

  it("serializes an array", () => {
    const result = getJson([1, 2, "test", [3]]);
    expect(JSON.parse(result)).toEqual([1, 2, "test", [3]]);
  });

  it("serializes a tuple-like array (tuples become arrays)", () => {
    // Python: [(1, [1])] → "[[1, [1]]]"
    const result = getJson([[1, [1]]]);
    expect(result).toBe("[[1,[1]]]");
  });

  it("serializes a plain object", () => {
    const result = getJson({ a: 1, b: "hello", c: [1, 2] });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed["a"]).toBe(1);
    expect(parsed["b"]).toBe("hello");
    expect(parsed["c"]).toEqual([1, 2]);
  });

  it("filters out KEYS_TO_FILTER_OUT from object serialization", () => {
    const obj = {
      color: "red",
      original_id: "some-id",
      pixel_array: new Uint8Array([1, 2, 3]),
      width: 100,
    };
    const result = getJson(obj);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect("color" in parsed).toBe(true);
    expect("width" in parsed).toBe(true);
    expect("original_id" in parsed).toBe(false);
    expect("pixel_array" in parsed).toBe(false);
  });

  it("serializes a function with code and nonlocals keys", () => {
    function testFn(x: number): number {
      return x + 2;
    }
    const result = getJson(testFn);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect("code" in parsed).toBe(true);
    expect("nonlocals" in parsed).toBe(true);
    expect(typeof parsed["code"]).toBe("string");
    expect(parsed["code"]).toContain("testFn");
  });

  it("serializes a class instance's own enumerable properties", () => {
    class MyObj {
      a: number;
      b: number;
      c: string[];
      constructor() {
        this.a = 2;
        this.b = 3.0;
        this.c = ["nested"];
      }
    }
    const result = getJson(new MyObj());
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed["a"]).toBe(2);
    expect(parsed["b"]).toBe(3.0);
    expect(parsed["c"]).toEqual(["nested"]);
  });

  it("replaces circular references with the placeholder", () => {
    interface Circular {
      x: number;
      circular_ref?: Circular;
    }
    const B: Circular = { x: 1 };
    B.circular_ref = B;

    const result = getJson(B);
    const parsed = JSON.parse(result) as Record<string, unknown>;
    // B was marked first; when encountered again inside itself → placeholder
    expect(parsed["circular_ref"]).toBe(PLACEHOLDER);
  });

  it("handles an object that directly references itself", () => {
    class T {
      a: T | null = null;
    }
    const o = new T();
    o.a = o;
    // Should not throw — self-reference is replaced with placeholder
    expect(() => getJson(o)).not.toThrow();
    const parsed = JSON.parse(getJson(o)) as Record<string, unknown>;
    expect(parsed["a"]).toBe(PLACEHOLDER);
  });

  it("handles an NDArray-like object (large → truncated)", () => {
    // Simulate a large NDArray-like object
    const bigArray = {
      shape: [1000, 1000],
      size: 1_000_000,
      toArray: () => [],
      toString: () => "array(...)",
    };
    const result = getJson(bigArray);
    expect(result).toContain("TRUNCATED ARRAY");
  });

  it("handles an NDArray-like object (small → repr string)", () => {
    const smallArray = {
      shape: [3],
      size: 3,
      toArray: () => [1, 2, 3],
      toString: () => "[1, 2, 3]",
    };
    const result = getJson(smallArray);
    expect(result).toContain("[1, 2, 3]");
  });
});

// ─── _Memoizer ────────────────────────────────────────────────────────────

describe("_Memoizer", () => {
  it("returns the object on first visit", () => {
    const obj = { x: 1 };
    const result = _Memoizer.checkAlreadyProcessed(obj);
    expect(result).toBe(obj);
  });

  it("returns placeholder on second visit to same object", () => {
    const obj = { x: 1 };
    _Memoizer.checkAlreadyProcessed(obj);
    const result2 = _Memoizer.checkAlreadyProcessed(obj);
    expect(result2).toBe(PLACEHOLDER);
  });

  it("resets tracking state between calls", () => {
    const obj = { x: 1 };
    _Memoizer.checkAlreadyProcessed(obj);
    _Memoizer.resetAlreadyProcessed();
    // After reset, obj should be seen as fresh
    const result = _Memoizer.checkAlreadyProcessed(obj);
    expect(result).toBe(obj);
  });

  it("passes through primitives without memoizing them", () => {
    // Same primitive encountered twice: no placeholder (no memoization)
    expect(_Memoizer.checkAlreadyProcessed(42)).toBe(42);
    expect(_Memoizer.checkAlreadyProcessed(42)).toBe(42);
    expect(_Memoizer.checkAlreadyProcessed("hello")).toBe("hello");
    expect(_Memoizer.checkAlreadyProcessed("hello")).toBe("hello");
  });

  it("markAsProcessed marks without error", () => {
    const obj = { y: 2 };
    expect(() => _Memoizer.markAsProcessed(obj)).not.toThrow();
    // After marking, checkAlreadyProcessed should return placeholder
    expect(_Memoizer.checkAlreadyProcessed(obj)).toBe(PLACEHOLDER);
  });
});

// ─── getHashFromPlayCall ──────────────────────────────────────────────────

describe("getHashFromPlayCall", () => {
  it("returns a string with the expected format (3 numbers separated by underscores)", () => {
    const mockScene = {} as Parameters<typeof getHashFromPlayCall>[0];
    const mockCamera = {
      pixelWidth: 1920,
      pixelHeight: 1080,
      frameWidth: 14.222,
      frameHeight: 8.0,
      backgroundColor: { r: 0, g: 0, b: 0, a: 1 },
      getFrameCenter: () => [0, 0, 0],
      setFrameCenter: () => undefined,
      captureFrame: () => undefined,
    } as Parameters<typeof getHashFromPlayCall>[1];

    const hash = getHashFromPlayCall(mockScene, mockCamera, [], []);
    expect(typeof hash).toBe("string");
    const parts = hash.split("_");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(Number(part)).toBeGreaterThanOrEqual(0);
    }
  });

  it("produces the same hash for identical inputs", () => {
    const mockScene = {} as Parameters<typeof getHashFromPlayCall>[0];
    const mockCamera = { pixelWidth: 1920, pixelHeight: 1080 } as Parameters<
      typeof getHashFromPlayCall
    >[1];

    const hash1 = getHashFromPlayCall(mockScene, mockCamera, [], []);
    _Memoizer.resetAlreadyProcessed();
    const hash2 = getHashFromPlayCall(mockScene, mockCamera, [], []);
    expect(hash1).toBe(hash2);
  });

  it("resets memoizer state after execution", () => {
    const mockScene = {} as Parameters<typeof getHashFromPlayCall>[0];
    const mockCamera = {} as Parameters<typeof getHashFromPlayCall>[1];

    getHashFromPlayCall(mockScene, mockCamera, [], []);

    // After getHashFromPlayCall, memoizer should be reset.
    // A new object should NOT be seen as already processed.
    const freshObj = { fresh: true };
    expect(_Memoizer.checkAlreadyProcessed(freshObj)).toBe(freshObj);
  });
});
