import { describe, it, expect } from "vitest";
import type { IAnimation, AnimationOptions } from "../src/animation/index.js";

describe("animation module", () => {
  it("exports IAnimation type", () => {
    // IAnimation is an interface — verify it can be used as a type annotation
    const anim: IAnimation | null = null;
    expect(anim).toBeNull();
  });

  it("exports AnimationOptions type", () => {
    // AnimationOptions is a plain options object interface
    const opts: AnimationOptions = {
      runTime: 1.0,
      lagRatio: 0,
      remover: false,
      introducer: false,
      suspendMobjectUpdating: true,
    };
    expect(opts.runTime).toBe(1.0);
    expect(opts.lagRatio).toBe(0);
    expect(opts.remover).toBe(false);
    expect(opts.introducer).toBe(false);
    expect(opts.suspendMobjectUpdating).toBe(true);
  });

  it("AnimationOptions allows partial construction", () => {
    const opts: AnimationOptions = { runTime: 2.5 };
    expect(opts.runTime).toBe(2.5);
    expect(opts.lagRatio).toBeUndefined();
    expect(opts.name).toBeUndefined();
  });

  it("AnimationOptions runTime defaults are optional", () => {
    const opts: AnimationOptions = {};
    expect(opts.runTime).toBeUndefined();
    expect(opts.rateFunc).toBeUndefined();
  });

  it("IAnimation interface shape is correct", () => {
    // Construct a mock object that satisfies IAnimation
    const mockAnim: IAnimation = {
      mobject: null as any,
      runTime: 1.0,
      rateFunc: (t: number) => t,
      lagRatio: 0,
      name: "TestAnimation",
      remover: false,
      introducer: false,
      begin() {},
      finish() {},
      interpolate(_alpha: number) {},
      interpolateMobject(_alpha: number) {},
      interpolateSubmobject(_sub: any, _start: any, _alpha: number) {},
      setupScene(_scene: any) {},
      cleanUpFromScene(_scene: any) {},
      getAllMobjects() { return []; },
      copy() { return this; },
      isFinished(alpha: number) { return alpha >= 1; },
      getRunTime() { return this.runTime; },
    };

    expect(mockAnim.runTime).toBe(1.0);
    expect(mockAnim.lagRatio).toBe(0);
    expect(mockAnim.name).toBe("TestAnimation");
    expect(mockAnim.remover).toBe(false);
    expect(mockAnim.isFinished(1.0)).toBe(true);
    expect(mockAnim.isFinished(0.5)).toBe(false);
    expect(mockAnim.getRunTime()).toBe(1.0);
    expect(mockAnim.getAllMobjects()).toEqual([]);
  });

  it("rateFunc is callable with t in [0,1]", () => {
    const linear = (t: number) => t;
    const opts: AnimationOptions = { rateFunc: linear };
    expect(opts.rateFunc!(0)).toBe(0);
    expect(opts.rateFunc!(0.5)).toBe(0.5);
    expect(opts.rateFunc!(1)).toBe(1);
  });
});
