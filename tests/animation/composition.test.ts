/**
 * Tests for src/animation/composition — AnimationGroup, Succession,
 * LaggedStart, LaggedStartMap.
 */

import { describe, it, expect, vi } from "vitest";
import {
  AnimationGroup,
  Succession,
  LaggedStart,
  LaggedStartMap,
  DEFAULT_LAGGED_START_LAG_RATIO,
} from "../../src/animation/composition/index.js";
import { Animation } from "../../src/animation/animation/index.js";
import { linear } from "../../src/core/math/index.js";
import { np } from "../../src/core/math/index.js";
import type { IMobject, IScene } from "../../src/core/types.js";
import { Mobject } from "../../src/mobject/mobject/index.js";

// ── Helpers ─────────────────────────────────────────────────

function makeMockMobject(name = "mock"): IMobject {
  const mob: IMobject = {
    name,
    color: {
      r: 1, g: 1, b: 1, a: 1,
      toHex: () => "#FFFFFF",
      toArray: () => [1, 1, 1, 1],
      interpolate: (o) => o,
      lighter: () => mob.color,
      darker: () => mob.color,
    },
    submobjects: [],
    updaters: [],
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
    addUpdater: vi.fn().mockReturnThis(),
    removeUpdater: vi.fn().mockReturnThis(),
    applyMatrix: vi.fn().mockReturnThis(),
    applyFunction: vi.fn().mockReturnThis(),
    copy: vi.fn(),
    suspendUpdating: vi.fn().mockReturnThis(),
    resumeUpdating: vi.fn().mockReturnThis(),
  } as IMobject;
  (mob.copy as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    ...mob,
    copy: vi.fn().mockReturnValue(mob),
  }));
  (mob.getFamily as ReturnType<typeof vi.fn>).mockReturnValue([mob]);
  return mob;
}

function makeMockScene(): IScene {
  return {
    mobjects: [],
    time: 0,
    camera: {} as never,
    add: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
    play: vi.fn() as never,
    wait: vi.fn() as never,
    construct: vi.fn() as never,
  };
}

/** Create a simple Animation with given runTime that tracks interpolation. */
function makeTrackedAnim(
  runTime = 1,
): Animation & { lastAlpha: number | null } {
  const mob = new Mobject();
  const anim = new Animation(mob as unknown as IMobject, {
    runTime,
    rateFunc: linear,
  });
  (anim as Animation & { lastAlpha: number | null }).lastAlpha = null;
  const orig = anim.interpolate.bind(anim);
  anim.interpolate = (alpha: number) => {
    (anim as Animation & { lastAlpha: number | null }).lastAlpha = alpha;
    orig(alpha);
  };
  return anim as Animation & { lastAlpha: number | null };
}

// ─── AnimationGroup ─────────────────────────────────────────

describe("AnimationGroup", () => {
  it("constructs with default options", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(2);
    const group = new AnimationGroup(a1, a2);

    expect(group.animations).toHaveLength(2);
    expect(group.lagRatio).toBe(0);
    // Default runTime = max end time with lagRatio=0 => max(runTime) = 2
    expect(group.runTime).toBe(2);
  });

  it("constructs with explicit runTime and lagRatio", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(1);
    const group = new AnimationGroup(a1, a2, { runTime: 5, lagRatio: 0.5 });

    expect(group.runTime).toBe(5);
    expect(group.lagRatio).toBe(0.5);
  });

  it("throws when begin() is called with no animations", () => {
    const group = new AnimationGroup();
    expect(() => group.begin()).toThrow("without animations");
  });

  it("uses linear rate function by default", () => {
    const a1 = makeTrackedAnim(1);
    const group = new AnimationGroup(a1);
    // Verify it behaves like linear: f(0)=0, f(0.5)=0.5, f(1)=1
    expect(group.rateFunc(0)).toBe(0);
    expect(group.rateFunc(0.5)).toBe(0.5);
    expect(group.rateFunc(1)).toBe(1);
  });

  it("buildAnimationsWithTimings calculates correct timings with lagRatio=0", () => {
    const a1 = makeTrackedAnim(2);
    const a2 = makeTrackedAnim(3);
    const group = new AnimationGroup(a1, a2);

    // With lagRatio=0, all start at 0
    // a1: [0, 2], a2: [0, 3]
    expect(group.runTime).toBe(3);
  });

  it("buildAnimationsWithTimings calculates correct timings with lagRatio=1", () => {
    const a1 = makeTrackedAnim(2);
    const a2 = makeTrackedAnim(3);
    const group = new AnimationGroup(a1, a2, { lagRatio: 1 });

    // a1: [0, 2], a2: [2, 5]
    expect(group.runTime).toBe(5);
  });

  it("interpolate updates sub-animations correctly", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(1);
    const group = new AnimationGroup(a1, a2);

    group.begin();
    group.interpolate(0.5);

    // With lagRatio=0, both start at 0 and end at 1
    // At alpha=0.5, animGroupTime=0.5, sub_alpha = 0.5/1 = 0.5
    expect(a1.lastAlpha).toBeCloseTo(0.5);
    expect(a2.lastAlpha).toBeCloseTo(0.5);
  });

  it("interpolate at alpha=1 finishes all sub-animations", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(1);
    const group = new AnimationGroup(a1, a2);

    group.begin();
    group.interpolate(1);

    expect(a1.lastAlpha).toBeCloseTo(1);
    expect(a2.lastAlpha).toBeCloseTo(1);
  });

  it("cleanUpFromScene propagates remover flag", () => {
    const a1 = makeTrackedAnim(1);
    const scene = makeMockScene();
    const group = new AnimationGroup(a1, { remover: true });

    const spy = vi.spyOn(a1, "cleanUpFromScene");
    group.cleanUpFromScene(scene);

    expect(a1.remover).toBe(true);
    expect(spy).toHaveBeenCalledWith(scene);
  });
});

// ─── Succession ─────────────────────────────────────────────

describe("Succession", () => {
  it("defaults to lagRatio=1", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(1);
    const s = new Succession(a1, a2);

    expect(s.lagRatio).toBe(1);
    // With lagRatio=1: a1 [0,1], a2 [1,2] => total = 2
    expect(s.runTime).toBe(2);
  });

  it("plays animations sequentially via interpolate", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(1);
    const s = new Succession(a1, a2);

    const scene = makeMockScene();
    s.setupScene(scene);
    s.begin();

    // At alpha=0.25, currentTime = 0.5 (in a total of 2)
    // Active is a1, sub_alpha = 0.5
    s.interpolate(0.25);
    expect(a1.lastAlpha).toBeCloseTo(0.5);

    // At alpha=0.75, currentTime = 1.5
    // a1 finishes at 1, a2 starts at 1, sub_alpha = 0.5
    s.interpolate(0.75);
    expect(a2.lastAlpha).toBeCloseTo(0.5);
  });

  it("throws when begin() called with no animations", () => {
    const s = new Succession();
    expect(() => s.begin()).toThrow("without animations");
  });
});

// ─── LaggedStart ────────────────────────────────────────────

describe("LaggedStart", () => {
  it("defaults to lagRatio=0.05", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(1);
    const ls = new LaggedStart(a1, a2);

    expect(ls.lagRatio).toBe(DEFAULT_LAGGED_START_LAG_RATIO);
  });

  it("accepts custom lagRatio", () => {
    const a1 = makeTrackedAnim(1);
    const a2 = makeTrackedAnim(1);
    const ls = new LaggedStart(a1, a2, { lagRatio: 0.25 });

    expect(ls.lagRatio).toBe(0.25);
  });
});

// ─── LaggedStartMap ─────────────────────────────────────────

describe("LaggedStartMap", () => {
  it("creates animations from submobjects", () => {
    const parent = new Mobject();
    const child1 = new Mobject();
    const child2 = new Mobject();
    parent.add(child1, child2);

    const lsm = new LaggedStartMap(
      Animation as unknown as new (
        m: IMobject,
        o?: Record<string, unknown>,
      ) => Animation,
      parent as unknown as IMobject,
    );

    expect(lsm.animations).toHaveLength(2);
    expect(lsm.lagRatio).toBe(DEFAULT_LAGGED_START_LAG_RATIO);
    expect(lsm.runTime).toBe(2);
  });

  it("uses argCreator to transform submobjects", () => {
    const parent = new Mobject();
    const child = new Mobject();
    parent.add(child);

    const customMob = new Mobject();
    const creator = vi.fn().mockReturnValue(customMob as unknown as IMobject);

    const lsm = new LaggedStartMap(
      Animation as unknown as new (
        m: IMobject,
        o?: Record<string, unknown>,
      ) => Animation,
      parent as unknown as IMobject,
      creator,
    );

    expect(creator).toHaveBeenCalledTimes(1);
    expect(lsm.animations).toHaveLength(1);
  });
});
