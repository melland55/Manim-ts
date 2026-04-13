import { describe, it, expect } from "vitest";
import {
  HEALTH_CHECKS,
  healthcheck,
  isManimOnPath,
  isManimExecutableAssociatedToThisLibrary,
  isLatexAvailable,
  isDvisvgmAvailable,
  type HealthCheckFunction,
} from "../../src/cli/checkhealth/index.js";

describe("HEALTH_CHECKS registry", () => {
  it("contains exactly 4 registered checks", () => {
    expect(HEALTH_CHECKS).toHaveLength(4);
  });

  it("registers checks in declaration order", () => {
    // Confirm the four exported constants are the same objects stored in the array
    expect(HEALTH_CHECKS[0]).toBe(isManimOnPath);
    expect(HEALTH_CHECKS[1]).toBe(isManimExecutableAssociatedToThisLibrary);
    expect(HEALTH_CHECKS[2]).toBe(isLatexAvailable);
    expect(HEALTH_CHECKS[3]).toBe(isDvisvgmAvailable);
  });

  it("every check has a non-empty description", () => {
    for (const check of HEALTH_CHECKS) {
      expect(typeof check.description).toBe("string");
      expect(check.description.length).toBeGreaterThan(0);
    }
  });

  it("every check has a non-empty recommendation", () => {
    for (const check of HEALTH_CHECKS) {
      expect(typeof check.recommendation).toBe("string");
      expect(check.recommendation.length).toBeGreaterThan(0);
    }
  });

  it("every check has a skipOnFailed array", () => {
    for (const check of HEALTH_CHECKS) {
      expect(Array.isArray(check.skipOnFailed)).toBe(true);
    }
  });

  it("every check has a postFailFixHook of null or function", () => {
    for (const check of HEALTH_CHECKS) {
      const hook = check.postFailFixHook;
      expect(hook === null || typeof hook === "function").toBe(true);
    }
  });
});

describe("healthcheck decorator", () => {
  it("attaches description and recommendation to the function", () => {
    const decorator = healthcheck({
      description: "Test check",
      recommendation: "Test fix",
    });
    function testCheckFn(): boolean { return true; }
    // Remove from global HEALTH_CHECKS to avoid polluting other tests
    const fn = decorator(testCheckFn);
    HEALTH_CHECKS.pop(); // remove the one we just registered

    expect(fn.description).toBe("Test check");
    expect(fn.recommendation).toBe("Test fix");
    expect(fn.skipOnFailed).toEqual([]);
    expect(fn.postFailFixHook).toBeNull();
  });

  it("resolves skipOnFailed to function .name strings", () => {
    // Register a sentinel check so we can reference it in skipOnFailed
    function sentinelCheckFn(): boolean { return true; }
    const sentinel = healthcheck({ description: "s", recommendation: "s" })(sentinelCheckFn);
    HEALTH_CHECKS.pop();

    function depCheckFn(): boolean { return true; }
    const fn = healthcheck({
      description: "Dep check",
      recommendation: "Dep fix",
      skipOnFailed: [sentinel, "anotherCheckName"],
    })(depCheckFn);
    HEALTH_CHECKS.pop();

    // skipOnFailed stores the .name of the sentinel function
    expect(fn.skipOnFailed).toContain(sentinel.name);
    expect(fn.skipOnFailed).toContain("anotherCheckName");
    expect(fn.skipOnFailed).toHaveLength(2);
  });

  it("returns a callable that preserves the original function behaviour", () => {
    let called = false;
    function alwaysTrueFn(): boolean {
      called = true;
      return true;
    }
    const fn = healthcheck({ description: "d", recommendation: "r" })(alwaysTrueFn);
    HEALTH_CHECKS.pop();

    const result = fn();
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  it("postFailFixHook is stored when provided", () => {
    const hook = (): void => { /* noop */ };
    function hookCheckFn(): boolean { return false; }
    const fn = healthcheck({
      description: "d",
      recommendation: "r",
      postFailFixHook: hook,
    })(hookCheckFn);
    HEALTH_CHECKS.pop();

    expect(fn.postFailFixHook).toBe(hook);
  });
});

describe("skip dependency metadata", () => {
  it("isManimExecutableAssociatedToThisLibrary depends on isManimOnPath", () => {
    expect(
      isManimExecutableAssociatedToThisLibrary.skipOnFailed
    ).toContain(isManimOnPath.name);
  });

  it("isLatexAvailable has no skip dependencies", () => {
    expect(isLatexAvailable.skipOnFailed).toHaveLength(0);
  });

  it("isDvisvgmAvailable depends on isLatexAvailable", () => {
    expect(isDvisvgmAvailable.skipOnFailed).toContain(isLatexAvailable.name);
  });

  it("isManimOnPath has no skip dependencies", () => {
    expect(isManimOnPath.skipOnFailed).toHaveLength(0);
  });

  it("skip logic: check is skipped when its dependency has failed", () => {
    // Simulate the command runner's skip logic
    const failedChecks: HealthCheckFunction[] = [isManimOnPath];
    const shouldSkip = failedChecks.some((fc) =>
      isManimExecutableAssociatedToThisLibrary.skipOnFailed.includes(fc.name)
    );
    expect(shouldSkip).toBe(true);
  });

  it("skip logic: check runs when its dependency has passed", () => {
    const failedChecks: HealthCheckFunction[] = [];
    const shouldSkip = failedChecks.some((fc) =>
      isManimExecutableAssociatedToThisLibrary.skipOnFailed.includes(fc.name)
    );
    expect(shouldSkip).toBe(false);
  });
});

describe("check content", () => {
  it("isManimOnPath description mentions PATH", () => {
    expect(isManimOnPath.description.toLowerCase()).toContain("path");
  });

  it("isLatexAvailable description mentions latex", () => {
    expect(isLatexAvailable.description.toLowerCase()).toContain("latex");
  });

  it("isDvisvgmAvailable description mentions dvisvgm", () => {
    expect(isDvisvgmAvailable.description.toLowerCase()).toContain("dvisvgm");
  });
});

describe("check return values", () => {
  it("each check returns a boolean", () => {
    for (const check of HEALTH_CHECKS) {
      const result = check();
      expect(typeof result).toBe("boolean");
    }
  });
});
