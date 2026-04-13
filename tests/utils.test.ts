import { describe, it, expect } from "vitest";

/**
 * Tests for src/utils/index.ts
 *
 * utils/__init__.py is empty in the Python source — this suite verifies
 * that the barrel module exists and can be imported without errors.
 * Individual sub-modules will have their own test files once converted.
 */

describe("utils barrel", () => {
  it("can be imported without error", async () => {
    await expect(import("../src/utils/index.js")).resolves.toBeDefined();
  });

  it("is an object", async () => {
    const mod = await import("../src/utils/index.js");
    expect(typeof mod).toBe("object");
  });
});
