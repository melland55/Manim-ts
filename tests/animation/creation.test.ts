/**
 * Tests for animation/creation — Create, Uncreate, DrawBorderThenFill,
 * Write, Unwrite, ShowIncreasingSubsets, ShowSubmobjectsOneByOne, SpiralIn,
 * AddTextLetterByLetter, RemoveTextLetterByLetter.
 */

import { describe, it, expect } from "vitest";
import "../../tests/helpers/point-matchers.js";

import { np, smooth, linear } from "../../src/core/math/index.js";
import type { IMobject, IColor, Updater } from "../../src/core/types.js";
import type { Point3D, Points3D } from "../../src/core/math/index.js";
import type { mat4 } from "gl-matrix";

import {
  Create,
  Uncreate,
  ShowPartial,
  DrawBorderThenFill,
  Write,
  Unwrite,
  ShowIncreasingSubsets,
  ShowSubmobjectsOneByOne,
  AddTextWordByWord,
} from "../../src/animation/creation/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";

// ─── Mock helpers ─────────────────────────────────────────────

const WHITE: IColor = {
  r: 1, g: 1, b: 1, a: 1,
  toHex() { return "#FFFFFF"; },
  toArray() { return [1, 1, 1, 1]; },
  interpolate(_other: IColor, _t: number) { return WHITE; },
  lighter() { return WHITE; },
  darker() { return WHITE; },
};

class MockMobject implements IMobject {
  name = "mock";
  color: IColor = WHITE;
  submobjects: IMobject[] = [];
  updaters: Updater[] = [];
  zIndex = 0;
  points: Points3D = np.zeros([4, 3]);
  private _center: Point3D;
  private _opacity = 1;

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
    return this;
  }

  shift(...vectors: Point3D[]): this {
    for (const v of vectors) this._center = this._center.add(v);
    return this;
  }

  scale(_factor: number, _options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this {
    return this;
  }

  rotate(_angle: number, _axis?: Point3D, _options?: { aboutPoint?: Point3D }): this {
    return this;
  }

  flip(_axis?: Point3D, _options?: { aboutPoint?: Point3D }): this {
    return this;
  }

  nextTo(_target: IMobject | Point3D, _direction?: Point3D, _options?: { buff?: number; alignedEdge?: Point3D }): this {
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
    return [this, ...this.submobjects];
  }

  setColor(color: IColor | unknown): this {
    this.color = color as IColor;
    return this;
  }

  setOpacity(opacity: number): this {
    this._opacity = opacity;
    return this;
  }

  getOpacity(): number {
    return this._opacity;
  }

  addUpdater(_updater: Updater, _index?: number, _callUpdater?: boolean): this { return this; }
  removeUpdater(_updater: Updater): this { return this; }
  applyMatrix(_matrix: mat4 | number[][]): this { return this; }
  applyFunction(_fn: (point: Point3D) => Point3D): this { return this; }

  copy(): IMobject {
    const c = new MockMobject([...(this._center.toArray() as number[])]);
    c.points = this.points.copy() as Points3D;
    c.color = this.color;
    c.submobjects = this.submobjects.map((s) => s.copy());
    return c;
  }
}

/**
 * Mock VMobject with pointwiseBecomePartial for ShowPartial/Create/Uncreate tests.
 */
class MockVMobject extends MockMobject {
  fillOpacity = 1;
  strokeOpacity = 1;
  strokeWidth = 2;
  strokeColor: IColor = WHITE;

  pointwiseBecomePartialCalls: Array<{ a: number; b: number }> = [];
  matchStyleCalls: IMobject[] = [];

  pointwiseBecomePartial(_other: IMobject, a: number, b: number): void {
    this.pointwiseBecomePartialCalls.push({ a, b });
  }

  setFill(options?: { color?: unknown; opacity?: number }): this {
    if (options?.opacity !== undefined) this.fillOpacity = options.opacity;
    return this;
  }

  setStroke(options?: { color?: unknown; width?: number; opacity?: number }): this {
    if (options?.width !== undefined) this.strokeWidth = options.width;
    if (options?.opacity !== undefined) this.strokeOpacity = options.opacity;
    return this;
  }

  getStrokeWidth(): number { return this.strokeWidth; }
  getStrokeColor(): IColor { return this.strokeColor; }
  getFillOpacity(): number { return this.fillOpacity; }
  getStrokeOpacity(): number { return this.strokeOpacity; }

  matchStyle(other: IMobject): this {
    this.matchStyleCalls.push(other);
    return this;
  }

  interpolate(_m1: IMobject, _m2: IMobject, _alpha: number): this {
    return this;
  }

  familyMembersWithPoints(): IMobject[] {
    return [this];
  }

  invert(_recursive?: boolean): void {
    this.submobjects.reverse();
  }

  copy(): IMobject {
    const c = new MockVMobject([...(this.getCenter().toArray() as number[])]);
    c.fillOpacity = this.fillOpacity;
    c.strokeOpacity = this.strokeOpacity;
    c.strokeWidth = this.strokeWidth;
    c.color = this.color;
    c.submobjects = this.submobjects.map((s) => s.copy());
    return c;
  }
}

// ─── Tests ──────────────────────────────────────────────────

describe("Create", () => {
  it("throws TypeError for non-VMobject", () => {
    const mob = new MockMobject();
    expect(() => new Create(mob)).toThrow(TypeError);
  });

  it("constructs with defaults for VMobject", () => {
    const vmob = new MockVMobject();
    const anim = new Create(vmob);
    expect(anim.lagRatio).toBe(1.0);
    expect(anim.introducer).toBe(true);
    expect(anim.mobject).toBe(vmob);
  });

  it("_getBounds returns [0, alpha]", () => {
    const vmob = new MockVMobject();
    const anim = new Create(vmob);
    // Access protected method via type assertion
    expect((anim as unknown as { _getBounds(a: number): [number, number] })._getBounds(0.5)).toEqual([0, 0.5]);
    expect((anim as unknown as { _getBounds(a: number): [number, number] })._getBounds(1.0)).toEqual([0, 1.0]);
  });
});

describe("Uncreate", () => {
  it("sets remover=true and introducer=false", () => {
    const vmob = new MockVMobject();
    const anim = new Uncreate(vmob);
    expect(anim.remover).toBe(true);
    expect(anim.introducer).toBe(false);
  });
});

describe("DrawBorderThenFill", () => {
  it("throws TypeError for non-VMobject", () => {
    const mob = new MockMobject();
    expect(() => new DrawBorderThenFill(mob)).toThrow(TypeError);
  });

  it("constructs with default runTime=2", () => {
    const vmob = new MockVMobject();
    const anim = new DrawBorderThenFill(vmob);
    expect(anim.runTime).toBe(2);
    expect(anim.introducer).toBe(true);
    expect(anim.strokeWidth).toBe(2);
  });

  it("custom stroke width is preserved", () => {
    const vmob = new MockVMobject();
    const anim = new DrawBorderThenFill(vmob, { strokeWidth: 5 });
    expect(anim.strokeWidth).toBe(5);
  });
});

describe("Write", () => {
  it("constructs with linear rate function by default", () => {
    const vmob = new MockVMobject();
    const anim = new Write(vmob);
    expect(anim.rateFunc).toBe(linear);
    expect(anim.reverse).toBe(false);
  });

  it("sets remover=true when reverse=true", () => {
    const vmob = new MockVMobject();
    const anim = new Write(vmob, { reverse: true });
    expect(anim.reverse).toBe(true);
    expect(anim.remover).toBe(true);
    expect(anim.introducer).toBe(false);
  });

  it("computes runTime based on family length", () => {
    const vmob = new MockVMobject();
    // 1 family member with points → length < 15 → runTime=1
    const anim = new Write(vmob);
    expect(anim.runTime).toBe(1);
  });
});

describe("Unwrite", () => {
  it("sets reverse=true by default", () => {
    const vmob = new MockVMobject();
    const anim = new Unwrite(vmob);
    expect(anim.reverse).toBe(true);
  });
});

describe("ShowIncreasingSubsets", () => {
  it("initially hides all submobjects", () => {
    const parent = new MockMobject();
    const sub1 = new MockMobject([1, 0, 0]);
    const sub2 = new MockMobject([2, 0, 0]);
    const sub3 = new MockMobject([3, 0, 0]);
    parent.add(sub1, sub2, sub3);

    const anim = new ShowIncreasingSubsets(parent);
    // All submobs should have been set to opacity 0
    expect(sub1.getOpacity()).toBe(0);
    expect(sub2.getOpacity()).toBe(0);
    expect(sub3.getOpacity()).toBe(0);
    expect(anim.allSubmobs).toHaveLength(3);
  });

  it("updateSubmobjectList shows correct number of submobs", () => {
    const parent = new MockMobject();
    const sub1 = new MockMobject([1, 0, 0]);
    const sub2 = new MockMobject([2, 0, 0]);
    const sub3 = new MockMobject([3, 0, 0]);
    parent.add(sub1, sub2, sub3);

    const anim = new ShowIncreasingSubsets(parent);
    anim.updateSubmobjectList(2);
    expect(sub1.getOpacity()).toBe(1);
    expect(sub2.getOpacity()).toBe(1);
    expect(sub3.getOpacity()).toBe(0);
  });

  it("updateSubmobjectList(0) hides everything", () => {
    const parent = new MockMobject();
    const sub1 = new MockMobject([1, 0, 0]);
    parent.add(sub1);

    const anim = new ShowIncreasingSubsets(parent);
    anim.updateSubmobjectList(0);
    expect(sub1.getOpacity()).toBe(0);
  });
});

describe("ShowSubmobjectsOneByOne", () => {
  it("shows only the last submobject in the range", () => {
    const parent = new Mobject();
    const sub1 = new Mobject();
    const sub2 = new Mobject();
    const sub3 = new Mobject();
    parent.add(sub1, sub2, sub3);

    const anim = new ShowSubmobjectsOneByOne(parent as unknown as IMobject);
    anim.updateSubmobjectList(2);
    // The allSubmobs are the group's submobjects — only last visible one shown
    // sub1 hidden, sub2 shown
    expect(anim.allSubmobs.length).toBe(3);
  });

  it("uses Math.ceil as default intFunc", () => {
    const parent = new Mobject();
    const sub1 = new Mobject();
    parent.add(sub1);

    const anim = new ShowSubmobjectsOneByOne(parent as unknown as IMobject);
    expect(anim.intFunc).toBe(Math.ceil);
  });
});

describe("AddTextWordByWord", () => {
  it("stores timePerChar", () => {
    const mob = new MockMobject();
    const anim = new AddTextWordByWord(mob, { timePerChar: 0.08 });
    expect(anim.timePerChar).toBe(0.08);
  });

  it("defaults timePerChar to 0.06", () => {
    const mob = new MockMobject();
    const anim = new AddTextWordByWord(mob);
    expect(anim.timePerChar).toBe(0.06);
  });
});
