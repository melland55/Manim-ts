/**
 * Tests for src/mobject/mobject/
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np, ORIGIN, UP, DOWN, LEFT, RIGHT, OUT } from "../../src/core/math/index.js";
import type { Point3D } from "../../src/core/math/index.js";
import { WHITE, PURE_YELLOW } from "../../src/utils/color/manim_colors.js";
import { ManimColor } from "../../src/utils/color/core.js";
import { Mobject, Group } from "../../src/mobject/mobject/index.js";

// Helper to make a Mobject with actual points for testing
function makeMobjectWithPoints(points: number[][]): Mobject {
  const mob = new Mobject();
  mob.points = np.array(points);
  return mob;
}

describe("Mobject", () => {
  describe("constructor", () => {
    it("creates with default values", () => {
      const mob = new Mobject();
      expect(mob.name).toBe("Mobject");
      expect(mob.dim).toBe(3);
      expect(mob.zIndex).toBe(0);
      expect(mob.submobjects).toEqual([]);
      expect(mob.updaters).toEqual([]);
      expect(mob.updatingSuspended).toBe(false);
      expect(mob.target).toBeNull();
      expect(mob.getNumPoints()).toBe(0);
    });

    it("accepts custom options", () => {
      const mob = new Mobject({ name: "test", zIndex: 5 });
      expect(mob.name).toBe("test");
      expect(mob.zIndex).toBe(5);
    });

    it("parses color option", () => {
      const mob = new Mobject({ color: PURE_YELLOW });
      expect(mob.color).toBeInstanceOf(ManimColor);
    });
  });

  describe("submobject management", () => {
    it("add() adds submobjects", () => {
      const parent = new Mobject();
      const child1 = new Mobject({ name: "c1" });
      const child2 = new Mobject({ name: "c2" });
      parent.add(child1, child2);
      expect(parent.submobjects).toHaveLength(2);
      expect(parent.submobjects[0]).toBe(child1);
      expect(parent.submobjects[1]).toBe(child2);
    });

    it("add() deduplicates", () => {
      const parent = new Mobject();
      const child = new Mobject({ name: "c" });
      parent.add(child, child);
      expect(parent.submobjects).toHaveLength(1);
    });

    it("add() throws when adding self", () => {
      const mob = new Mobject();
      expect(() => mob.add(mob)).toThrow();
    });

    it("add() throws for non-Mobject", () => {
      const mob = new Mobject();
      expect(() => mob.add(42 as unknown as Mobject)).toThrow(TypeError);
    });

    it("remove() removes submobjects", () => {
      const parent = new Mobject();
      const child = new Mobject({ name: "c" });
      parent.add(child);
      expect(parent.submobjects).toHaveLength(1);
      parent.remove(child);
      expect(parent.submobjects).toHaveLength(0);
    });

    it("addToBack() inserts at the front", () => {
      const parent = new Mobject();
      const c1 = new Mobject({ name: "c1" });
      const c2 = new Mobject({ name: "c2" });
      parent.add(c1);
      parent.addToBack(c2);
      expect(parent.submobjects[0]).toBe(c2);
      expect(parent.submobjects[1]).toBe(c1);
    });

    it("insert() inserts at index", () => {
      const parent = new Mobject();
      const c1 = new Mobject({ name: "c1" });
      const c2 = new Mobject({ name: "c2" });
      const c3 = new Mobject({ name: "c3" });
      parent.add(c1, c3);
      parent.insert(1, c2);
      expect(parent.submobjects[1]).toBe(c2);
    });
  });

  describe("family", () => {
    it("getFamily() returns self and all descendants", () => {
      const parent = new Mobject({ name: "p" });
      const child = new Mobject({ name: "c" });
      const grandchild = new Mobject({ name: "gc" });
      child.add(grandchild);
      parent.add(child);
      const family = parent.getFamily();
      expect(family).toHaveLength(3);
      expect(family[0]).toBe(parent);
      expect(family[1]).toBe(child);
      expect(family[2]).toBe(grandchild);
    });

    it("familyMembersWithPoints() filters correctly", () => {
      const parent = new Mobject({ name: "p" });
      const withPoints = makeMobjectWithPoints([[1, 0, 0], [0, 1, 0]]);
      parent.add(withPoints);
      const members = parent.familyMembersWithPoints();
      expect(members).toHaveLength(1);
      expect(members[0]).toBe(withPoints);
    });
  });

  describe("positioning", () => {
    it("getCenter() returns origin for empty mobject", () => {
      const mob = new Mobject();
      const center = mob.getCenter();
      expect(center).toBeCloseToPoint(ORIGIN);
    });

    it("getCenter() computes center of points", () => {
      const mob = makeMobjectWithPoints([
        [-1, -1, 0],
        [1, 1, 0],
      ]);
      const center = mob.getCenter();
      expect(center).toBeCloseToPoint(ORIGIN);
    });

    it("shift() moves all points", () => {
      const mob = makeMobjectWithPoints([
        [0, 0, 0],
        [1, 0, 0],
      ]);
      mob.shift(np.array([2, 3, 0]) as Point3D);
      expect(mob.getCenter()).toBeCloseToPoint(
        np.array([2.5, 3, 0]) as Point3D,
      );
    });

    it("moveTo() moves center to target", () => {
      const mob = makeMobjectWithPoints([
        [-1, 0, 0],
        [1, 0, 0],
      ]);
      mob.moveTo(np.array([5, 5, 0]) as Point3D);
      expect(mob.getCenter()).toBeCloseToPoint(
        np.array([5, 5, 0]) as Point3D,
      );
    });

    it("scale() scales about center by default", () => {
      const mob = makeMobjectWithPoints([
        [-1, 0, 0],
        [1, 0, 0],
      ]);
      mob.scale(2);
      expect(mob.width).toBeCloseTo(4, 5);
      expect(mob.getCenter()).toBeCloseToPoint(ORIGIN);
    });

    it("setX/setY/setZ sets coordinate", () => {
      const mob = makeMobjectWithPoints([
        [-1, -1, 0],
        [1, 1, 0],
      ]);
      mob.setX(3);
      expect(mob.getX()).toBeCloseTo(3);
    });
  });

  describe("properties", () => {
    it("width/height/depth return correct values", () => {
      const mob = makeMobjectWithPoints([
        [-2, -1, -0.5],
        [2, 1, 0.5],
      ]);
      expect(mob.width).toBeCloseTo(4);
      expect(mob.height).toBeCloseTo(2);
      expect(mob.depth).toBeCloseTo(1);
    });

    it("hasPoints() / hasNoPoints()", () => {
      const empty = new Mobject();
      expect(empty.hasPoints()).toBe(false);
      expect(empty.hasNoPoints()).toBe(true);

      const withPts = makeMobjectWithPoints([[0, 0, 0]]);
      expect(withPts.hasPoints()).toBe(true);
      expect(withPts.hasNoPoints()).toBe(false);
    });
  });

  describe("updaters", () => {
    it("addUpdater() adds and calls updater", () => {
      const mob = new Mobject();
      let called = false;
      mob.addUpdater((_m: Mobject) => { called = true; }, undefined, true);
      expect(called).toBe(true);
    });

    it("update() calls time-based updaters with dt", () => {
      const mob = new Mobject();
      let receivedDt = -1;
      mob.addUpdater((_m: Mobject, dt: number) => { receivedDt = dt; });
      mob.update(0.5);
      expect(receivedDt).toBe(0.5);
    });

    it("suspendUpdating() prevents update()", () => {
      const mob = new Mobject();
      let callCount = 0;
      mob.addUpdater(() => { callCount++; });
      mob.suspendUpdating();
      mob.update();
      expect(callCount).toBe(0);
    });

    it("clearUpdaters() removes all updaters", () => {
      const mob = new Mobject();
      mob.addUpdater(() => {});
      mob.addUpdater(() => {});
      expect(mob.updaters).toHaveLength(2);
      mob.clearUpdaters();
      expect(mob.updaters).toHaveLength(0);
    });
  });

  describe("color", () => {
    it("setColor() sets color on self", () => {
      const mob = new Mobject();
      mob.setColor(PURE_YELLOW, false);
      expect(mob.getColor().toHex()).toBe(PURE_YELLOW.toHex());
    });

    it("setColor() propagates to submobjects by default", () => {
      const parent = new Mobject();
      const child = new Mobject();
      parent.add(child);
      parent.setColor(PURE_YELLOW);
      expect(child.getColor().toHex()).toBe(PURE_YELLOW.toHex());
    });
  });

  describe("copy", () => {
    it("copy() creates independent clone", () => {
      const mob = makeMobjectWithPoints([[1, 2, 3]]);
      mob.zIndex = 7;
      const clone = mob.copy();
      expect(clone).not.toBe(mob);
      expect(clone.zIndex).toBe(7);
      expect(clone.getNumPoints()).toBe(1);
      // Mutating original should not affect clone
      mob.zIndex = 99;
      expect(clone.zIndex).toBe(7);
    });
  });

  describe("state", () => {
    it("saveState/restore round-trips", () => {
      const mob = makeMobjectWithPoints([
        [-1, 0, 0],
        [1, 0, 0],
      ]);
      mob.saveState();
      mob.shift(np.array([10, 0, 0]) as Point3D);
      expect(mob.getX()).toBeCloseTo(10);
      mob.restore();
      expect(mob.getX()).toBeCloseTo(0, 4);
    });

    it("restore() throws if no saved state", () => {
      const mob = new Mobject();
      expect(() => mob.restore()).toThrow();
    });
  });

  describe("z-index", () => {
    it("setZIndex() sets on self and children", () => {
      const parent = new Mobject();
      const child = new Mobject();
      parent.add(child);
      parent.setZIndex(5);
      expect(parent.zIndex).toBe(5);
      expect(child.zIndex).toBe(5);
    });
  });

  describe("rotation", () => {
    it("rotate() rotates points around Z axis", () => {
      const mob = makeMobjectWithPoints([[1, 0, 0]]);
      mob.rotate(Math.PI / 2, OUT, { aboutPoint: ORIGIN });
      // After 90° around Z, (1,0,0) → (0,1,0)
      const arr = mob.points.toArray() as number[][];
      expect(arr[0][0]).toBeCloseTo(0, 5);
      expect(arr[0][1]).toBeCloseTo(1, 5);
      expect(arr[0][2]).toBeCloseTo(0, 5);
    });
  });
});

describe("Group", () => {
  it("creates with mobjects", () => {
    const m1 = new Mobject({ name: "m1" });
    const m2 = new Mobject({ name: "m2" });
    const group = new Group(m1, m2);
    expect(group.submobjects).toHaveLength(2);
  });

  it("inherits from Mobject", () => {
    const group = new Group();
    expect(group).toBeInstanceOf(Mobject);
  });
});
