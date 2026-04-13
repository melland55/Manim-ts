import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np, ORIGIN, UP, DOWN, LEFT, RIGHT, OUT, PI } from "../../../src/core/math/index.js";
import {
  OpenGLMobject,
  OpenGLGroup,
  OpenGLPoint,
  _AnimationBuilder,
} from "../../../src/mobject/opengl/opengl_mobject.js";

describe("OpenGLMobject", () => {
  it("constructs with defaults", () => {
    const mob = new OpenGLMobject();
    expect(mob.name).toBe("OpenGLMobject");
    expect(mob.dim).toBe(3);
    expect(mob.opacity).toBe(1);
    expect(mob.depthTest).toBe(false);
    expect(mob.shouldRender).toBe(true);
    expect(mob.submobjects).toHaveLength(0);
    expect(mob.getNumPoints()).toBe(0);
  });

  it("constructs with custom options", () => {
    const mob = new OpenGLMobject({
      name: "TestMob",
      opacity: 0.5,
      gloss: 0.3,
      shadow: 0.2,
      depthTest: true,
    });
    expect(mob.name).toBe("TestMob");
    expect(mob.opacity).toBe(0.5);
    expect(mob.gloss).toBeCloseTo(0.3);
    expect(mob.shadow).toBeCloseTo(0.2);
    expect(mob.depthTest).toBe(true);
  });

  it("setPoints and getNumPoints work correctly", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[1, 2, 3], [4, 5, 6]]));
    expect(mob.getNumPoints()).toBe(2);
    expect(mob.hasPoints()).toBe(true);
  });

  it("clearPoints resets to empty", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[1, 0, 0]]));
    expect(mob.hasPoints()).toBe(true);
    mob.clearPoints();
    expect(mob.hasPoints()).toBe(false);
    expect(mob.getNumPoints()).toBe(0);
  });

  it("appendPoints adds to existing points", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[1, 0, 0]]));
    mob.appendPoints(np.array([[0, 1, 0]]));
    expect(mob.getNumPoints()).toBe(2);
  });

  it("shift moves the mobject", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[0, 0, 0], [1, 0, 0]]));
    mob.shift(np.array([1, 2, 0]));
    const center = mob.getCenter();
    expect(center).toBeCloseToPoint(np.array([1.5, 2, 0]));
  });

  it("scale scales about origin by default", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[1, 0, 0], [2, 0, 0]]));
    mob.scale(2);
    expect(mob.getWidth()).toBeCloseTo(2);
  });

  it("add and remove submobjects", () => {
    const parent = new OpenGLMobject();
    const child1 = new OpenGLMobject({ name: "child1" });
    const child2 = new OpenGLMobject({ name: "child2" });

    parent.add(child1, child2);
    expect(parent.submobjects).toHaveLength(2);
    expect(child1.parent).toBe(parent);

    parent.remove(child1);
    expect(parent.submobjects).toHaveLength(1);
    expect(parent.submobjects[0]).toBe(child2);
  });

  it("cannot add self as submobject", () => {
    const mob = new OpenGLMobject();
    expect(() => mob.add(mob)).toThrow();
  });

  it("getFamily includes self and descendants", () => {
    const parent = new OpenGLMobject();
    const child = new OpenGLMobject();
    const grandchild = new OpenGLMobject();
    child.add(grandchild);
    parent.add(child);
    const family = parent.getFamily();
    expect(family).toContain(parent);
    expect(family).toContain(child);
    expect(family).toContain(grandchild);
  });

  it("bounding box computes correctly", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[-1, -2, 0], [3, 4, 0]]));
    const bb = mob.getBoundingBox();
    // mins
    expect(bb.get([0, 0])).toBeCloseTo(-1);
    expect(bb.get([0, 1])).toBeCloseTo(-2);
    // mids
    expect(bb.get([1, 0])).toBeCloseTo(1);
    expect(bb.get([1, 1])).toBeCloseTo(1);
    // maxs
    expect(bb.get([2, 0])).toBeCloseTo(3);
    expect(bb.get([2, 1])).toBeCloseTo(4);
  });

  it("width/height/depth getters work", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[-1, -2, -3], [1, 2, 3]]));
    expect(mob.getWidth()).toBeCloseTo(2);
    expect(mob.getHeight()).toBeCloseTo(4);
    expect(mob.getDepth()).toBeCloseTo(6);
  });

  it("updaters work", () => {
    const mob = new OpenGLMobject();
    let called = false;
    const updater = () => { called = true; };
    mob.addUpdater(updater);
    expect(mob.getUpdaters()).toHaveLength(1);
    expect(called).toBe(true); // callUpdater defaults to true

    mob.removeUpdater(updater);
    expect(mob.getUpdaters()).toHaveLength(0);
  });

  it("suspendUpdating prevents updates", () => {
    const mob = new OpenGLMobject();
    let count = 0;
    mob.addUpdater(() => { count++; }, undefined, false);
    mob.update(0, false);
    expect(count).toBe(1);
    mob.suspendUpdating(false);
    mob.update(0, false);
    expect(count).toBe(1); // Not updated
    mob.resumeUpdating(false, false);
    mob.update(0, false);
    expect(count).toBe(2);
  });

  it("copy creates independent copy", () => {
    const mob = new OpenGLMobject({ name: "original" });
    mob.setPoints(np.array([[1, 2, 3]]));
    const copied = mob.copy();
    expect(copied.name).toBe("original");
    expect(copied.getNumPoints()).toBe(1);
    // Modifying copy doesn't affect original
    copied.clearPoints();
    expect(mob.getNumPoints()).toBe(1);
  });

  it("set assigns arbitrary attributes", () => {
    const mob = new OpenGLMobject();
    mob.set({ opacity: 0.5 });
    expect(mob.opacity).toBe(0.5);
  });

  it("moveTo positions correctly", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[0, 0, 0], [2, 0, 0]]));
    mob.moveTo(np.array([5, 5, 0]));
    expect(mob.getCenter()).toBeCloseToPoint(np.array([5, 5, 0]));
  });

  it("rotate rotates points", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[1, 0, 0]]));
    mob.rotate(PI / 2, OUT, { aboutPoint: ORIGIN });
    const p = mob.getStart();
    expect(p.get([0]) as number).toBeCloseTo(0, 5);
    expect(p.get([1]) as number).toBeCloseTo(1, 5);
  });

  it("hierarchicalModelMatrix returns identity when no parent", () => {
    const mob = new OpenGLMobject();
    const mat = mob.hierarchicalModelMatrix();
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(mat.get([i, j]) as number).toBeCloseTo(i === j ? 1 : 0);
      }
    }
  });
});

describe("OpenGLGroup", () => {
  it("accepts mobjects in constructor", () => {
    const a = new OpenGLMobject({ name: "a" });
    const b = new OpenGLMobject({ name: "b" });
    const group = new OpenGLGroup(a, b);
    expect(group.submobjects).toHaveLength(2);
  });
});

describe("OpenGLPoint", () => {
  it("constructs at origin by default", () => {
    const pt = new OpenGLPoint();
    expect(pt.getLocation()).toBeCloseToPoint(ORIGIN);
  });

  it("constructs at given location", () => {
    const loc = np.array([3, 4, 5]);
    const pt = new OpenGLPoint(loc);
    expect(pt.getLocation()).toBeCloseToPoint(loc);
  });

  it("returns artificial dimensions", () => {
    const pt = new OpenGLPoint(ORIGIN, { artificialWidth: 0.5, artificialHeight: 0.3 });
    expect(pt.getWidth()).toBeCloseTo(0.5);
    expect(pt.getHeight()).toBeCloseTo(0.3);
  });

  it("getBoundingBoxPoint returns location", () => {
    const loc = np.array([1, 2, 3]);
    const pt = new OpenGLPoint(loc);
    expect(pt.getBoundingBoxPoint(UP)).toBeCloseToPoint(loc);
    expect(pt.getBoundingBoxPoint(RIGHT)).toBeCloseToPoint(loc);
  });

  it("setLocation changes position", () => {
    const pt = new OpenGLPoint();
    pt.setLocation(np.array([7, 8, 9]));
    expect(pt.getLocation()).toBeCloseToPoint(np.array([7, 8, 9]));
  });
});

describe("_AnimationBuilder", () => {
  it("build applies methods to target copy", () => {
    const mob = new OpenGLMobject();
    mob.setPoints(np.array([[0, 0, 0], [1, 0, 0]]));
    const builder = mob.animate;
    // Access via proxy - shift method
    const chained = (builder as unknown as OpenGLMobject).shift(np.array([5, 0, 0]));
    const result = (chained as unknown as _AnimationBuilder).build();
    expect(result.mobject).toBe(mob);
    // Target should be shifted
    const targetCenter = result.targetMobject.getCenter();
    expect(targetCenter.get([0]) as number).toBeCloseTo(5.5);
    // Original should be unchanged
    expect((mob.getCenter().get([0]) as number)).toBeCloseTo(0.5);
  });
});
