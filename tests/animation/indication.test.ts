/**
 * Tests for src/animation/indication — FocusOn, Indicate, Flash,
 * ShowPassingFlash, ApplyWave, Wiggle, Circumscribe, Blink.
 */

import { describe, it, expect } from "vitest";
import {
  FocusOn,
  Indicate,
  Flash,
  ShowPassingFlash,
  ShowPassingFlashWithThinningStrokeWidth,
  ApplyWave,
  Wiggle,
  Circumscribe,
  Blink,
} from "../../src/animation/indication/index.js";
import { np, thereAndBack, smooth, TAU } from "../../src/core/math/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";
import { GREY, PURE_YELLOW } from "../../src/utils/color/manim_colors.js";
import { Animation } from "../../src/animation/animation/index.js";

// ── Helpers ─────────────────────────────────────────────────

function makeMobject(): Mobject {
  const mob = new Mobject();
  mob.points = np.array([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
  return mob;
}

// ── FocusOn ─────────────────────────────────────────────────

describe("FocusOn", () => {
  it("constructs with default options", () => {
    const point = np.array([1, 2, 0]);
    const anim = new FocusOn(point);
    expect(anim.runTime).toBe(2);
    expect(anim.remover).toBe(true);
  });

  it("accepts custom run_time and opacity", () => {
    const point = np.array([0, 0, 0]);
    const anim = new FocusOn(point, { runTime: 3, opacity: 0.5 });
    expect(anim.runTime).toBe(3);
  });

  it("accepts a Mobject as focus point", () => {
    const mob = makeMobject();
    const anim = new FocusOn(mob);
    expect(anim.runTime).toBe(2);
  });
});

// ── Indicate ────────────────────────────────────────────────

describe("Indicate", () => {
  it("constructs with defaults", () => {
    const mob = makeMobject();
    const anim = new Indicate(mob);
    expect(anim.runTime).toBe(1.0);
  });

  it("accepts custom scale factor", () => {
    const mob = makeMobject();
    const anim = new Indicate(mob, { scaleFactor: 1.5 });
    expect(anim).toBeInstanceOf(Animation);
  });

  it("uses thereAndBack as default rate function", () => {
    const mob = makeMobject();
    const anim = new Indicate(mob);
    // thereAndBack(0) = 0, thereAndBack(0.5) = 1, thereAndBack(1) = 0
    expect(anim.rateFunc(0)).toBeCloseTo(0);
    expect(anim.rateFunc(1)).toBeCloseTo(0);
  });
});

// ── Flash ───────────────────────────────────────────────────

describe("Flash", () => {
  it("constructs with a point", () => {
    const point = np.array([0, 0, 0]);
    const anim = new Flash(point);
    expect(anim).toBeInstanceOf(Animation);
  });

  it("defaults to 12 lines", () => {
    const point = np.array([1, 0, 0]);
    const anim = new Flash(point);
    expect(anim.lines.submobjects.length).toBe(12);
  });

  it("accepts custom numLines", () => {
    const point = np.array([0, 0, 0]);
    const anim = new Flash(point, { numLines: 8 });
    expect(anim.lines.submobjects.length).toBe(8);
  });

  it("resolves Mobject to its center", () => {
    const mob = makeMobject();
    const anim = new Flash(mob);
    // Mobject center is derived from points
    expect(anim.point).toBeDefined();
  });
});

// ── ShowPassingFlash ────────────────────────────────────────

describe("ShowPassingFlash", () => {
  it("constructs with default time_width", () => {
    const mob = makeMobject();
    // ShowPassingFlash requires pointwiseBecomePartial
    (mob as unknown as Record<string, unknown>).pointwiseBecomePartial = () => {};
    const anim = new ShowPassingFlash(mob, { timeWidth: 0.3 });
    expect(anim.timeWidth).toBe(0.3);
    expect(anim.remover).toBe(true);
    expect(anim.introducer).toBe(true);
  });

  it("_getBounds returns correct bounds at alpha=0", () => {
    const mob = makeMobject();
    (mob as unknown as Record<string, unknown>).pointwiseBecomePartial = () => {};
    const anim = new ShowPassingFlash(mob, { timeWidth: 0.5 });
    const bounds = (anim as unknown as { _getBounds(a: number): [number, number] })._getBounds(0);
    expect(bounds[0]).toBe(0);
    expect(bounds[1]).toBe(0);
  });

  it("_getBounds at alpha=1 returns [lower, 1]", () => {
    const mob = makeMobject();
    (mob as unknown as Record<string, unknown>).pointwiseBecomePartial = () => {};
    const anim = new ShowPassingFlash(mob, { timeWidth: 0.5 });
    const bounds = (anim as unknown as { _getBounds(a: number): [number, number] })._getBounds(1);
    expect(bounds[1]).toBe(1);
    expect(bounds[0]).toBe(1); // upper = 1+0.5 → clamped to 1, lower = 1-0.5=1.0
  });
});

// ── ApplyWave ───────────────────────────────────────────────

describe("ApplyWave", () => {
  it("constructs with defaults", () => {
    const mob = makeMobject();
    const anim = new ApplyWave(mob);
    expect(anim.runTime).toBe(2);
  });

  it("accepts custom amplitude and ripples", () => {
    const mob = makeMobject();
    const anim = new ApplyWave(mob, { amplitude: 0.5, ripples: 3 });
    expect(anim.runTime).toBe(2);
  });
});

// ── Wiggle ──────────────────────────────────────────────────

describe("Wiggle", () => {
  it("constructs with defaults", () => {
    const mob = makeMobject();
    const anim = new Wiggle(mob);
    expect(anim.runTime).toBe(2);
  });

  it("accepts custom nWiggles and rotation angle", () => {
    const mob = makeMobject();
    const anim = new Wiggle(mob, {
      nWiggles: 10,
      rotationAngle: 0.02 * TAU,
    });
    expect(anim).toBeInstanceOf(Animation);
  });
});

// ── Circumscribe ────────────────────────────────────────────

describe("Circumscribe", () => {
  it("constructs with Rectangle shape by default", () => {
    const mob = makeMobject();
    const anim = new Circumscribe(mob);
    expect(anim).toBeInstanceOf(Animation);
  });

  it("throws for invalid shape", () => {
    const mob = makeMobject();
    expect(() => {
      new Circumscribe(mob, { shape: "Triangle" as "Rectangle" });
    }).toThrow("shape should be either");
  });
});

// ── Blink ───────────────────────────────────────────────────

describe("Blink", () => {
  it("constructs with defaults (1 blink, not hidden at end)", () => {
    const mob = makeMobject();
    const anim = new Blink(mob);
    expect(anim).toBeInstanceOf(Animation);
  });

  it("accepts custom blinks count", () => {
    const mob = makeMobject();
    const anim = new Blink(mob, { blinks: 3 });
    expect(anim).toBeInstanceOf(Animation);
  });
});
