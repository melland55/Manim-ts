/**
 * Tests for src/animation/rotation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Rotating, Rotate } from "../../src/animation/rotation/index.js";
import { np } from "../../src/core/math/index.js";
import { OUT, PI, TAU, linear, smooth } from "../../src/core/math/index.js";
import type { IMobject, IScene, Point3D } from "../../src/core/types.js";

// ── Mock Mobject ──────────────────────────────────────────────────────────────

function makeMockMobject(center: Point3D = np.array([0, 0, 0])): IMobject & {
  become: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  applyFunction: ReturnType<typeof vi.fn>;
  suspendUpdating: ReturnType<typeof vi.fn>;
  resumeUpdating: ReturnType<typeof vi.fn>;
} {
  const mob: ReturnType<typeof makeMockMobject> = {
    name: "mock",
    color: { r: 1, g: 1, b: 1, a: 1, toHex: () => "#FFFFFF", toArray: () => [1, 1, 1, 1], interpolate: (o) => o, lighter: () => mob.color, darker: () => mob.color },
    submobjects: [],
    updaters: [],
    zIndex: 0,

    getCenter: () => center,
    getLeft: () => np.array([-1, 0, 0]),
    getRight: () => np.array([1, 0, 0]),
    getTop: () => np.array([0, 1, 0]),
    getBottom: () => np.array([0, -1, 0]),
    getWidth: () => 2,
    getHeight: () => 2,

    moveTo: vi.fn().mockReturnThis(),
    shift: vi.fn().mockReturnThis(),
    scale: vi.fn().mockReturnThis(),
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

    become: vi.fn().mockReturnThis(),
    rotate: vi.fn().mockReturnThis(),
    suspendUpdating: vi.fn().mockReturnThis(),
    resumeUpdating: vi.fn().mockReturnThis(),

    copy: vi.fn(),
  };

  // copy() returns a fresh mock that shares the same vi.fn() references
  // so tests can inspect calls on the copy.
  (mob.copy as ReturnType<typeof vi.fn>).mockImplementation(() => {
    return { ...mob, copy: vi.fn().mockReturnValue(mob) };
  });

  return mob;
}

const mockScene: IScene = {
  mobjects: [],
  time: 0,
  camera: {} as never,
  add: vi.fn().mockReturnThis() as never,
  remove: vi.fn().mockReturnThis() as never,
  play: vi.fn() as never,
  wait: vi.fn() as never,
  construct: vi.fn() as never,
};

// ── Rotating ──────────────────────────────────────────────────────────────────

describe("Rotating", () => {
  let mob: ReturnType<typeof makeMockMobject>;

  beforeEach(() => {
    mob = makeMockMobject();
  });

  it("constructs with defaults", () => {
    const anim = new Rotating(mob);
    expect(anim.angle).toBe(TAU);
    expect(anim.axis.toArray()).toEqual(OUT.toArray());
    expect(anim.aboutPoint).toBeNull();
    expect(anim.aboutEdge).toBeNull();
    expect(anim.runTime).toBe(5);
    expect(anim.rateFunc).toBe(linear);
    expect(anim.name).toBe("Rotating");
    expect(anim.remover).toBe(false);
    expect(anim.introducer).toBe(false);
  });

  it("constructs with explicit parameters", () => {
    const axis = np.array([0, 1, 0]);
    const center = np.array([1, 2, 0]);
    const anim = new Rotating(mob, PI, axis, center, null, 3, smooth, {
      name: "MyRot",
      remover: true,
    });
    expect(anim.angle).toBe(PI);
    expect(anim.runTime).toBe(3);
    expect(anim.rateFunc).toBe(smooth);
    expect(anim.name).toBe("MyRot");
    expect(anim.remover).toBe(true);
    expect((anim.aboutPoint as unknown as { toArray(): number[] }).toArray()).toEqual([1, 2, 0]);
  });

  it("implements IAnimation interface fields", () => {
    const anim = new Rotating(mob);
    expect(anim.mobject).toBe(mob);
    expect(typeof anim.runTime).toBe("number");
    expect(typeof anim.rateFunc).toBe("function");
    expect(typeof anim.lagRatio).toBe("number");
    expect(typeof anim.remover).toBe("boolean");
    expect(typeof anim.introducer).toBe("boolean");
  });

  it("begin() copies the mobject and suspends updating", () => {
    const anim = new Rotating(mob);
    anim.begin();
    expect(mob.copy).toHaveBeenCalledOnce();
    expect(mob.suspendUpdating).toHaveBeenCalledOnce();
  });

  it("finish() calls interpolate(1) and resumes updating", () => {
    const anim = new Rotating(mob);
    anim.begin();
    const spyInterpolate = vi.spyOn(anim, "interpolate");
    anim.finish();
    expect(spyInterpolate).toHaveBeenCalledWith(1);
    expect(mob.resumeUpdating).toHaveBeenCalledOnce();
  });

  it("interpolateMobject calls become then rotate with rate-func'd angle", () => {
    const anim = new Rotating(mob, TAU, OUT, null, null, 5, linear);
    anim.begin();
    anim.interpolateMobject(0.5);
    expect(mob.become).toHaveBeenCalled();
    expect(mob.rotate).toHaveBeenCalledWith(
      expect.closeTo(linear(0.5) * TAU, 10),
      OUT,
      {},
    );
  });

  it("interpolateMobject passes aboutPoint when provided", () => {
    const center = np.array([1, 0, 0]);
    const anim = new Rotating(mob, PI, OUT, center);
    anim.begin();
    anim.interpolateMobject(0.5);
    const rotateCall = mob.rotate.mock.calls[0];
    expect(rotateCall[2]).toHaveProperty("aboutPoint");
  });

  it("isFinished returns true only at or after alpha=1", () => {
    const anim = new Rotating(mob);
    expect(anim.isFinished(0)).toBe(false);
    expect(anim.isFinished(0.99)).toBe(false);
    expect(anim.isFinished(1)).toBe(true);
    expect(anim.isFinished(1.5)).toBe(true);
  });

  it("getRunTime returns the configured runTime", () => {
    const anim = new Rotating(mob, TAU, OUT, null, null, 7);
    expect(anim.getRunTime()).toBe(7);
  });

  it("copy() produces an independent Rotating instance", () => {
    const anim = new Rotating(mob, PI, OUT, null, null, 3, linear);
    const c = anim.copy() as Rotating;
    expect(c).toBeInstanceOf(Rotating);
    expect(c.angle).toBe(PI);
    expect(c.runTime).toBe(3);
    expect(c).not.toBe(anim);
  });

  it("cleanUpFromScene removes mobject when remover=true", () => {
    const anim = new Rotating(mob, TAU, OUT, null, null, 5, linear, { remover: true });
    anim.cleanUpFromScene(mockScene);
    expect(mockScene.remove).toHaveBeenCalledWith(mob);
  });

  it("getAllMobjects returns mobject and startingMobject after begin", () => {
    const anim = new Rotating(mob);
    anim.begin();
    const all = anim.getAllMobjects();
    expect(all).toHaveLength(2);
    expect(all[0]).toBe(mob);
  });
});

// ── Rotate ────────────────────────────────────────────────────────────────────

describe("Rotate", () => {
  let mob: ReturnType<typeof makeMockMobject>;

  beforeEach(() => {
    mob = makeMockMobject(np.array([0, 0, 0]));
    vi.clearAllMocks();
  });

  it("constructs with defaults", () => {
    const anim = new Rotate(mob);
    expect(anim.angle).toBe(PI);
    expect(anim.axis.toArray()).toEqual(OUT.toArray());
    expect(anim.runTime).toBe(1);
    expect(anim.rateFunc).toBe(smooth);
    expect(anim.name).toBe("Rotate");
    expect(anim.remover).toBe(false);
  });

  it("sets aboutPoint to mobject centre when not specified", () => {
    const anim = new Rotate(mob);
    const ap = (anim.aboutPoint as NDArrayLike).toArray() as number[];
    expect(ap).toEqual([0, 0, 0]);
  });

  it("uses provided aboutPoint", () => {
    const pt = np.array([3, 4, 0]);
    const anim = new Rotate(mob, PI, OUT, pt);
    expect((anim.aboutPoint as unknown as { toArray(): number[] }).toArray()).toEqual([3, 4, 0]);
  });

  it("sets pathArc equal to angle by default", () => {
    const anim = new Rotate(mob, PI / 2);
    expect(anim.pathArc).toBe(PI / 2);
  });

  it("respects explicit pathArc override", () => {
    const anim = new Rotate(mob, PI, OUT, null, null, { pathArc: 0 });
    expect(anim.pathArc).toBe(0);
  });

  it("sets pathArcAxis equal to axis by default", () => {
    const axis = np.array([0, 1, 0]);
    const anim = new Rotate(mob, PI, axis);
    expect(anim.pathArcAxis.toArray()).toEqual([0, 1, 0]);
  });

  it("createTarget returns a rotated copy", () => {
    const anim = new Rotate(mob, PI);
    anim.begin(); // internally calls createTarget
    // mob.copy should have been called (for startingMobject + inside createTarget)
    expect(mob.copy).toHaveBeenCalled();
  });

  it("begin() creates targetMobject and startingMobject", () => {
    const anim = new Rotate(mob, PI);
    anim.begin();
    expect(anim.getAllMobjects()).toHaveLength(3);
  });

  it("implements IAnimation interface fields", () => {
    const anim = new Rotate(mob);
    expect(typeof anim.runTime).toBe("number");
    expect(typeof anim.rateFunc).toBe("function");
    expect(typeof anim.lagRatio).toBe("number");
    expect(typeof anim.remover).toBe("boolean");
    expect(typeof anim.introducer).toBe("boolean");
  });

  it("isFinished returns true only at or after alpha=1", () => {
    const anim = new Rotate(mob);
    expect(anim.isFinished(0)).toBe(false);
    expect(anim.isFinished(1)).toBe(true);
  });

  it("getRunTime returns configured runTime", () => {
    const anim = new Rotate(mob, PI, OUT, null, null, { runTime: 2.5 });
    expect(anim.getRunTime()).toBe(2.5);
  });

  it("copy() produces an independent Rotate instance", () => {
    const anim = new Rotate(mob, PI / 3, OUT, null, null, { runTime: 2 });
    const c = anim.copy() as Rotate;
    expect(c).toBeInstanceOf(Rotate);
    expect(c.angle).toBe(PI / 3);
    expect(c.runTime).toBe(2);
    expect(c).not.toBe(anim);
  });
});

// ── Barrel re-exports ─────────────────────────────────────────────────────────

describe("barrel export", () => {
  it("exports Rotating and Rotate", () => {
    expect(Rotating).toBeDefined();
    expect(Rotate).toBeDefined();
  });
});

// Helper type alias used in tests
type NDArrayLike = { toArray(): unknown };
