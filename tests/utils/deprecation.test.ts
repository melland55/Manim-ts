import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLogger } from "../../src/_config/logger_utils/index.js";
import { deprecated, deprecatedParams } from "../../src/utils/deprecation/index.js";

// Capture logger warnings rather than actually logging
const manimLogger = getLogger("manim");
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(manimLogger, "warning").mockImplementation(() => undefined);
});

// ─── deprecated ───────────────────────────────────────────────────────────────

describe("deprecated", () => {
  it("logs a warning when a deprecated function is called", () => {
    function foo(): number {
      return 42;
    }
    const wrappedFoo = deprecated(foo);
    const result = wrappedFoo();
    expect(result).toBe(42);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("function foo");
    expect(warnSpy.mock.calls[0][0]).toContain("deprecated");
  });

  it("includes since/until/replacement/message in the warning", () => {
    function bar(): void {}
    const wrapped = deprecated(bar, {
      since: "v0.2",
      until: "v0.4",
      replacement: "baz",
      message: "It is cooler.",
    });
    wrapped();
    const msg: string = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain("since v0.2");
    expect(msg).toContain("removed after v0.4");
    expect(msg).toContain("Use baz instead");
    expect(msg).toContain("It is cooler.");
  });

  it("works as a factory (called with options object, no func)", () => {
    const decorate = deprecated({ since: "v1.0" });
    function myFn(): string {
      return "hello";
    }
    const wrapped = decorate(myFn);
    const result = wrapped();
    expect(result).toBe("hello");
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("since v1.0");
  });

  it("works as a factory with no options", () => {
    const decorate = deprecated();
    function plainFn(): boolean {
      return true;
    }
    const wrapped = decorate(plainFn);
    expect(wrapped()).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("logs a warning when a deprecated class is instantiated", () => {
    class MyClass {
      value: number;
      constructor(v: number) {
        this.value = v;
      }
    }
    const DeprecatedClass = deprecated(MyClass);
    const instance = new DeprecatedClass(7);
    expect(instance.value).toBe(7);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("class MyClass");
  });

  it("warns each invocation, not just the first", () => {
    function callMe(): void {}
    const wrapped = deprecated(callMe);
    wrapped();
    wrapped();
    wrapped();
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it("passes arguments through correctly", () => {
    function add(a: number, b: number): number {
      return a + b;
    }
    const wrappedAdd = deprecated(add);
    expect(wrappedAdd(3, 4)).toBe(7);
  });
});

// ─── deprecatedParams ─────────────────────────────────────────────────────────

describe("deprecatedParams", () => {
  it("logs no warning when no deprecated params are used", () => {
    const foo = deprecatedParams({ params: "a, b, c" })(
      (kwargs: Record<string, unknown>) => kwargs,
    );
    foo({ x: 2, y: 3 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs a warning when a deprecated param is used", () => {
    const foo = deprecatedParams({ params: "a, b" })(
      (kwargs: Record<string, unknown>) => kwargs,
    );
    foo({ a: 1, x: 2 });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("parameter a");
  });

  it("includes multiple deprecated params in the warning", () => {
    const foo = deprecatedParams({ params: ["a", "b"] })(
      (kwargs: Record<string, unknown>) => kwargs,
    );
    foo({ a: 1, b: 2, x: 3 });
    const msg: string = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain("a");
    expect(msg).toContain("b");
    expect(msg).toContain("have been");
  });

  it("includes since/until/message in the warning", () => {
    const foo = deprecatedParams({
      params: "old_param",
      since: "v0.2",
      until: "v0.4",
      message: "Use new_param.",
    })((kwargs: Record<string, unknown>) => kwargs);
    foo({ old_param: 1 });
    const msg: string = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain("since v0.2");
    expect(msg).toContain("removed after v0.4");
    expect(msg).toContain("Use new_param.");
  });

  it("redirects a deprecated param to a new name via tuple", () => {
    const foo = deprecatedParams({
      redirections: [["old_param", "new_param"] as [string, string]],
    })((kwargs: Record<string, unknown>) => kwargs);
    const result = foo({ old_param: 99 }) as Record<string, unknown>;
    expect(result["new_param"]).toBe(99);
    expect("old_param" in result).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("redirects via a function redirector", () => {
    const foo = deprecatedParams({
      redirections: [
        function runtimeInMs(runtime_in_ms: unknown) {
          return { run_time: (runtime_in_ms as number) / 1000 };
        },
      ],
    })((kwargs: Record<string, unknown>) => kwargs);
    const result = foo({ runtime_in_ms: 500 }) as Record<string, unknown>;
    expect(result["run_time"]).toBe(0.5);
    expect("runtime_in_ms" in result).toBe(false);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("throws when called without arguments (used without parens)", () => {
    // Mirrors Python: @deprecated_params without () raises ValueError
    expect(() => {
      (deprecatedParams as unknown as (fn: unknown) => unknown)(
        (kwargs: Record<string, unknown>) => kwargs,
      );
    }).toThrow("deprecatedParams requires arguments to be specified.");
  });

  it("throws when param names are invalid identifiers", () => {
    expect(() => {
      deprecatedParams({ params: "123invalid" });
    }).toThrow("Given parameter values are invalid.");
  });
});
