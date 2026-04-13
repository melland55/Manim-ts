import { describe, it, expect } from "vitest";

describe("mobject package", () => {
  it("module can be imported", async () => {
    const mod = await import("../src/mobject/index.js");
    expect(mod).toBeDefined();
  });

  it("module has no unexpected exports", async () => {
    const mod = await import("../src/mobject/index.js");
    // The Python __init__.py is empty, so no public exports are expected yet
    expect(Object.keys(mod).length).toBe(0);
  });
});
