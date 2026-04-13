/**
 * Tests for src/animation/animation — base Animation, Wait, Add, utilities.
 */

import { describe, it, expect, vi } from "vitest";
import {
  Animation,
  Wait,
  Add,
  prepareAnimation,
  overrideAnimation,
  DEFAULT_ANIMATION_RUN_TIME,
  DEFAULT_ANIMATION_LAG_RATIO,
} from "../../src/animation/animation/index.js";
import { smooth, linear } from "../../src/core/math/index.js";
import { np } from "../../src/core/math/index.js";
import type { IMobject, IScene, Point3D } from "../../src/core/types.js";
import { Mobject } from "../../src/mobject/mobject/index.js";

// ── Mock Mobject ──────────────────────────────────────────────

function makeMockMobject(): IMobject & {
  suspendUpdating: ReturnType<typeof vi.fn>;
  resumeUpdating: ReturnType<typeof vi.fn>;
  familyMembersWithPoints: ReturnType<typeof vi.fn>;
} {
  const mob: ReturnType<typeof makeMockMobject> = {
    name: "mock",
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
    familyMembersWithPoints: vi.fn().mockReturnValue([]),
  };
  (mob.copy as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    ...mob,
    copy: vi.fn().mockReturnValue(mob),
  }));
  (mob.getFamily as ReturnType<typeof vi.fn>).mockReturnValue([mob]);
  (mob.familyMembersWithPoints as ReturnType<typeof vi.fn>).mockReturnValue([mob]);
  return mob;
}

function makeMockScene(): IScene & {
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
} {
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

// ── Animation ────────────────────────────────────────────────

describe("Animation", () => {
  it("constructs with default options", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob);

    expect(anim.mobject).toBe(mob);
    expect(anim.runTime).toBe(DEFAULT_ANIMATION_RUN_TIME);
    expect(anim.rateFunc).toBe(smooth);
    expect(anim.lagRatio).toBe(DEFAULT_ANIMATION_LAG_RATIO);
    expect(anim.remover).toBe(false);
    expect(anim.introducer).toBe(false);
  });

  it("accepts custom options", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, {
      runTime: 3,
      rateFunc: linear,
      lagRatio: 0.5,
      name: "TestAnim",
      remover: true,
      introducer: true,
    });

    expect(anim.runTime).toBe(3);
    expect(anim.rateFunc).toBe(linear);
    expect(anim.lagRatio).toBe(0.5);
    expect(anim.name).toBe("TestAnim");
    expect(anim.remover).toBe(true);
    expect(anim.introducer).toBe(true);
  });

  it("constructs with null mobject (creates empty Mobject)", () => {
    const anim = new Animation(null);
    expect(anim.mobject).toBeDefined();
  });

  it("begin() copies the mobject and suspends updating", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob);
    anim.begin();

    expect(mob.copy).toHaveBeenCalled();
    expect(mob.suspendUpdating).toHaveBeenCalled();
  });

  it("finish() resumes updating", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob);
    anim.begin();
    anim.finish();

    expect(mob.resumeUpdating).toHaveBeenCalled();
  });

  it("getAllMobjects returns mobject and startingMobject", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob);
    anim.begin();
    const all = anim.getAllMobjects();

    expect(all).toHaveLength(2);
    expect(all[0]).toBe(mob);
  });

  it("cleanUpFromScene removes mobject when remover=true", () => {
    const mob = makeMockMobject();
    const scene = makeMockScene();
    const anim = new Animation(mob, { remover: true });

    anim.cleanUpFromScene(scene);
    expect(scene.remove).toHaveBeenCalledWith(mob);
  });

  it("cleanUpFromScene does NOT remove when remover=false", () => {
    const mob = makeMockMobject();
    const scene = makeMockScene();
    const anim = new Animation(mob, { remover: false });

    anim.cleanUpFromScene(scene);
    expect(scene.remove).not.toHaveBeenCalled();
  });

  it("setupScene adds mobject when introducer=true", () => {
    const mob = makeMockMobject();
    const scene = makeMockScene();
    scene.mobjects = [];
    const anim = new Animation(mob, { introducer: true });

    anim.setupScene(scene);
    expect(scene.add).toHaveBeenCalledWith(mob);
  });

  it("isFinished returns true when alpha >= 1", () => {
    const anim = new Animation(makeMockMobject());
    expect(anim.isFinished(0.5)).toBe(false);
    expect(anim.isFinished(1.0)).toBe(true);
    expect(anim.isFinished(1.5)).toBe(true);
  });

  it("getRunTime / setRunTime", () => {
    const anim = new Animation(makeMockMobject(), { runTime: 2 });
    expect(anim.getRunTime()).toBe(2);
    const result = anim.setRunTime(5);
    expect(anim.getRunTime()).toBe(5);
    expect(result).toBe(anim); // chaining
  });

  it("setRateFunc / getRateFunc", () => {
    const anim = new Animation(makeMockMobject());
    expect(anim.getRateFunc()).toBe(smooth);
    anim.setRateFunc(linear);
    expect(anim.getRateFunc()).toBe(linear);
  });

  it("setName", () => {
    const anim = new Animation(makeMockMobject());
    anim.setName("MyAnim");
    expect(anim.name).toBe("MyAnim");
  });

  it("isRemover / isIntroducer", () => {
    const anim = new Animation(makeMockMobject(), {
      remover: true,
      introducer: true,
    });
    expect(anim.isRemover()).toBe(true);
    expect(anim.isIntroducer()).toBe(true);
  });

  it("copy returns a shallow clone", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, { runTime: 3 });
    const cloned = anim.copy();

    expect(cloned).not.toBe(anim);
    expect(cloned.runTime).toBe(3);
    expect(cloned.mobject).toBe(mob);
  });

  it("toString uses name if set", () => {
    const anim = new Animation(makeMockMobject(), { name: "FadeIn" });
    expect(anim.toString()).toBe("FadeIn");
  });

  it("interpolateSubmobject is a no-op (base class)", () => {
    const anim = new Animation(makeMockMobject());
    // Should not throw
    expect(() =>
      anim.interpolateSubmobject(
        makeMockMobject(),
        makeMockMobject(),
        0.5,
      ),
    ).not.toThrow();
  });
});

// ── Animation.setDefault ─────────────────────────────────────

describe("Animation.setDefault", () => {
  afterEach(() => {
    Animation.setDefault(); // reset
  });

  it("overrides default options", () => {
    Animation.setDefault({ runTime: 5, rateFunc: linear });
    const anim = new Animation(makeMockMobject());
    expect(anim.runTime).toBe(5);
    expect(anim.rateFunc).toBe(linear);
  });

  it("resets defaults when called with no args", () => {
    Animation.setDefault({ runTime: 10 });
    Animation.setDefault();
    const anim = new Animation(makeMockMobject());
    expect(anim.runTime).toBe(DEFAULT_ANIMATION_RUN_TIME);
  });
});

// ── Wait ─────────────────────────────────────────────────────

describe("Wait", () => {
  it("constructs with defaults", () => {
    const wait = new Wait();
    expect(wait.runTime).toBe(1);
    expect(wait.rateFunc).toBe(linear);
    expect(wait.stopCondition).toBeNull();
    expect(wait.isStaticWait).toBeNull();
  });

  it("accepts custom run time", () => {
    const wait = new Wait({ runTime: 3 });
    expect(wait.runTime).toBe(3);
    expect(wait.duration).toBe(3);
  });

  it("throws when stopCondition + frozenFrame both set", () => {
    expect(
      () =>
        new Wait({
          stopCondition: () => true,
          frozenFrame: true,
        }),
    ).toThrow("A static Wait animation cannot have a stop condition");
  });

  it("begin/finish/interpolate/cleanUpFromScene are no-ops", () => {
    const wait = new Wait();
    const scene = makeMockScene();
    // None of these should throw
    wait.begin();
    wait.finish();
    wait.interpolate(0.5);
    wait.cleanUpFromScene(scene);
    wait.updateMobjects(0.1);
  });
});

// ── Add ──────────────────────────────────────────────────────

describe("Add", () => {
  it("constructs with single mobject", () => {
    const mob = makeMockMobject();
    const add = new Add(mob);
    expect(add.mobject).toBe(mob);
    expect(add.runTime).toBe(0);
    expect(add.introducer).toBe(true);
  });

  it("constructs with multiple mobjects (creates Group)", () => {
    const mob1 = new Mobject() as unknown as IMobject;
    const mob2 = new Mobject() as unknown as IMobject;
    const add = new Add([mob1, mob2]);
    // Should have created a group (not the individual mobjects)
    expect(add.mobject).toBeDefined();
    expect(add.mobject).not.toBe(mob1);
    expect(add.mobject).not.toBe(mob2);
    expect(add.runTime).toBe(0);
    expect(add.introducer).toBe(true);
  });

  it("begin/finish/interpolate are no-ops", () => {
    const mob = makeMockMobject();
    const add = new Add(mob);
    add.begin();
    add.finish();
    add.interpolate(0.5);
    add.cleanUpFromScene(makeMockScene());
    add.updateMobjects(0.1);
  });
});

// ── prepareAnimation ─────────────────────────────────────────

describe("prepareAnimation", () => {
  it("returns Animation instances unchanged", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob);
    expect(prepareAnimation(anim)).toBe(anim);
  });

  it("throws TypeError for non-animation objects", () => {
    expect(() => prepareAnimation(42 as never)).toThrow(TypeError);
  });
});

// ── overrideAnimation ────────────────────────────────────────

describe("overrideAnimation", () => {
  it("marks a function with _overrideAnimation", () => {
    const fn = () => new Animation(makeMockMobject());
    const decorated = overrideAnimation(Animation)(fn as never);
    expect(
      (decorated as unknown as Record<string, unknown>)._overrideAnimation,
    ).toBe(Animation);
  });
});

// ── getSubAlpha with reverseRateFunction ─────────────────────

describe("getSubAlpha with reverseRateFunction", () => {
  it("applies rate function in reverse when reverseRateFunction=true", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, {
      rateFunc: linear,
      lagRatio: 0,
      reverseRateFunction: true,
    });
    // Access protected method via cast
    const subAlpha = (anim as unknown as { getSubAlpha: (a: number, i: number, n: number) => number })
      .getSubAlpha(0.5, 0, 1);
    // With linear rateFunc and reverse: rateFunc(1 - 0.5) = 0.5
    expect(subAlpha).toBeCloseTo(0.5);
  });

  it("applies lagRatio correctly across submobjects", () => {
    const mob = makeMockMobject();
    const anim = new Animation(mob, {
      rateFunc: linear,
      lagRatio: 0.5,
    });
    const getSub = (a: number, i: number, n: number) =>
      (anim as unknown as { getSubAlpha: (a: number, i: number, n: number) => number })
        .getSubAlpha(a, i, n);

    // With 3 submobjects, lagRatio=0.5:
    // fullLength = 2*0.5+1 = 2
    // At alpha=0.5, value=1.0
    // sub0: linear(1.0 - 0) = 1.0
    // sub1: linear(1.0 - 0.5) = 0.5
    // sub2: linear(1.0 - 1.0) = 0.0
    expect(getSub(0.5, 0, 3)).toBeCloseTo(1.0);
    expect(getSub(0.5, 1, 3)).toBeCloseTo(0.5);
    expect(getSub(0.5, 2, 3)).toBeCloseTo(0.0);
  });
});
