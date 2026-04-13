import { describe, it, expect, beforeEach } from "vitest";
import "../helpers/point-matchers.js";
import {
  Homotopy,
  SmoothedVectorizedHomotopy,
  ComplexHomotopy,
  PhaseFlow,
  MoveAlongPath,
} from "../../src/animation/movement/index.js";
import { linear } from "../../src/core/math/index.js";
import { np } from "../../src/core/math/index.js";
import type { IMobject, IVMobject, Point3D, Points3D } from "../../src/core/types.js";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Minimal IMobject mock that tracks applyFunction and moveTo calls. */
function makeMockMobject(): IMobject & {
  _lastMoveToPoint: Point3D | null;
  _applyFunctionCalled: number;
  _lastFn: ((p: Point3D) => Point3D) | null;
} {
  const mob = {
    name: "MockMob",
    color: null as unknown as IMobject["color"],
    submobjects: [] as IMobject[],
    updaters: [] as IMobject["updaters"],
    zIndex: 0,
    _lastMoveToPoint: null as Point3D | null,
    _applyFunctionCalled: 0,
    _lastFn: null as ((p: Point3D) => Point3D) | null,

    getCenter: () => np.array([0, 0, 0]) as Point3D,
    getLeft: () => np.array([-1, 0, 0]) as Point3D,
    getRight: () => np.array([1, 0, 0]) as Point3D,
    getTop: () => np.array([0, 1, 0]) as Point3D,
    getBottom: () => np.array([0, -1, 0]) as Point3D,
    getWidth: () => 2,
    getHeight: () => 2,
    moveTo(point: Point3D) {
      mob._lastMoveToPoint = point;
      return mob;
    },
    shift() { return mob; },
    scale() { return mob; },
    rotate() { return mob; },
    flip() { return mob; },
    nextTo() { return mob; },
    alignTo() { return mob; },
    add() { return mob; },
    remove() { return mob; },
    getFamily() { return [mob as unknown as IMobject]; },
    setColor() { return mob; },
    setOpacity() { return mob; },
    addUpdater() { return mob; },
    removeUpdater() { return mob; },
    applyMatrix() { return mob; },
    applyFunction(fn: (p: Point3D) => Point3D) {
      mob._applyFunctionCalled++;
      mob._lastFn = fn;
      return mob;
    },
    copy() {
      return makeMockMobject() as unknown as IMobject;
    },
  };
  return mob;
}

/** VMobject mock with settable points and a pointFromProportion path. */
function makeMockVMobject(
  pathPoints?: Point3D[],
): IVMobject & {
  _makeSmoothCalled: number;
  _applyFunctionCalled: number;
  _lastFn: ((p: Point3D) => Point3D) | null;
} {
  const pathPts = pathPoints ?? [
    np.array([0, 0, 0]) as Point3D,
    np.array([1, 0, 0]) as Point3D,
  ];

  const mob = {
    name: "MockVMob",
    color: null as unknown as IVMobject["color"],
    submobjects: [] as IMobject[],
    updaters: [] as IVMobject["updaters"],
    zIndex: 0,
    fillColor: null as unknown as IVMobject["fillColor"],
    fillOpacity: 0,
    strokeColor: null as unknown as IVMobject["strokeColor"],
    strokeOpacity: 1,
    strokeWidth: 2,
    // Real NDArray points storage
    points: np.zeros([4, 3]) as unknown as Points3D,
    _makeSmoothCalled: 0,
    _applyFunctionCalled: 0,
    _lastFn: null as ((p: Point3D) => Point3D) | null,

    getCenter: () => np.array([0, 0, 0]) as Point3D,
    getLeft: () => np.array([-1, 0, 0]) as Point3D,
    getRight: () => np.array([1, 0, 0]) as Point3D,
    getTop: () => np.array([0, 1, 0]) as Point3D,
    getBottom: () => np.array([0, -1, 0]) as Point3D,
    getWidth: () => 2,
    getHeight: () => 2,
    moveTo() { return mob; },
    shift() { return mob; },
    scale() { return mob; },
    rotate() { return mob; },
    flip() { return mob; },
    nextTo() { return mob; },
    alignTo() { return mob; },
    add() { return mob; },
    remove() { return mob; },
    getFamily() { return [mob as unknown as IMobject]; },
    setColor() { return mob; },
    setOpacity() { return mob; },
    addUpdater() { return mob; },
    removeUpdater() { return mob; },
    applyMatrix() { return mob; },
    applyFunction(fn: (p: Point3D) => Point3D) {
      mob._applyFunctionCalled++;
      mob._lastFn = fn;
      return mob;
    },
    copy() {
      const c = makeMockVMobject(pathPts) as unknown as IVMobject;
      (c as typeof mob).points = mob.points.copy() as unknown as Points3D;
      return c;
    },
    // IVMobject path methods
    startNewPath() { return mob; },
    addLineTo() { return mob; },
    addCubicBezierCurveTo() { return mob; },
    addQuadraticBezierCurveTo() { return mob; },
    closePath() { return mob; },
    clearPoints() { return mob; },
    getAnchors: () => mob.points,
    getHandles: () => mob.points,
    getSubpaths: () => [mob.points],
    getArcLength: () => 1,
    pointFromProportion(alpha: number): Point3D {
      // Linear interpolation between pathPts[0] and pathPts[1]
      const a = pathPts[0].toArray() as number[];
      const b = pathPts[1].toArray() as number[];
      const t = Math.max(0, Math.min(1, alpha));
      return np.array([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ]) as Point3D;
    },
    setFill() { return mob; },
    setStroke() { return mob; },
    appendVectorizedMobject() { return mob; },
    // Extra: makeSmooth for SmoothedVectorizedHomotopy
    makeSmooth() {
      mob._makeSmoothCalled++;
      return mob;
    },
  };
  return mob;
}

// ─── Animation base (used indirectly) ────────────────────────────────────────

describe("Homotopy", () => {
  it("constructs with required arguments and defaults", () => {
    const mob = makeMockMobject();
    const identity = (
      x: number,
      y: number,
      z: number,
      _t: number,
    ): [number, number, number] => [x, y, z];

    const anim = new Homotopy(identity, mob);

    expect(anim.mobject).toBe(mob);
    expect(anim.runTime).toBe(3); // Python default is 3
    expect(anim.homotopy).toBe(identity);
    expect(anim.applyFunctionKwargs).toEqual({});
  });

  it("accepts custom runTime and applyFunctionKwargs", () => {
    const mob = makeMockMobject();
    const fn = (x: number, y: number, z: number, _t: number): [number, number, number] => [x, y, z];
    const anim = new Homotopy(fn, mob, {
      runTime: 5,
      applyFunctionKwargs: { aboutPoint: [0, 0, 0] },
    });

    expect(anim.runTime).toBe(5);
    expect(anim.applyFunctionKwargs).toEqual({ aboutPoint: [0, 0, 0] });
  });

  it("functionAtTimeT returns a function that applies the homotopy", () => {
    const mob = makeMockMobject();
    // Translate in x by t
    const anim = new Homotopy(
      (x, y, z, t) => [x + t, y, z],
      mob,
    );

    const fn = anim.functionAtTimeT(0.5);
    const result = fn(np.array([1, 2, 3]) as Point3D);
    const arr = result.toArray() as number[];

    expect(arr[0]).toBeCloseTo(1.5);
    expect(arr[1]).toBeCloseTo(2);
    expect(arr[2]).toBeCloseTo(3);
  });

  it("functionAtTimeT at t=0 is identity", () => {
    const mob = makeMockMobject();
    const anim = new Homotopy((x, y, z, t) => [x * (1 - t), y, z], mob);

    const fn = anim.functionAtTimeT(0);
    const p = np.array([3, 4, 5]) as Point3D;
    const result = fn(p);
    expect(result).toBeCloseToPoint(p, 8);
  });

  it("interpolateSubmobject resets points and calls applyFunction on VMobject", () => {
    const submob = makeMockVMobject();
    const startSub = makeMockVMobject();
    // Give startSub distinct points
    startSub.points = np.ones([4, 3]) as unknown as Points3D;

    const mob = makeMockMobject();
    const anim = new Homotopy((x, y, z, _t) => [x, y, z], mob);

    anim.interpolateSubmobject(
      submob as unknown as IMobject,
      startSub as unknown as IMobject,
      0.5,
    );

    // applyFunction should have been called once
    expect(submob._applyFunctionCalled).toBe(1);
    // The function passed should be the one from functionAtTimeT(0.5)
    expect(submob._lastFn).not.toBeNull();
  });

  it("interpolateSubmobject falls back gracefully on non-VMobject", () => {
    const mob = makeMockMobject();
    const start = makeMockMobject();
    const anim = new Homotopy((x, y, z, _t) => [x, y, z], mob);

    // Should not throw
    expect(() =>
      anim.interpolateSubmobject(mob, start, 0.5)
    ).not.toThrow();

    expect(mob._applyFunctionCalled).toBe(1);
  });
});

// ─── SmoothedVectorizedHomotopy ───────────────────────────────────────────────

describe("SmoothedVectorizedHomotopy", () => {
  it("constructs and extends Homotopy", () => {
    const mob = makeMockMobject();
    const fn = (x: number, y: number, z: number, _t: number): [number, number, number] => [x, y, z];
    const anim = new SmoothedVectorizedHomotopy(fn, mob);

    expect(anim).toBeInstanceOf(SmoothedVectorizedHomotopy);
    expect(anim).toBeInstanceOf(Homotopy);
    expect(anim.runTime).toBe(3);
  });

  it("calls makeSmooth on VMobject after interpolation", () => {
    const submob = makeMockVMobject();
    const startSub = makeMockVMobject();
    const mob = makeMockMobject();
    const fn = (x: number, y: number, z: number, _t: number): [number, number, number] => [x, y, z];

    const anim = new SmoothedVectorizedHomotopy(fn, mob);
    anim.interpolateSubmobject(
      submob as unknown as IMobject,
      startSub as unknown as IMobject,
      0.5,
    );

    expect(submob._makeSmoothCalled).toBe(1);
    expect(submob._applyFunctionCalled).toBe(1);
  });

  it("still calls applyFunction even without makeSmooth method", () => {
    // Build a VMobject that lacks makeSmooth entirely.
    const startSub = makeMockVMobject();
    const mob = makeMockMobject();
    let applyFnCount = 0;

    // Inline VMobject with no makeSmooth, tracking applyFunction directly.
    const noSmooth: IVMobject = {
      ...makeMockVMobject(),
      applyFunction(fn: (p: Point3D) => Point3D) {
        applyFnCount++;
        return noSmooth;
      },
    } as unknown as IVMobject;
    // Ensure makeSmooth is not present.
    if ("makeSmooth" in noSmooth) {
      delete (noSmooth as Record<string, unknown>)["makeSmooth"];
    }

    const fn = (x: number, y: number, z: number, _t: number): [number, number, number] => [x, y, z];

    const anim = new SmoothedVectorizedHomotopy(fn, mob);
    expect(() =>
      anim.interpolateSubmobject(noSmooth as unknown as IMobject, startSub as unknown as IMobject, 0.5)
    ).not.toThrow();
    expect(applyFnCount).toBe(1);
  });
});

// ─── ComplexHomotopy ──────────────────────────────────────────────────────────

describe("ComplexHomotopy", () => {
  it("constructs and extends Homotopy", () => {
    const mob = makeMockMobject();
    const complexFn = (z: { real: number; imag: number }, _t: number) => z;
    const anim = new ComplexHomotopy(complexFn, mob);

    expect(anim).toBeInstanceOf(ComplexHomotopy);
    expect(anim).toBeInstanceOf(Homotopy);
  });

  it("wraps complex homotopy: pure rotation by π at t=1", () => {
    const mob = makeMockMobject();
    // Rotation in the complex plane: multiply by e^(i*π*t)
    const complexFn = (
      z: { real: number; imag: number },
      t: number,
    ) => ({
      real: z.real * Math.cos(Math.PI * t) - z.imag * Math.sin(Math.PI * t),
      imag: z.real * Math.sin(Math.PI * t) + z.imag * Math.cos(Math.PI * t),
    });

    const anim = new ComplexHomotopy(complexFn, mob);
    const fn = anim.functionAtTimeT(1); // t=1 → rotate 180°

    // (1, 0, 0) rotated 180° → (-1, 0, 0)
    const result = fn(np.array([1, 0, 0]) as Point3D);
    const arr = result.toArray() as number[];
    expect(arr[0]).toBeCloseTo(-1, 6);
    expect(arr[1]).toBeCloseTo(0, 6);
    expect(arr[2]).toBeCloseTo(0, 6);
  });

  it("preserves z-coordinate unchanged", () => {
    const mob = makeMockMobject();
    const complexFn = (z: { real: number; imag: number }, _t: number) => ({
      real: z.real + 1,
      imag: z.imag + 1,
    });

    const anim = new ComplexHomotopy(complexFn, mob);
    const fn = anim.functionAtTimeT(0.5);

    const result = fn(np.array([0, 0, 7]) as Point3D);
    const arr = result.toArray() as number[];
    expect(arr[2]).toBeCloseTo(7, 8); // z unchanged
  });
});

// ─── PhaseFlow ────────────────────────────────────────────────────────────────

describe("PhaseFlow", () => {
  it("constructs with defaults", () => {
    const mob = makeMockMobject();
    const field = (p: Point3D) => p;
    const anim = new PhaseFlow(field, mob);

    expect(anim.virtualTime).toBe(1);
    expect(anim.rateFunc).toBe(linear); // default rate_func
    expect(anim.mobject).toBe(mob);
  });

  it("accepts custom virtualTime", () => {
    const mob = makeMockMobject();
    const anim = new PhaseFlow((p) => p, mob, { virtualTime: 2.5 });
    expect(anim.virtualTime).toBe(2.5);
  });

  it("does NOT call applyFunction on the first interpolateMobject call", () => {
    const mob = makeMockMobject();
    const anim = new PhaseFlow((p) => p, mob);

    anim.interpolateMobject(0);
    expect(mob._applyFunctionCalled).toBe(0);
  });

  it("calls applyFunction on subsequent interpolateMobject calls", () => {
    const mob = makeMockMobject();
    const anim = new PhaseFlow((p) => p, mob);

    anim.interpolateMobject(0);   // first call — no-op
    anim.interpolateMobject(0.5); // second call — applies function
    expect(mob._applyFunctionCalled).toBe(1);
  });

  it("applies correct dt: virtualTime * Δ(rateFunc(alpha))", () => {
    const mob = makeMockMobject();
    const received: number[] = [];

    // Vector field that returns a fixed velocity of [1, 0, 0]; capture dt via
    // position change on a known starting point.
    let capturedDt = 0;
    // Constant field — we'll capture dt by inspecting the function applied
    const field = (p: Point3D): Point3D => np.array([1, 0, 0]) as Point3D;

    const anim = new PhaseFlow(field, mob, { virtualTime: 2, rateFunc: linear });

    anim.interpolateMobject(0);    // sets lastAlpha = 0
    anim.interpolateMobject(0.25); // dt = 2 * (0.25 - 0) = 0.5

    // The function applied to any point p should be p + 0.5 * [1, 0, 0]
    if (mob._lastFn) {
      const origin = np.array([0, 0, 0]) as Point3D;
      const result = mob._lastFn(origin);
      const arr = result.toArray() as number[];
      // [0,0,0] + 0.5 * [1,0,0] = [0.5, 0, 0]
      expect(arr[0]).toBeCloseTo(0.5, 8);
    } else {
      throw new Error("applyFunction was never called");
    }
  });
});

// ─── MoveAlongPath ────────────────────────────────────────────────────────────

describe("MoveAlongPath", () => {
  let mob: ReturnType<typeof makeMockMobject>;
  let path: ReturnType<typeof makeMockVMobject>;

  beforeEach(() => {
    mob = makeMockMobject();
    path = makeMockVMobject([
      np.array([0, 0, 0]) as Point3D,
      np.array([4, 2, 0]) as Point3D,
    ]);
  });

  it("constructs with mobject and path", () => {
    const anim = new MoveAlongPath(mob, path as unknown as IVMobject);
    expect(anim.mobject).toBe(mob);
    expect(anim.path).toBe(path);
  });

  it("accepts AnimationOptions", () => {
    const anim = new MoveAlongPath(mob, path as unknown as IVMobject, {
      runTime: 2,
      rateFunc: linear,
    });
    expect(anim.runTime).toBe(2);
    expect(anim.rateFunc).toBe(linear);
  });

  it("calls moveTo at alpha=0 → start of path", () => {
    const anim = new MoveAlongPath(mob, path as unknown as IVMobject, {
      rateFunc: linear,
    });

    anim.interpolateMobject(0); // rate_func(0) = 0

    expect(mob._lastMoveToPoint).not.toBeNull();
    const arr = mob._lastMoveToPoint!.toArray() as number[];
    expect(arr[0]).toBeCloseTo(0, 8);
    expect(arr[1]).toBeCloseTo(0, 8);
  });

  it("calls moveTo at alpha=1 → end of path", () => {
    const anim = new MoveAlongPath(mob, path as unknown as IVMobject, {
      rateFunc: linear,
    });

    anim.interpolateMobject(1); // rate_func(1) = 1

    const arr = mob._lastMoveToPoint!.toArray() as number[];
    expect(arr[0]).toBeCloseTo(4, 8);
    expect(arr[1]).toBeCloseTo(2, 8);
  });

  it("calls moveTo at alpha=0.5 → midpoint of path", () => {
    const anim = new MoveAlongPath(mob, path as unknown as IVMobject, {
      rateFunc: linear,
    });

    anim.interpolateMobject(0.5);

    const arr = mob._lastMoveToPoint!.toArray() as number[];
    expect(arr[0]).toBeCloseTo(2, 8); // midpoint x = (0+4)/2 = 2
    expect(arr[1]).toBeCloseTo(1, 8); // midpoint y = (0+2)/2 = 1
  });

  it("isFinished returns true at alpha=1", () => {
    const anim = new MoveAlongPath(mob, path as unknown as IVMobject);
    expect(anim.isFinished(0.99)).toBe(false);
    expect(anim.isFinished(1.0)).toBe(true);
  });

  it("copy() returns a distinct object with same properties", () => {
    const anim = new MoveAlongPath(mob, path as unknown as IVMobject, {
      runTime: 2,
    });
    const copy = anim.copy() as MoveAlongPath;

    expect(copy).not.toBe(anim);
    expect(copy.mobject).toBe(mob);
    expect(copy.path).toBe(path);
    expect(copy.runTime).toBe(2);
  });
});
