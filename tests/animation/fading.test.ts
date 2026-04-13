/**
 * Tests for animation/fading — FadeIn, FadeOut.
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np, DOWN, ORIGIN } from "../../src/core/math/index.js";
import type { Point3D } from "../../src/core/math/index.js";

import { FadeIn, FadeOut } from "../../src/animation/fading/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";

// ─── Helpers ──────────────────────────────────────────────────

/** Create a Mobject centered at a given point. */
function makeMobject(center: number[] = [0, 0, 0]): Mobject {
  const m = new Mobject();
  m.moveTo(np.array(center));
  return m;
}

// ─── FadeIn ──────────────────────────────────────────────────

describe("FadeIn", () => {
  it("constructs with a single mobject", () => {
    const mob = makeMobject();
    const anim = new FadeIn(mob);
    expect(anim.introducer).toBe(true);
    expect(anim.remover).toBe(false);
  });

  it("uses default runTime of 1", () => {
    const anim = new FadeIn(makeMobject());
    expect(anim.runTime).toBe(1);
  });

  it("accepts custom runTime", () => {
    const anim = new FadeIn(makeMobject(), { runTime: 2.5 });
    expect(anim.runTime).toBe(2.5);
  });

  it("createTarget returns the mobject itself", () => {
    const mob = makeMobject();
    const anim = new FadeIn(mob);
    expect(anim.createTarget()).toBe(anim.mobject);
  });

  it("createStartingMobject returns a copy (not the original)", () => {
    const mob = makeMobject();
    const anim = new FadeIn(mob);
    const start = anim.createStartingMobject();
    expect(start).not.toBe(mob);
  });

  it("throws when no mobjects are passed", () => {
    expect(() => new FadeIn({ runTime: 1 } as unknown as Mobject)).toThrow();
  });

  it("accepts a shift vector", () => {
    const mob = makeMobject();
    const anim = new FadeIn(mob, { shift: DOWN });
    expect(anim).toBeDefined();
    expect(anim.introducer).toBe(true);
  });

  it("accepts a targetPosition as a point", () => {
    const mob = makeMobject([0, 0, 0]);
    const anim = new FadeIn(mob, { targetPosition: np.array([3, 0, 0]) });
    expect(anim).toBeDefined();
  });

  it("accepts a targetPosition as a Mobject", () => {
    const mob = makeMobject([0, 0, 0]);
    const target = makeMobject([5, 5, 0]);
    const anim = new FadeIn(mob, { targetPosition: target });
    expect(anim).toBeDefined();
  });

  it("accepts a scale factor", () => {
    const mob = makeMobject();
    const anim = new FadeIn(mob, { scale: 0.5 });
    expect(anim).toBeDefined();
  });
});

// ─── FadeOut ─────────────────────────────────────────────────

describe("FadeOut", () => {
  it("constructs with a single mobject", () => {
    const mob = makeMobject();
    const anim = new FadeOut(mob);
    expect(anim.remover).toBe(true);
    expect(anim.introducer).toBe(false);
  });

  it("createTarget returns a copy (the faded version)", () => {
    const mob = makeMobject();
    const anim = new FadeOut(mob);
    const target = anim.createTarget();
    expect(target).not.toBe(mob);
  });

  it("accepts shift, scale, and targetPosition options", () => {
    const mob = makeMobject();
    const anim = new FadeOut(mob, {
      shift: DOWN,
      scale: 1.5,
    });
    expect(anim.remover).toBe(true);
  });

  it("handles multiple mobjects by grouping them", () => {
    const m1 = makeMobject([0, 0, 0]);
    const m2 = makeMobject([1, 0, 0]);
    const anim = new FadeOut(m1, m2);
    expect(anim.remover).toBe(true);
  });
});
