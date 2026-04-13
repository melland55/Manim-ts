import { describe, it, expect } from "vitest";
import {
  extractMobjectFamilyMembers,
  restructureListToExcludeCertainFamilyMembers,
} from "../../src/utils/family_ops/index.js";
import type { IMobject, IVMobject, Points3D } from "../../src/core/types.js";

// ─── Minimal stub helpers ─────────────────────────────────────────────────────

function makeMob(
  name: string,
  submobjects: IMobject[] = [],
): IMobject {
  const mob: IMobject = {
    name,
    color: {
      r: 1, g: 1, b: 1, a: 1,
      toHex: () => "#fff",
      toArray: () => [1, 1, 1, 1],
      interpolate: (o) => o,
      lighter: () => mob.color,
      darker: () => mob.color,
    },
    submobjects,
    updaters: [],
    zIndex: 0,
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

function makeVMob(name: string, numPoints = 3): IMobject {
  const fakePoints = { shape: [numPoints, 3] } as unknown as Points3D;
  const mob = makeMob(name) as unknown as IVMobject;
  (mob as unknown as { points: Points3D }).points = fakePoints;
  return mob as unknown as IMobject;
}

// ─── extractMobjectFamilyMembers ─────────────────────────────────────────────

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
    const grandchild = makeMob("grandchild");
    const child = makeMob("child", [grandchild]);
    const parent = makeMob("parent", [child]);
    const result = extractMobjectFamilyMembers([parent]);
    expect(result).toHaveLength(3);
    expect(result).toContain(parent);
    expect(result).toContain(child);
    expect(result).toContain(grandchild);
  });

  it("filters to only members with points when onlyThoseWithPoints=true", () => {
    const noPoints = makeMob("no-points");
    const withPoints = makeVMob("with-points", 4);
    const result = extractMobjectFamilyMembers([noPoints, withPoints], true);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(withPoints);
  });

  it("includes members without points when onlyThoseWithPoints=false", () => {
    const noPoints = makeMob("no-points");
    const withPoints = makeVMob("with-points");
    const result = extractMobjectFamilyMembers([noPoints, withPoints]);
    expect(result).toHaveLength(2);
  });
});

// ─── restructureListToExcludeCertainFamilyMembers ────────────────────────────

describe("restructureListToExcludeCertainFamilyMembers", () => {
  it("returns the original list when nothing to remove", () => {
    const a = makeMob("a");
    const b = makeMob("b");
    const result = restructureListToExcludeCertainFamilyMembers([a, b], []);
    expect(result).toHaveLength(2);
    expect(result).toContain(a);
    expect(result).toContain(b);
  });

  it("removes a top-level mobject", () => {
    const a = makeMob("a");
    const b = makeMob("b");
    const result = restructureListToExcludeCertainFamilyMembers([a, b], [a]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(b);
  });

  it("removes a submobject but keeps siblings", () => {
    const m1 = makeMob("m1");
    const m2 = makeMob("m2");
    const m3 = makeMob("m3");
    const group = makeMob("group", [m1, m2, m3]);

    const result = restructureListToExcludeCertainFamilyMembers([group], [m1]);
    // group is broken apart; m2 and m3 remain but m1 and group are gone
    expect(result).not.toContain(m1);
    expect(result).not.toContain(group);
    expect(result).toContain(m2);
    expect(result).toContain(m3);
  });

  it("handles nested removal — keeps unaffected branches", () => {
    const leaf = makeMob("leaf");
    const branch = makeMob("branch", [leaf]);
    const other = makeMob("other");
    const root = makeMob("root", [branch, other]);

    const result = restructureListToExcludeCertainFamilyMembers([root], [leaf]);
    // leaf removed, branch broken apart (no other children), other kept
    expect(result).not.toContain(leaf);
    expect(result).toContain(other);
  });

  it("returns empty when all are removed", () => {
    const a = makeMob("a");
    const b = makeMob("b");
    const result = restructureListToExcludeCertainFamilyMembers([a, b], [a, b]);
    expect(result).toHaveLength(0);
  });

  it("handles empty input list", () => {
    const a = makeMob("a");
    const result = restructureListToExcludeCertainFamilyMembers([], [a]);
    expect(result).toEqual([]);
  });

  it("handles removing a mobject not in the list (no-op)", () => {
    const a = makeMob("a");
    const b = makeMob("b");
    const result = restructureListToExcludeCertainFamilyMembers([a], [b]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });
});
