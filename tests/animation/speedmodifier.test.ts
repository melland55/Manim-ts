import { describe, it, expect, beforeEach } from "vitest";
import { ChangeSpeed } from "../../src/animation/speedmodifier/index.js";
import type {
  IAnimationExt,
  IAnimationGroup,
} from "../../src/animation/speedmodifier/index.js";
import type { IScene, IMobject, RateFunc } from "../../src/core/types.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a minimal mock animation for testing. */
function makeMockAnim(
  runTime: number = 1,
  rateFunc: RateFunc = (t) => t,
): IAnimationExt {
  return {
    mobject: null as unknown as IMobject,
    runTime,
    rateFunc,
    lagRatio: 0,
    name: "MockAnim",
    remover: false,
    introducer: false,
    _setRateFunc: rateFunc, // will be replaced by setRateFunc
    setRateFunc(fn: RateFunc) {
      this.rateFunc = fn;
      return this;
    },
    begin() {},
    finish() {},
    interpolate(_alpha: number) {},
    interpolateMobject(_alpha: number) {},
    interpolateSubmobject(_s: IMobject, _t: IMobject, _a: number) {},
    setupScene(_scene: IScene) {},
    cleanUpFromScene(_scene: IScene) {},
    getAllMobjects() {
      return [];
    },
    copy() {
      return { ...this };
    },
    isFinished(alpha: number) {
      return alpha >= 1;
    },
    getRunTime() {
      return this.runTime;
    },
    updateMobjects(_dt: number) {},
  };
}

/** Minimal mock mobject with updater tracking. */
function makeMockMobject(): IMobject & {
  _updaters: Array<(mob: IMobject, dt: number) => void>;
} {
  const mob = {
    name: "MockMob",
    color: null as unknown as IMobject["color"],
    submobjects: [] as IMobject[],
    updaters: [] as IMobject["updaters"],
    zIndex: 0,
    _updaters: [] as Array<(mob: IMobject, dt: number) => void>,
    getCenter: () => null as unknown as ReturnType<IMobject["getCenter"]>,
    getLeft: () => null as unknown as ReturnType<IMobject["getLeft"]>,
    getRight: () => null as unknown as ReturnType<IMobject["getRight"]>,
    getTop: () => null as unknown as ReturnType<IMobject["getTop"]>,
    getBottom: () => null as unknown as ReturnType<IMobject["getBottom"]>,
    getWidth: () => 0,
    getHeight: () => 0,
    moveTo() { return mob; },
    shift() { return mob; },
    scale() { return mob; },
    rotate() { return mob; },
    flip() { return mob; },
    nextTo() { return mob; },
    alignTo() { return mob; },
    add() { return mob; },
    remove() { return mob; },
    getFamily() { return [mob]; },
    setColor() { return mob; },
    setOpacity() { return mob; },
    addUpdater(
      updater: (mob: IMobject, dt: number) => void,
      _index?: number,
      callUpdater?: boolean,
    ) {
      mob._updaters.push(updater);
      mob.updaters.push(updater);
      if (callUpdater) updater(mob, 0);
      return mob;
    },
    removeUpdater(updater: (mob: IMobject, dt: number) => void) {
      mob._updaters = mob._updaters.filter((u) => u !== updater);
      mob.updaters = mob.updaters.filter((u) => u !== updater);
      return mob;
    },
    applyMatrix() { return mob; },
    applyFunction() { return mob; },
    copy() { return { ...mob }; },
  };
  return mob;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChangeSpeed", () => {
  beforeEach(() => {
    // Reset static state between tests.
    ChangeSpeed.dt = 0;
    ChangeSpeed.isChangingDt = false;
  });

  // ── Construction ────────────────────────────────────────────────────────────

  it("constructs with minimal speedinfo and default options", () => {
    const anim = makeMockAnim(2);
    const cs = new ChangeSpeed(anim, { 0.5: 0.5 });

    expect(cs).toBeInstanceOf(ChangeSpeed);
    expect(cs.anim).toBe(anim);
    expect(cs.affectsSpeedUpdaters).toBe(true);
    expect(cs.remover).toBe(false);
    expect(cs.introducer).toBe(false);
    expect(cs.lagRatio).toBe(0);
  });

  it("sets isChangingDt when affectsSpeedUpdaters is true", () => {
    const anim = makeMockAnim();
    expect(ChangeSpeed.isChangingDt).toBe(false);

    new ChangeSpeed(anim, { 0.5: 2 }, null, true);
    expect(ChangeSpeed.isChangingDt).toBe(true);
  });

  it("does NOT set isChangingDt when affectsSpeedUpdaters is false", () => {
    const anim = makeMockAnim();
    new ChangeSpeed(anim, { 0.5: 2 }, null, false);
    expect(ChangeSpeed.isChangingDt).toBe(false);
  });

  it("throws when two speed-affecting ChangeSpeed animations are active", () => {
    const anim1 = makeMockAnim();
    const anim2 = makeMockAnim();

    new ChangeSpeed(anim1, { 0.5: 2 }, null, true);
    expect(() => new ChangeSpeed(anim2, { 0.5: 2 }, null, true)).toThrow(
      /Only one animation at a time/,
    );
  });

  it("accepts a custom rate_func override", () => {
    const anim = makeMockAnim(1, (t) => t);
    const quadratic: RateFunc = (t) => t * t;

    const cs = new ChangeSpeed(anim, { 0.5: 2 }, quadratic, false);
    expect(cs.rateFunc).toBe(quadratic);
  });

  it("inherits anim.rateFunc when no rate_func is given", () => {
    const myRate: RateFunc = (t) => t * t;
    const anim = makeMockAnim(1, myRate);

    const cs = new ChangeSpeed(anim, { 0.5: 2 }, null, false);
    expect(cs.rateFunc).toBe(myRate);
  });

  // ── getScaledTotalTime ───────────────────────────────────────────────────────

  it("getScaledTotalTime returns 1 for uniform speed (speed=1 everywhere)", () => {
    const anim = makeMockAnim();
    const cs = new ChangeSpeed(anim, { 0: 1, 1: 1 }, null, false);
    expect(cs.getScaledTotalTime()).toBeCloseTo(1, 10);
  });

  it("getScaledTotalTime > 1 when animation is slowed down", () => {
    // Speed of 0.5 means it takes twice as long.
    const anim = makeMockAnim();
    const cs = new ChangeSpeed(anim, { 0: 0.5, 1: 0.5 }, null, false);
    // f_inv_1(0.5, 0.5) = 2 / (0.5 + 0.5) = 2
    expect(cs.getScaledTotalTime()).toBeCloseTo(2, 10);
  });

  it("getScaledTotalTime < 1 when animation is sped up", () => {
    const anim = makeMockAnim();
    const cs = new ChangeSpeed(anim, { 0: 2, 1: 2 }, null, false);
    // f_inv_1(2, 2) = 2 / (2 + 2) = 0.5
    expect(cs.getScaledTotalTime()).toBeCloseTo(0.5, 10);
  });

  it("runTime scales the wrapped animation's runTime", () => {
    const anim = makeMockAnim(3); // 3-second animation
    const cs = new ChangeSpeed(anim, { 0: 0.5, 1: 0.5 }, null, false);
    // scaledTotalTime = 2, so runTime = 2 * 3 = 6
    expect(cs.runTime).toBeCloseTo(6, 10);
  });

  // ── speedinfo normalisation ──────────────────────────────────────────────────

  it("inserts node 0 with speed 1 when missing", () => {
    const anim = makeMockAnim();
    // No node at 0 — should default to speed 1.
    const cs = new ChangeSpeed(anim, { 0.5: 2, 1: 1 }, null, false);
    // The scaled time should reflect the implicit speed=1 at node 0.
    expect(cs.getScaledTotalTime()).toBeGreaterThan(0);
  });

  it("inserts node 1 using the last explicit speed when missing", () => {
    const anim = makeMockAnim();
    // No node at 1 — should copy penultimate value (speed=2 at 0.5).
    const cs = new ChangeSpeed(anim, { 0: 1, 0.5: 2 }, null, false);
    expect(cs.getScaledTotalTime()).toBeGreaterThan(0);
  });

  // ── Lifecycle delegation ─────────────────────────────────────────────────────

  it("begin() delegates to anim", () => {
    let called = false;
    const anim = makeMockAnim();
    anim.begin = () => {
      called = true;
    };

    const cs = new ChangeSpeed(anim, { 0.5: 2 }, null, false);
    cs.begin();
    expect(called).toBe(true);
  });

  it("finish() delegates to anim and resets isChangingDt", () => {
    let called = false;
    const anim = makeMockAnim();
    anim.finish = () => {
      called = true;
    };

    const cs = new ChangeSpeed(anim, { 0.5: 2 }, null, true);
    expect(ChangeSpeed.isChangingDt).toBe(true);

    cs.finish();
    expect(called).toBe(true);
    expect(ChangeSpeed.isChangingDt).toBe(false);
  });

  it("interpolate() delegates to anim", () => {
    const alphas: number[] = [];
    const anim = makeMockAnim();
    anim.interpolate = (a: number) => {
      alphas.push(a);
    };

    const cs = new ChangeSpeed(anim, { 0.5: 2 }, null, false);
    cs.interpolate(0.5);
    expect(alphas).toHaveLength(1);
  });

  // ── Static addUpdater ────────────────────────────────────────────────────────

  it("addUpdater wraps a dt-aware updater when isChangingDt", () => {
    const mob = makeMockMobject();
    const received: number[] = [];

    ChangeSpeed.isChangingDt = true;
    ChangeSpeed.dt = 0.123;

    ChangeSpeed.addUpdater(mob, (_m: IMobject, dt: number) => {
      received.push(dt);
    });

    // Trigger the wrapper with a real dt of 1.0.
    mob._updaters[0]!(mob, 1.0);
    // Should have received ChangeSpeed.dt, not the real dt.
    expect(received[0]).toBeCloseTo(0.123, 10);
  });

  it("addUpdater passes real dt when isChangingDt is false", () => {
    const mob = makeMockMobject();
    const received: number[] = [];

    ChangeSpeed.isChangingDt = false;

    ChangeSpeed.addUpdater(mob, (_m: IMobject, dt: number) => {
      received.push(dt);
    });

    mob._updaters[0]!(mob, 0.5);
    expect(received[0]).toBeCloseTo(0.5, 10);
  });

  it("addUpdater passes through updater without dt param unchanged", () => {
    const mob = makeMockMobject();
    let callCount = 0;

    // Zero-arity updater (no dt).
    const noopUpdater = (_m: IMobject) => {
      callCount++;
    };

    ChangeSpeed.addUpdater(mob, noopUpdater);
    // The registered updater should be the original one.
    expect(mob._updaters[0]).toBe(noopUpdater as unknown as typeof mob._updaters[0]);

    mob._updaters[0]!(mob, 0.1);
    expect(callCount).toBe(1);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it("isFinished returns true only at alpha=1", () => {
    const cs = new ChangeSpeed(makeMockAnim(), { 0.5: 2 }, null, false);
    expect(cs.isFinished(0.99)).toBe(false);
    expect(cs.isFinished(1.0)).toBe(true);
  });

  it("getRunTime returns this.runTime", () => {
    const anim = makeMockAnim(4);
    const cs = new ChangeSpeed(anim, { 0: 1, 1: 1 }, null, false);
    expect(cs.getRunTime()).toBe(cs.runTime);
  });

  it("getAllMobjects delegates to anim", () => {
    const anim = makeMockAnim();
    const mob = makeMockMobject();
    anim.getAllMobjects = () => [mob];

    const cs = new ChangeSpeed(anim, { 0.5: 2 }, null, false);
    expect(cs.getAllMobjects()).toEqual([mob]);
  });
});
