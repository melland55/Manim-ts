import { describe, it, expect } from "vitest";
import {
  mergeDictsRecursively,
  updateDictRecursively,
  DictAsObject,
  DataDescriptor,
  UniformsDescriptor,
} from "../../src/utils/config_ops/index.js";

describe("mergeDictsRecursively", () => {
  it("returns empty dict for no inputs", () => {
    expect(mergeDictsRecursively()).toEqual({});
  });

  it("returns a copy of a single dict", () => {
    expect(mergeDictsRecursively({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("later dicts override earlier ones for scalar values", () => {
    const result = mergeDictsRecursively({ a: 1 }, { a: 2 });
    expect(result.a).toBe(2);
  });

  it("merges keys from multiple dicts (union of keysets)", () => {
    const result = mergeDictsRecursively({ a: 1 }, { b: 2 }, { c: 3 });
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("merges nested dicts recursively", () => {
    const a = { x: { foo: 1, bar: 2 } };
    const b = { x: { bar: 99, baz: 3 } };
    const result = mergeDictsRecursively(a, b);
    expect(result.x).toEqual({ foo: 1, bar: 99, baz: 3 });
  });

  it("does not mutate input dicts", () => {
    const a = { a: 1 };
    const b = { a: 2 };
    mergeDictsRecursively(a, b);
    expect(a.a).toBe(1);
  });

  it("does not merge arrays as objects (arrays are replaced)", () => {
    const a = { arr: [1, 2, 3] };
    const b = { arr: [4, 5] };
    const result = mergeDictsRecursively(a, b);
    expect(result.arr).toEqual([4, 5]);
  });
});

describe("updateDictRecursively", () => {
  it("updates currentDict in-place", () => {
    const current = { a: 1, b: 2 };
    updateDictRecursively(current, { b: 99, c: 3 });
    expect(current).toEqual({ a: 1, b: 99, c: 3 });
  });

  it("recursively merges nested dicts in-place", () => {
    const current = { nested: { x: 1, y: 2 } };
    updateDictRecursively(current, { nested: { y: 20, z: 30 } });
    expect(current.nested).toEqual({ x: 1, y: 20, z: 30 });
  });

  it("accepts multiple others with priority left-to-right", () => {
    const current = { a: 0 };
    updateDictRecursively(current, { a: 1 }, { a: 2 });
    expect(current.a).toBe(2);
  });
});

describe("DictAsObject", () => {
  it("exposes dict keys as properties", () => {
    const obj = new DictAsObject({ x: 10, y: 20 });
    expect((obj as unknown as Record<string, unknown>).x).toBe(10);
    expect((obj as unknown as Record<string, unknown>).y).toBe(20);
  });

  it("works with string values", () => {
    const obj = new DictAsObject({ name: "manim" });
    expect((obj as unknown as Record<string, unknown>).name).toBe("manim");
  });
});

describe("DataDescriptor", () => {
  it("proxies get/set through HasData.data", () => {
    const obj = { data: {} as Record<string, unknown> };
    const desc = new DataDescriptor<number[]>("points");

    desc.set(obj, [1, 2, 3]);
    expect(obj.data["points"]).toEqual([1, 2, 3]);
    expect(desc.get(obj)).toEqual([1, 2, 3]);
  });
});

describe("UniformsDescriptor", () => {
  it("proxies get/set through HasUniforms.uniforms", () => {
    const obj = { uniforms: {} as Record<string, number | readonly number[]> };
    const desc = new UniformsDescriptor<number>("opacity");

    desc.set(obj, 0.5);
    expect(obj.uniforms["opacity"]).toBe(0.5);
    expect(desc.get(obj)).toBe(0.5);
  });

  it("works with tuple values", () => {
    const obj = { uniforms: {} as Record<string, number | readonly number[]> };
    const desc = new UniformsDescriptor<readonly number[]>("color");

    desc.set(obj, [1, 0, 0, 1]);
    expect(desc.get(obj)).toEqual([1, 0, 0, 1]);
  });
});
