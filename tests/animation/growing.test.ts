/**
 * Tests for animation/growing — GrowFromPoint, GrowFromCenter, GrowFromEdge,
 * GrowArrow, SpinInFromNothing, Transform, straightPath, spiralPath.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "../../tests/helpers/point-matchers.js";

import { np, PI, DOWN, RIGHT, OUT, ORIGIN, smooth } from "../../src/core/math/index.js";
import type { IMobject, IColor, IVMobject, Updater } from "../../src/core/types.js";
import type { Point3D, Points3D } from "../../src/core/math/index.js";
import type { mat4 } from "gl-matrix";

import {
  straightPath,
  spiralPath,
  Transform,
  GrowFromPoint,
  GrowFromCenter,
  GrowFromEdge,
  GrowArrow,
  SpinInFromNothing,
} from "../../src/animation/growing/index.js";

import type {
  IMobjectWithCriticalPoint,
  IArrow,
} from "../../src/animation/growing/index.js";

// ─── Mock helpers ─────────────────────────────────────────────

/** Minimal mock IColor that satisfies the interface. */
const WHITE: IColor = {
  r: 1, g: 1, b: 1, a: 1,
  toHex() { return "#FFFFFF"; },
  toArray() { return [1, 1, 1, 1]; },
  interpolate(_other: IColor, _t: number) { return WHITE; },
  lighter() { return WHITE; },
  darker() { return WHITE; },
};

const RED: IColor = {
  r: 1, g: 0, b: 0, a: 1,
  toHex() { return "#FF0000"; },
  toArray() { return [1, 0, 0, 1]; },
  interpolate(_other: IColor, _t: number) { return this; },
  lighter() { return this; },
  darker() { return this; },
};

/**
 * Minimal mock mobject for testing. Tracks calls to scale() and moveTo()
 * so tests can verify the growing animations configure the start state.
 */
class MockMobject implements IMobject {
  name = "mock";
  color: IColor = WHITE;
  submobjects: IMobject[] = [];
  updaters: Updater[] = [];
  zIndex = 0;

  /** VMobject-like points for interpolation tests. */
  points: Points3D = np.zeros([4, 3]);

  private _center: Point3D;

  // Call tracking
  scaleCalls: Array<{ factor: number; options?: unknown }> = [];
  moveToCalls: Point3D[] = [];
  setColorCalls: IColor[] = [];

  constructor(center: number[] = [0, 0, 0]) {
    this._center = np.array(center);
  }

  getCenter(): Point3D { return this._center; }
  getLeft(): Point3D { return this._center.subtract(np.array([1, 0, 0])); }
  getRight(): Point3D { return this._center.add(np.array([1, 0, 0])); }
  getTop(): Point3D { return this._center.add(np.array([0, 1, 0])); }
  getBottom(): Point3D { return this._center.subtract(np.array([0, 1, 0])); }
  getWidth(): number { return 2; }
  getHeight(): number { return 2; }

  moveTo(point: Point3D): this {
    this._center = point;
    this.moveToCalls.push(point);
    return this;
  }

  shift(...vectors: Point3D[]): this {
    for (const v of vectors) this._center = this._center.add(v);
    return this;
  }

  scale(factor: number, options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this {
    this.scaleCalls.push({ factor, options });
    return this;
  }

  rotate(_angle: number, _axis?: Point3D, _options?: { aboutPoint?: Point3D }): this {
    return this;
  }

  flip(_axis?: Point3D, _options?: { aboutPoint?: Point3D }): this {
    return this;
  }

  nextTo(
    _target: IMobject | Point3D,
    _direction?: Point3D,
    _options?: { buff?: number; alignedEdge?: Point3D }
  ): this {
    return this;
  }

  alignTo(_target: IMobject | Point3D, _direction: Point3D): this {
    return this;
  }

  add(...mobjects: IMobject[]): this {
    this.submobjects.push(...mobjects);
    return this;
  }

  remove(...mobjects: IMobject[]): this {
    this.submobjects = this.submobjects.filter((m) => !mobjects.includes(m));
    return this;
  }

  getFamily(_recurse?: boolean): IMobject[] {
    return [this];
  }

  setColor(color: IColor | unknown): this {
    this.setColorCalls.push(color as IColor);
    this.color = color as IColor;
    return this;
  }

  setOpacity(_opacity: number): this {
    return this;
  }

  addUpdater(_updater: Updater, _index?: number, _callUpdater?: boolean): this {
    return this;
  }

  removeUpdater(_updater: Updater): this {
    return this;
  }

  applyMatrix(_matrix: mat4 | number[][]): this {
    return this;
  }

  applyFunction(_fn: (point: Point3D) => Point3D): this {
    return this;
  }

  copy(): IMobject {
    const c = new MockMobject([...(this._center.toArray() as number[])]);
    c.points = this.points.copy() as Points3D;
    c.color = this.color;
    return c;
  }
}

/** Mock with getCriticalPoint for GrowFromEdge tests. */
class MockMobjectWithEdge extends MockMobject implements IMobjectWithCriticalPoint {
  getCriticalPoint(direction: Point3D): Point3D {
    const arr = direction.toArray() as number[];
    const cx = (this.getCenter().toArray() as number[])[0];
    const cy = (this.getCenter().toArray() as number[])[1];
    const cz = (this.getCenter().toArray() as number[])[2];
    return np.array([
      cx + arr[0],
      cy + arr[1],
      cz + arr[2],
    ]);
  }

  copy(): IMobject {
    const c = new MockMobjectWithEdge([...(this.getCenter().toArray() as number[])]);
    c.color = this.color;
    return c;
  }
}

/** Mock Arrow with getStart() for GrowArrow tests. */
class MockArrow extends MockMobject implements IArrow {
  private _start: Point3D;

  constructor(start: number[] = [-1, 0, 0], center: number[] = [0, 0, 0]) {
    super(center);
    this._start = np.array(start);
  }

  getStart(): Point3D {
    return this._start;
  }

  copy(): IMobject {
    const c = new MockArrow(
      [...(this._start.toArray() as number[])],
      [...(this.getCenter().toArray() as number[])]
    );
    c.color = this.color;
    return c;
  }
}

// ─── straightPath tests ───────────────────────────────────────

describe("straightPath", () => {
  it("returns start at alpha=0", () => {
    const fn = straightPath();
    const start = np.array([[0, 0, 0], [1, 0, 0]]);
    const end = np.array([[2, 0, 0], [3, 0, 0]]);
    const result = fn(start, end, 0);
    expect(result).toBeCloseToPoints(start);
  });

  it("returns end at alpha=1", () => {
    const fn = straightPath();
    const start = np.array([[0, 0, 0]]);
    const end = np.array([[4, 2, 1]]);
    const result = fn(start, end, 1);
    expect(result).toBeCloseToPoints(end);
  });

  it("linearly interpolates at alpha=0.5", () => {
    const fn = straightPath();
    const start = np.array([[0, 0, 0]]);
    const end = np.array([[4, 0, 0]]);
    const result = fn(start, end, 0.5);
    expect(result).toBeCloseToPoints(np.array([[2, 0, 0]]));
  });
});

// ─── spiralPath tests ─────────────────────────────────────────

describe("spiralPath", () => {
  it("returns start at alpha=0", () => {
    const fn = spiralPath(PI / 2);
    const start = np.array([[1, 0, 0]]);
    const end = np.array([[0, 1, 0]]);
    const result = fn(start, end, 0);
    expect(result).toBeCloseToPoints(start);
  });

  it("returns end at alpha=1", () => {
    const fn = spiralPath(PI / 2);
    const start = np.array([[1, 0, 0]]);
    const end = np.array([[2, 0, 0]]);
    const result = fn(start, end, 1);
    expect(result).toBeCloseToPoints(end);
  });

  it("falls back to straight path for near-zero angle", () => {
    const spiral = spiralPath(0);
    const straight = straightPath();
    const start = np.array([[0, 0, 0]]);
    const end = np.array([[3, 1, 0]]);
    const r1 = spiral(start, end, 0.5);
    const r2 = straight(start, end, 0.5);
    expect(r1).toBeCloseToPoints(r2);
  });
});

// ─── Transform tests ──────────────────────────────────────────

describe("Transform", () => {
  it("sets default properties", () => {
    const mob = new MockMobject();
    const t = new Transform(mob);
    expect(t.mobject).toBe(mob);
    expect(t.runTime).toBe(1.0);
    expect(t.rateFunc).toBe(smooth);
    expect(t.lagRatio).toBe(0);
    expect(t.remover).toBe(false);
    expect(t.introducer).toBe(false);
    expect(t.name).toBe("Transform");
  });

  it("respects constructor options", () => {
    const mob = new MockMobject();
    const myRate = (t: number) => t * t;
    const t = new Transform(mob, {
      runTime: 2.5,
      rateFunc: myRate,
      lagRatio: 0.1,
      name: "MyTransform",
      remover: true,
      introducer: true,
    });
    expect(t.runTime).toBe(2.5);
    expect(t.rateFunc).toBe(myRate);
    expect(t.lagRatio).toBe(0.1);
    expect(t.name).toBe("MyTransform");
    expect(t.remover).toBe(true);
    expect(t.introducer).toBe(true);
  });

  it("createTarget returns the mobject itself", () => {
    const mob = new MockMobject();
    const t = new Transform(mob);
    expect(t.createTarget()).toBe(mob);
  });

  it("createStartingMobject returns a copy", () => {
    const mob = new MockMobject();
    const t = new Transform(mob);
    const start = t.createStartingMobject();
    expect(start).not.toBe(mob);
  });

  it("isFinished returns true at alpha >= 1", () => {
    const mob = new MockMobject();
    const t = new Transform(mob);
    expect(t.isFinished(1.0)).toBe(true);
    expect(t.isFinished(0.99)).toBe(false);
  });

  it("getRunTime returns runTime", () => {
    const mob = new MockMobject();
    const t = new Transform(mob, { runTime: 3 });
    expect(t.getRunTime()).toBe(3);
  });
});

// ─── GrowFromPoint tests ──────────────────────────────────────

describe("GrowFromPoint", () => {
  let mob: MockMobject;
  const point = np.array([1, 2, 0]);

  beforeEach(() => {
    mob = new MockMobject();
  });

  it("stores point and pointColor", () => {
    const anim = new GrowFromPoint(mob, point, RED);
    expect((anim as unknown as { point: Point3D }).point).toBeCloseToPoint(point);
    expect((anim as unknown as { pointColor: IColor }).pointColor).toBe(RED);
  });

  it("sets introducer=true by default", () => {
    const anim = new GrowFromPoint(mob, point);
    expect(anim.introducer).toBe(true);
  });

  it("pointColor defaults to null", () => {
    const anim = new GrowFromPoint(mob, point);
    expect((anim as unknown as { pointColor: IColor | null }).pointColor).toBeNull();
  });

  it("createTarget returns the mobject", () => {
    const anim = new GrowFromPoint(mob, point);
    expect(anim.createTarget()).toBe(mob);
  });

  it("createStartingMobject scales to 0 and moves to point", () => {
    const anim = new GrowFromPoint(mob, point);
    const start = anim.createStartingMobject() as MockMobject;
    // The copy should have been scaled to 0 and moved
    expect(start.scaleCalls.some((c) => c.factor === 0)).toBe(true);
    expect(start.moveToCalls.length).toBeGreaterThan(0);
  });

  it("createStartingMobject applies pointColor when provided", () => {
    const anim = new GrowFromPoint(mob, point, RED);
    const start = anim.createStartingMobject() as MockMobject;
    expect(start.setColorCalls.length).toBeGreaterThan(0);
    expect(start.setColorCalls[start.setColorCalls.length - 1]).toBe(RED);
  });

  it("does not apply pointColor when null", () => {
    const anim = new GrowFromPoint(mob, point, null);
    const start = anim.createStartingMobject() as MockMobject;
    expect(start.setColorCalls.length).toBe(0);
  });
});

// ─── GrowFromCenter tests ─────────────────────────────────────

describe("GrowFromCenter", () => {
  it("uses mobject.getCenter() as the grow point", () => {
    const mob = new MockMobject([3, 4, 0]);
    const anim = new GrowFromCenter(mob);
    const storedPoint = (anim as unknown as { point: Point3D }).point;
    expect(storedPoint).toBeCloseToPoint(np.array([3, 4, 0]));
  });

  it("propagates pointColor", () => {
    const mob = new MockMobject();
    const anim = new GrowFromCenter(mob, RED);
    expect((anim as unknown as { pointColor: IColor }).pointColor).toBe(RED);
  });
});

// ─── GrowFromEdge tests ───────────────────────────────────────

describe("GrowFromEdge", () => {
  it("uses getCriticalPoint(edge) as the grow point", () => {
    const mob = new MockMobjectWithEdge([0, 0, 0]);
    // With center [0,0,0] and DOWN = [0,-1,0], getCriticalPoint returns [0,-1,0]
    const anim = new GrowFromEdge(mob, DOWN);
    const storedPoint = (anim as unknown as { point: Point3D }).point;
    expect(storedPoint).toBeCloseToPoint(np.array([0, -1, 0]));
  });

  it("uses getCriticalPoint(RIGHT) for right edge", () => {
    const mob = new MockMobjectWithEdge([0, 0, 0]);
    const anim = new GrowFromEdge(mob, RIGHT);
    const storedPoint = (anim as unknown as { point: Point3D }).point;
    expect(storedPoint).toBeCloseToPoint(np.array([1, 0, 0]));
  });
});

// ─── GrowArrow tests ──────────────────────────────────────────

describe("GrowArrow", () => {
  it("uses arrow.getStart() as the grow point", () => {
    const arrow = new MockArrow([-2, 0, 0]);
    const anim = new GrowArrow(arrow);
    const storedPoint = (anim as unknown as { point: Point3D }).point;
    expect(storedPoint).toBeCloseToPoint(np.array([-2, 0, 0]));
  });

  it("propagates pointColor", () => {
    const arrow = new MockArrow();
    const anim = new GrowArrow(arrow, RED);
    expect((anim as unknown as { pointColor: IColor }).pointColor).toBe(RED);
  });

  it("sets introducer=true", () => {
    const arrow = new MockArrow();
    const anim = new GrowArrow(arrow);
    expect(anim.introducer).toBe(true);
  });
});

// ─── SpinInFromNothing tests ──────────────────────────────────

describe("SpinInFromNothing", () => {
  it("has default angle of PI/2", () => {
    const mob = new MockMobject();
    const anim = new SpinInFromNothing(mob);
    expect(anim.angle).toBeCloseTo(PI / 2);
  });

  it("stores a custom angle", () => {
    const mob = new MockMobject();
    const anim = new SpinInFromNothing(mob, PI * 2);
    expect(anim.angle).toBeCloseTo(PI * 2);
  });

  it("sets introducer=true", () => {
    const mob = new MockMobject();
    const anim = new SpinInFromNothing(mob);
    expect(anim.introducer).toBe(true);
  });

  it("propagates pointColor to GrowFromCenter", () => {
    const mob = new MockMobject([1, 1, 0]);
    const anim = new SpinInFromNothing(mob, PI / 2, RED);
    expect((anim as unknown as { pointColor: IColor }).pointColor).toBe(RED);
  });

  it("grow point is the mobject center", () => {
    const mob = new MockMobject([5, 3, 0]);
    const anim = new SpinInFromNothing(mob);
    const storedPoint = (anim as unknown as { point: Point3D }).point;
    expect(storedPoint).toBeCloseToPoint(np.array([5, 3, 0]));
  });
});
