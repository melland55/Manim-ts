import { describe, it, expect, vi } from "vitest";
import { printFamily, indexLabels } from "../../src/utils/debug/index.js";
import { Mobject, Group } from "../../src/mobject/mobject/index.js";

describe("printFamily", () => {
  it("prints a single mobject with no children", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mob = new Mobject({ name: "root" });
    printFamily(mob);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(""); // 0 tabs
    spy.mockRestore();
  });

  it("prints children with increasing indentation", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const parent = new Mobject({ name: "parent" });
    const child = new Mobject({ name: "child" });
    parent.add(child);
    printFamily(parent);
    expect(spy).toHaveBeenCalledTimes(2);
    // First call: 0 tabs for parent
    expect(spy.mock.calls[0][0]).toBe("");
    // Second call: 1 tab for child
    expect(spy.mock.calls[1][0]).toBe("\t");
    spy.mockRestore();
  });

  it("handles deeply nested hierarchy", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const root = new Mobject({ name: "root" });
    const child = new Mobject({ name: "child" });
    const grandchild = new Mobject({ name: "grandchild" });
    root.add(child);
    child.add(grandchild);
    printFamily(root);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[2][0]).toBe("\t\t"); // 2 tabs for grandchild
    spy.mockRestore();
  });

  it("handles mobject with no submobjects", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mob = new Mobject();
    printFamily(mob);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("indexLabels", () => {
  it("returns a mobject with labels for each submobject", () => {
    const parent = new Mobject({ name: "parent" });
    const child1 = new Mobject({ name: "child1" });
    const child2 = new Mobject({ name: "child2" });
    parent.add(child1, child2);

    const labels = indexLabels(parent);
    expect(labels.submobjects.length).toBe(2);
  });

  it("returns empty group for mobject with no submobjects", () => {
    const mob = new Mobject({ name: "lonely" });
    const labels = indexLabels(mob);
    expect(labels.submobjects.length).toBe(0);
  });

  it("creates labels named with their index", () => {
    const parent = new Mobject({ name: "parent" });
    parent.add(new Mobject(), new Mobject(), new Mobject());

    const labels = indexLabels(parent);
    expect(labels.submobjects[0].name).toBe("Integer(0)");
    expect(labels.submobjects[1].name).toBe("Integer(1)");
    expect(labels.submobjects[2].name).toBe("Integer(2)");
  });

  it("respects custom labelHeight", () => {
    const parent = new Mobject({ name: "parent" });
    parent.add(new Mobject());

    const labels = indexLabels(parent, { labelHeight: 0.5 });
    expect(labels.submobjects.length).toBe(1);
  });

  it("accepts default options without error", () => {
    const parent = new Mobject({ name: "parent" });
    parent.add(new Mobject());

    expect(() => indexLabels(parent)).not.toThrow();
  });
});
