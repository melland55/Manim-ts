import { describe, it, expect, vi } from "vitest";
import { MethodWithArgs } from "../src/data_structures/index.js";

describe("MethodWithArgs", () => {
  it("stores method, args, and kwargs", () => {
    const fn = (x: unknown, y: unknown) => [x, y];
    const mwa = new MethodWithArgs(fn, [1, 2], { z: 3 });

    expect(mwa.method).toBe(fn);
    expect(mwa.args).toEqual([1, 2]);
    expect(mwa.kwargs).toEqual({ z: 3 });
  });

  it("defaults args to empty array when omitted", () => {
    const fn = () => undefined;
    const mwa = new MethodWithArgs(fn);

    expect(mwa.args).toEqual([]);
  });

  it("defaults kwargs to empty object when omitted", () => {
    const fn = () => undefined;
    const mwa = new MethodWithArgs(fn);

    expect(mwa.kwargs).toEqual({});
  });

  it("stored method is callable and returns correctly", () => {
    const fn = vi.fn((a: unknown, b: unknown) => (a as number) + (b as number));
    const mwa = new MethodWithArgs(fn, [3, 4]);

    const result = mwa.method(...mwa.args);

    expect(fn).toHaveBeenCalledWith(3, 4);
    expect(result).toBe(7);
  });

  it("handles bound methods (preserves `this` context)", () => {
    class Counter {
      count = 0;
      increment(by: number) {
        this.count += by;
      }
    }

    const counter = new Counter();
    const mwa = new MethodWithArgs(counter.increment.bind(counter), [5]);

    mwa.method(...mwa.args);

    expect(counter.count).toBe(5);
  });

  it("supports empty args and empty kwargs explicitly", () => {
    const fn = () => 42;
    const mwa = new MethodWithArgs(fn, [], {});

    expect(mwa.args).toHaveLength(0);
    expect(Object.keys(mwa.kwargs)).toHaveLength(0);
    expect(mwa.method()).toBe(42);
  });

  it("allows args and kwargs to be mutated after construction", () => {
    const fn = (...a: unknown[]) => a;
    const mwa = new MethodWithArgs(fn, [1]);

    mwa.args.push(2);
    mwa.kwargs["extra"] = true;

    expect(mwa.args).toEqual([1, 2]);
    expect(mwa.kwargs["extra"]).toBe(true);
  });
});
