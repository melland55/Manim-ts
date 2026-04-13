import { describe, it, expect } from "vitest";
import { extractMobjectFamilyMembers } from "../../src/utils/family/index.js";
import type { IMobject, IVMobject, Points3D } from "../../src/core/types.js";

// ─── Minimal stub helpers ─────────────────────────────────────────────────────

function makeMob(
  name: string,
  zIndex = 0,
  submobjects: IMobject[] = [],
): IMobject {
  const mob: IMobject = {
    name,
    color: { r: 1, g: 1, b: 1, a: 1, toHex: () => "#fff", toArray: () => [1,1,1,1], interpolate: (o) => o, lighter: () => mob.color, darker: () => mob.color },
    submobjects,
    updaters: [],
    zIndex,
    getCenter: () => { throw new Error("stub"); },
    getLeft: () => { throw new Error("stub"); },
    getRight: () => { throw new Error("stub"); },
    getTop: () => { throw new Error("stub"); },
    getBottom: () => { throw new Error("stub"); },
    getWidth: () => 0,
    getHeight: () => 0,
    moveTo: () => mob,
    shift: () => mob,
    scale: () => mob,
    rotate: () => mob,
    flip: () => mob,
    nextTo: () => mob,
    alignTo: () => mob,
    add: () => mob,
    remove: () => mob,
    getFamily(): IMobject[] {
      const family: IMobject[] = [mob];
      for (const sub of submobjects) {
        family.push(...sub.getFamily());
      }
      return family;
    },
    setColor: () => mob,
    setOpacity: () => mob,
    addUpdater: () => mob,
    removeUpdater: () => mob,
    applyMatrix: () => mob,
    applyFunction: () => mob,
    copy: () => mob,
  };
  return mob;
}

function makeVMob(name: string, zIndex = 0, numPoints = 3): IMobject {
  // Minimal IVMobject stub — has a non-empty points array
  const fakePoints = {
    shape: [numPoints, 3],
  } as unknown as Points3D;

  const mob = makeMob(name, zIndex) as unknown as IVMobject;
  (mob as unknown as { points: Points3D }).points = fakePoints;
  return mob as unknown as IMobject;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("extractMobjectFamilyMembers", () => {
  it("returns empty array for empty input", () => {
    expect(extractMobjectFamilyMembers([])).toEqual([]);
  });

  it("returns a single mobject with no submobjects", () => {
    const a = makeMob("a");
    const result = extractMobjectFamilyMembers([a]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });

  it("includes submobjects recursively", () => {
    const child = makeMob("child");
    const parent = makeMob("parent", 0, [child]);
    const result = extractMobjectFamilyMembers([parent]);
    expect(result).toHaveLength(2);
    expect(result).toContain(parent);
    expect(result).toContain(child);
  });

  it("deduplicates shared submobjects (keeps last occurrence order)", () => {
    const shared = makeMob("shared");
    const a = makeMob("a", 0, [shared]);
    const b = makeMob("b", 0, [shared]);
    const result = extractMobjectFamilyMembers([a, b]);
    // shared appears twice in the flattened list; should only appear once
    expect(result.filter((m) => m === shared)).toHaveLength(1);
  });

  it("sorts by zIndex when useZIndex=true", () => {
    const lo = makeMob("lo", 0);
    const hi = makeMob("hi", 5);
    const mid = makeMob("mid", 2);
    const result = extractMobjectFamilyMembers([hi, lo, mid], true);
    expect(result.map((m) => m.zIndex)).toEqual([0, 2, 5]);
  });

  it("does not sort when useZIndex=false (default)", () => {
    const a = makeMob("a", 10);
    const b = makeMob("b", 1);
    const result = extractMobjectFamilyMembers([a, b]);
    // order reflects flattened traversal, not z-index
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it("filters to only members with points when onlyThoseWithPoints=true", () => {
    const noPoints = makeMob("no-points");
    const withPoints = makeVMob("with-points", 0, 4);
    const result = extractMobjectFamilyMembers(
      [noPoints, withPoints],
      false,
      true,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(withPoints);
  });

  it("includes members without points when onlyThoseWithPoints=false (default)", () => {
    const noPoints = makeMob("no-points");
    const withPoints = makeVMob("with-points");
    const result = extractMobjectFamilyMembers([noPoints, withPoints]);
    expect(result).toHaveLength(2);
  });

  it("handles deep nesting correctly", () => {
    const grandchild = makeMob("grandchild");
    const child = makeMob("child", 0, [grandchild]);
    const parent = makeMob("parent", 0, [child]);
    const result = extractMobjectFamilyMembers([parent]);
    expect(result).toHaveLength(3);
    expect(result).toContain(grandchild);
  });

  it("accepts a generator (any Iterable) as input", () => {
    const a = makeMob("a");
    const b = makeMob("b");
    function* gen() {
      yield a;
      yield b;
    }
    const result = extractMobjectFamilyMembers(gen());
    expect(result).toHaveLength(2);
  });
});
