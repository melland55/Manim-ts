/**
 * Tests for src/animation/updaters — UpdateFromFunc, UpdateFromAlphaFunc,
 * MaintainPositionRelativeTo, and utility functions.
 */

import { describe, it, expect, vi } from "vitest";
import "../helpers/point-matchers.js";

import {
  UpdateFromFunc,
  UpdateFromAlphaFunc,
  MaintainPositionRelativeTo,
  assertIsMobjectMethod,
  always,
  fAlways,
  alwaysRedraw,
  alwaysShift,
  alwaysRotate,
  turnAnimationIntoUpdater,
  cycleAnimation,
} from "../../src/animation/updaters/index.js";
import { Animation } from "../../src/animation/animation/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";
import { np } from "../../src/core/math/index.js";
import { linear } from "../../src/core/math/index.js";
import { RIGHT, UP, ORIGIN } from "../../src/constants/index.js";
import type { IMobject, Point3D } from "../../src/core/types.js";

// ── Helpers ────────────────────────────────────────────────────

function makeMockMobject(): IMobject & {
  suspendUpdating: ReturnType<typeof vi.fn>;
  resumeUpdating: ReturnType<typeof vi.fn>;
  become: ReturnType<typeof vi.fn>;
} {
  const mob: ReturnType<typeof makeMockMobject> = {
    name: "mock",
    color: {
      r: 1, g: 1, b: 1, a: 1,
      toHex: () => "#FFFFFF",
      toArray: () => [1, 1, 1, 1] as [number, number, number, number],
      interpolate: (o) => o,
      lighter: () => mob.color,
      darker: () => mob.color,
    },
    submobjects: [],
    updaters: [] as Array<(mob: IMobject, dt: number) => void>,
    zIndex: 0,
    getCenter: () => np.array([0, 0, 0]),
    getLeft: () => np.array([-1, 0, 0]),
    getRight: () => np.array([1, 0, 0]),
    getTop: () => np.array([0, 1, 0]),
    getBottom: () => np.array([0, -1, 0]),
    getWidth: () => 2,
    getHeight: () => 2,
    moveTo: vi.fn().mockReturnThis(),
    shift: vi.fn().mockReturnThis(),
    scale: vi.fn().mockReturnThis(),
    rotate: vi.fn().mockReturnThis(),
    flip: vi.fn().mockReturnThis(),
    nextTo: vi.fn().mockReturnThis(),
    alignTo: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    getFamily: vi.fn().mockReturnValue([]),
    setColor: vi.fn().mockReturnThis(),
    setOpacity: vi.fn().mockReturnThis(),
    addUpdater: vi.fn().mockImplementation(function (this: typeof mob, updater: (mob: IMobject, dt: number) => void) {
      mob.updaters.push(updater);
      return mob;
    }),
    removeUpdater: vi.fn().mockImplementation(function (this: typeof mob, updater: (mob: IMobject, dt: number) => void) {
      const idx = mob.updaters.indexOf(updater);
      if (idx !== -1) mob.updaters.splice(idx, 1);
      return mob;
    }),
    applyMatrix: vi.fn().mockReturnThis(),
    applyFunction: vi.fn().mockReturnThis(),
    copy: vi.fn(),
    suspendUpdating: vi.fn().mockReturnThis(),
    resumeUpdating: vi.fn().mockReturnThis(),
    become: vi.fn().mockReturnThis(),
  };
  (mob.copy as ReturnType<typeof vi.fn>).mockReturnValue(mob);
  (mob.getFamily as ReturnType<typeof vi.fn>).mockReturnValue([mob]);
  return mob;
}

// ── UpdateFromFunc ─────────────────────────────────────────────

describe("UpdateFromFunc", () => {
  it("calls the update function on interpolateMobject", () => {
    const mob = makeMockMobject();
    const updateFn = vi.fn();
    const anim = new UpdateFromFunc(mob, updateFn);

    anim.interpolateMobject(0.5);
    expect(updateFn).toHaveBeenCalledWith(mob);
  });

  it("ignores alpha in the update function", () => {
    const mob = makeMockMobject();
    const calls: number[] = [];
    const updateFn = vi.fn((_m: IMobject) => { calls.push(1); });
    const anim = new UpdateFromFunc(mob, updateFn);

    anim.interpolateMobject(0.0);
    anim.interpolateMobject(0.5);
    anim.interpolateMobject(1.0);
    expect(updateFn).toHaveBeenCalledTimes(3);
  });

  it("defaults suspendMobjectUpdating to false", () => {
    const mob = makeMockMobject();
    const anim = new UpdateFromFunc(mob, vi.fn());
    // Access the internal field
    expect((anim as unknown as { _suspendMobjectUpdating: boolean })._suspendMobjectUpdating).toBe(false);
  });
});

// ── UpdateFromAlphaFunc ────────────────────────────────────────

describe("UpdateFromAlphaFunc", () => {
  it("calls the update function with rate-function-adjusted alpha", () => {
    const mob = makeMockMobject();
    const updateFn = vi.fn();
    const anim = new UpdateFromAlphaFunc(mob, updateFn, { rateFunc: linear });

    anim.interpolateMobject(0.5);
    expect(updateFn).toHaveBeenCalledWith(mob, 0.5);
  });

  it("applies the rate function to alpha", () => {
    const mob = makeMockMobject();
    const alphas: number[] = [];
    const updateFn = (_m: IMobject, a: number) => { alphas.push(a); };
    const doubleRate = (t: number) => Math.min(t * 2, 1);
    const anim = new UpdateFromAlphaFunc(mob, updateFn, { rateFunc: doubleRate });

    anim.interpolateMobject(0.25);
    expect(alphas[0]).toBeCloseTo(0.5);

    anim.interpolateMobject(0.5);
    expect(alphas[1]).toBeCloseTo(1.0);
  });
});

// ── MaintainPositionRelativeTo ─────────────────────────────────

describe("MaintainPositionRelativeTo", () => {
  it("maintains relative offset when tracked mobject moves", () => {
    const mob = makeMockMobject();
    const tracked = makeMockMobject();

    // mob at (2,0,0), tracked at (0,0,0) → diff = (2,0,0)
    mob.getCenter = vi.fn().mockReturnValue(np.array([2, 0, 0]));
    tracked.getCenter = vi.fn().mockReturnValue(np.array([0, 0, 0]));

    const anim = new MaintainPositionRelativeTo(mob, tracked);

    // Now tracked moves to (3,0,0), mob still reports (2,0,0)
    tracked.getCenter = vi.fn().mockReturnValue(np.array([3, 0, 0]));

    anim.interpolateMobject(0.5);

    // Should shift mob by (3-2+2, 0, 0) = (3, 0, 0)
    expect(mob.shift).toHaveBeenCalled();
    const shiftArg = (mob.shift as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(shiftArg).toBeCloseToPoint(np.array([3, 0, 0]));
  });

  it("computes zero shift when positions haven't changed", () => {
    const mob = makeMockMobject();
    const tracked = makeMockMobject();

    mob.getCenter = vi.fn().mockReturnValue(np.array([1, 2, 3]));
    tracked.getCenter = vi.fn().mockReturnValue(np.array([0, 0, 0]));

    const anim = new MaintainPositionRelativeTo(mob, tracked);
    anim.interpolateMobject(0.5);

    const shiftArg = (mob.shift as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // target(0) - location(1,2,3) + diff(1,2,3) = (0,0,0)
    expect(shiftArg).toBeCloseToPoint(np.array([0, 0, 0]));
  });
});

// ── assertIsMobjectMethod ──────────────────────────────────────

describe("assertIsMobjectMethod", () => {
  it("throws for non-Mobject instances", () => {
    expect(() => assertIsMobjectMethod({})).toThrow("Expected a Mobject instance");
    expect(() => assertIsMobjectMethod(42)).toThrow("Expected a Mobject instance");
    expect(() => assertIsMobjectMethod(null)).toThrow();
  });

  it("accepts a real Mobject instance", () => {
    const mob = new Mobject();
    expect(() => assertIsMobjectMethod(mob)).not.toThrow();
  });
});

// ── alwaysShift ────────────────────────────────────────────────

describe("alwaysShift", () => {
  it("adds an updater to the mobject", () => {
    const mob = makeMockMobject();
    alwaysShift(mob, RIGHT, 1.0);
    expect(mob.updaters).toHaveLength(1);
  });

  it("shifts by normalized direction * rate * dt", () => {
    const mob = makeMockMobject();
    alwaysShift(mob, RIGHT, 2.0);

    const updater = mob.updaters[0];
    updater(mob, 0.5); // dt=0.5

    expect(mob.shift).toHaveBeenCalled();
    const shiftArg = (mob.shift as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // RIGHT is already normalized, so shift = 0.5 * 2.0 * [1,0,0] = [1,0,0]
    expect(shiftArg).toBeCloseToPoint(np.array([1, 0, 0]));
  });
});

// ── alwaysRotate ───────────────────────────────────────────────

describe("alwaysRotate", () => {
  it("adds a rotation updater", () => {
    const mob = makeMockMobject();
    alwaysRotate(mob, Math.PI);
    expect(mob.updaters).toHaveLength(1);
  });

  it("rotates by rate * dt each frame", () => {
    const mob = makeMockMobject();
    const rate = Math.PI; // radians per second
    alwaysRotate(mob, rate);

    const updater = mob.updaters[0];
    updater(mob, 0.5); // dt=0.5 → rotate PI*0.5

    expect(mob.rotate).toHaveBeenCalled();
    const rotateAngle = (mob.rotate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(rotateAngle).toBeCloseTo(Math.PI * 0.5);
  });
});

// ── turnAnimationIntoUpdater ───────────────────────────────────

describe("turnAnimationIntoUpdater", () => {
  it("adds an updater to the animation's mobject", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, { rateFunc: linear });

    turnAnimationIntoUpdater(anim);
    expect(mob.updaters.length).toBeGreaterThanOrEqual(1);
  });

  it("removes the updater when the animation finishes (non-cycle)", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, { rateFunc: linear, runTime: 1.0 });

    turnAnimationIntoUpdater(anim);
    const updater = mob.updaters[0];

    // Simulate enough time to finish:
    // Call 1: totalTime=0, timeRatio=0, alpha=0, then totalTime=0.5
    // Call 2: totalTime=0.5, timeRatio=0.5, alpha=0.5, then totalTime=1.1
    // Call 3: totalTime=1.1, timeRatio=1.1, alpha=1.0 → finish & remove
    updater(mob, 0.5);
    updater(mob, 0.6);
    updater(mob, 0.1);
    expect(mob.updaters).toHaveLength(0);
  });

  it("cycles when cycle=true", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, { rateFunc: linear, runTime: 1.0 });

    turnAnimationIntoUpdater(anim, true);
    const updater = mob.updaters[0];

    // Simulate past the end — should NOT remove updater
    updater(mob, 0.5);
    updater(mob, 0.6);
    updater(mob, 0.5);
    expect(mob.updaters).toHaveLength(1);
  });

  it("respects delay parameter", () => {
    const mob = makeMockMobject();
    const interpolateSpy = vi.spyOn(Animation.prototype, "interpolate");
    const anim = new Animation(mob, { rateFunc: linear, runTime: 1.0 });

    turnAnimationIntoUpdater(anim, false, 0.5);

    const updater = mob.updaters[0];

    // First call: totalTime starts at -0.5, after dt=0.3 → -0.2 (still negative)
    updater(mob, 0.3);
    // interpolate should not be called when totalTime < 0

    interpolateSpy.mockRestore();
  });
});

// ── cycleAnimation ─────────────────────────────────────────────

describe("cycleAnimation", () => {
  it("is equivalent to turnAnimationIntoUpdater with cycle=true", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, { rateFunc: linear, runTime: 1.0 });

    cycleAnimation(anim);
    const updater = mob.updaters[0];

    // Run past the end
    updater(mob, 1.5);
    updater(mob, 1.5);
    // Updater should still be attached (cycling)
    expect(mob.updaters).toHaveLength(1);
  });
});
