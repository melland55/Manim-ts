/**
 * Tests for animation/transform_matching_parts —
 * TransformMatchingShapes, TransformMatchingTex, TransformMatchingAbstractBase.
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np } from "../../src/core/math/index.js";
import { Mobject, Group } from "../../src/mobject/mobject/index.js";
import {
  TransformMatchingAbstractBase,
  TransformMatchingShapes,
  TransformMatchingTex,
} from "../../src/animation/transform_matching_parts/index.js";

// ─── Helpers ────────────────────────────────────────────────

/** Create a Mobject with some points so familyMembersWithPoints finds it. */
function makeMobjectWithPoints(pts: number[][] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]): Mobject {
  const m = new Mobject();
  m.points = np.array(pts);
  return m;
}

/** Create a Mobject with a texString property for TransformMatchingTex. */
function makeTexMobject(texString: string, subPts: number[][][] = [[[0, 0, 0]]]): Mobject {
  const m = new Mobject() as Mobject & { texString: string };
  (m as unknown as { texString: string }).texString = texString;
  // Add submobjects with points
  for (const pts of subPts) {
    const sub = new Mobject();
    sub.points = np.array(pts);
    m.add(sub);
  }
  return m;
}

// ─── TransformMatchingShapes ────────────────────────────────

describe("TransformMatchingShapes", () => {
  it("constructs with two mobjects", () => {
    const source = new Group(makeMobjectWithPoints());
    const target = new Group(makeMobjectWithPoints());
    const anim = new TransformMatchingShapes(source, target);
    expect(anim).toBeDefined();
  });

  it("getMobjectParts returns family members with points", () => {
    const parent = new Group(
      makeMobjectWithPoints([[0, 0, 0], [1, 0, 0]]),
      makeMobjectWithPoints([[2, 0, 0], [3, 0, 0]]),
    );
    const parts = TransformMatchingShapes.getMobjectParts(parent);
    // Should include the child mobjects that have points (not the Group itself if it has no points)
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it("getMobjectKey returns a number", () => {
    const mob = makeMobjectWithPoints([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]);
    const key = TransformMatchingShapes.getMobjectKey(mob);
    expect(typeof key).toBe("number");
  });

  it("getMobjectKey returns same hash for identical shapes", () => {
    const mob1 = makeMobjectWithPoints([[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
    const mob2 = makeMobjectWithPoints([[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
    expect(TransformMatchingShapes.getMobjectKey(mob1))
      .toBe(TransformMatchingShapes.getMobjectKey(mob2));
  });

  it("getMobjectKey returns same hash for translated copies", () => {
    const mob1 = makeMobjectWithPoints([[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
    const mob2 = makeMobjectWithPoints([[5, 5, 0], [6, 5, 0], [6, 6, 0]]);
    // After centering and normalizing height, these should match
    expect(TransformMatchingShapes.getMobjectKey(mob1))
      .toBe(TransformMatchingShapes.getMobjectKey(mob2));
  });

  it("getMobjectKey returns different hash for different shapes", () => {
    const mob1 = makeMobjectWithPoints([[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
    const mob2 = makeMobjectWithPoints([[0, 0, 0], [2, 0, 0], [0, 1, 0]]);
    expect(TransformMatchingShapes.getMobjectKey(mob1))
      .not.toBe(TransformMatchingShapes.getMobjectKey(mob2));
  });

  it("accepts transformMismatches option", () => {
    const source = new Group(makeMobjectWithPoints());
    const target = new Group(makeMobjectWithPoints([[5, 5, 0], [6, 5, 0]]));
    const anim = new TransformMatchingShapes(source, target, {
      transformMismatches: true,
    });
    expect(anim).toBeDefined();
  });

  it("accepts fadeTransformMismatches option", () => {
    const source = new Group(makeMobjectWithPoints());
    const target = new Group(makeMobjectWithPoints([[5, 5, 0], [6, 5, 0]]));
    const anim = new TransformMatchingShapes(source, target, {
      fadeTransformMismatches: true,
    });
    expect(anim).toBeDefined();
  });
});

// ─── TransformMatchingTex ───────────────────────────────────

describe("TransformMatchingTex", () => {
  it("constructs with two tex mobjects", () => {
    const source = makeTexMobject("x^2");
    const target = makeTexMobject("x^2");
    const anim = new TransformMatchingTex(source, target);
    expect(anim).toBeDefined();
  });

  it("getMobjectKey returns the tex string", () => {
    const mob = makeTexMobject("\\frac{a}{b}");
    const sub = mob.submobjects[0];
    (sub as unknown as { texString: string }).texString = "\\frac{a}{b}";
    expect(TransformMatchingTex.getMobjectKey(sub)).toBe("\\frac{a}{b}");
  });

  it("getMobjectParts returns submobjects for non-Group mobjects", () => {
    const mob = makeTexMobject("x", [[[0, 0, 0]], [[1, 0, 0]]]);
    const parts = TransformMatchingTex.getMobjectParts(mob);
    expect(parts.length).toBe(2);
  });

  it("getMobjectParts recurses into Group submobjects", () => {
    const tex1 = makeTexMobject("a", [[[0, 0, 0]]]);
    const tex2 = makeTexMobject("b", [[[1, 0, 0]]]);
    const group = new Group(tex1, tex2);
    const parts = TransformMatchingTex.getMobjectParts(group);
    // Should get submobjects from both tex1 and tex2
    expect(parts.length).toBe(2);
  });
});

// ─── TransformMatchingAbstractBase ──────────────────────────

describe("TransformMatchingAbstractBase", () => {
  it("has toRemove and toAdd properties", () => {
    const source = new Group(makeMobjectWithPoints());
    const target = new Group(makeMobjectWithPoints());
    const anim = new TransformMatchingShapes(source, target);
    expect(anim.toRemove).toBeInstanceOf(Array);
    expect(anim.toAdd).toBe(target);
  });

  it("base class getMobjectParts throws", () => {
    expect(() => TransformMatchingAbstractBase.getMobjectParts(new Mobject())).toThrow(
      "To be implemented in subclass",
    );
  });

  it("base class getMobjectKey throws", () => {
    expect(() => TransformMatchingAbstractBase.getMobjectKey(new Mobject())).toThrow(
      "To be implemented in subclass",
    );
  });
});
