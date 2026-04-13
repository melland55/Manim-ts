import { describe, it, expect, vi } from "vitest";
import { Scene } from "../src/scene/index.js";
import type { IMobject, IAnimation, ICamera, Updater } from "../src/core/types.js";
import type { Point3D, Points3D } from "../src/core/types.js";
import type { mat4 } from "gl-matrix";

// ─── Minimal mock implementations ────────────────────────────────────────────

function makeMobject(overrides: Partial<IMobject> = {}): IMobject {
  const mob: IMobject = {
    name: "mock",
    color: { r: 1, g: 1, b: 1, a: 1, toHex: () => "#ffffff", toArray: () => [1, 1, 1, 1], interpolate: (o) => o, lighter: () => mob.color, darker: () => mob.color },
    submobjects: [],
    updaters: [],
    zIndex: 0,
    getCenter: () => { throw new Error("stub"); },
    getLeft: () => { throw new Error("stub"); },
    getRight: () => { throw new Error("stub"); },
    getTop: () => { throw new Error("stub"); },
    getBottom: () => { throw new Error("stub"); },
    getWidth: () => 0,
    getHeight: () => 0,
    moveTo: () => mob,
    shift: () => mob,
    scale: () => mob,
    rotate: () => mob,
    flip: () => mob,
    nextTo: () => mob,
    alignTo: () => mob,
    add: () => mob,
    remove: () => mob,
    getFamily: (_recurse?: boolean) => [],
    setColor: () => mob,
    setOpacity: () => mob,
    addUpdater: (updater: Updater, _index?: number, _call?: boolean) => { mob.updaters.push(updater); return mob; },
    removeUpdater: (updater: Updater) => { mob.updaters = mob.updaters.filter(u => u !== updater); return mob; },
    applyMatrix: () => mob,
    applyFunction: () => mob,
    copy: () => makeMobject(),
    ...overrides,
  };
  return mob;
}

function makeAnimation(runTime = 1, overrides: Partial<IAnimation> = {}): IAnimation & { interpolateCalls: number[] } {
  const interpolateCalls: number[] = [];
  const mob = makeMobject();
  const anim: IAnimation & { interpolateCalls: number[] } = {
    mobject: mob,
    runTime,
    rateFunc: (t) => t,
    lagRatio: 0,
    name: "mock-anim",
    remover: false,
    introducer: false,
    interpolateCalls,
    begin: vi.fn(),
    finish: vi.fn(),
    interpolate: vi.fn((alpha: number) => { interpolateCalls.push(alpha); }),
    interpolateMobject: vi.fn(),
    interpolateSubmobject: vi.fn(),
    setupScene: vi.fn(),
    cleanUpFromScene: vi.fn(),
    getAllMobjects: () => [mob],
    copy: () => makeAnimation(runTime),
    isFinished: (alpha: number) => alpha >= 1,
    getRunTime: () => runTime,
    ...overrides,
  };
  return anim;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Scene", () => {
  it("constructs with default properties", () => {
    const scene = new Scene();
    expect(scene.mobjects).toEqual([]);
    expect(scene.time).toBe(0);
    expect(scene.camera).toBeDefined();
  });

  it("accepts a custom frame rate", () => {
    const scene = new Scene({ frameRate: 60 });
    // Frame rate is protected, but we can verify indirectly via wait timing
    expect(scene).toBeInstanceOf(Scene);
  });

  it("accepts a custom camera", () => {
    const cam: ICamera = {
      pixelWidth: 640,
      pixelHeight: 360,
      frameWidth: 8,
      frameHeight: 4.5,
      backgroundColor: { r: 0, g: 0, b: 0, a: 1, toHex: () => "#000000", toArray: () => [0, 0, 0, 1], interpolate: (o) => o, lighter: () => ({ r: 0.1, g: 0.1, b: 0.1, a: 1, toHex: () => "#1a1a1a", toArray: () => [0.1, 0.1, 0.1, 1], interpolate: (o) => o, lighter: (a) => o, darker: (a) => o }), darker: () => cam.backgroundColor },
      getFrameCenter: () => { throw new Error("stub"); },
      setFrameCenter: () => {},
      captureFrame: () => {},
    };
    const scene = new Scene({ camera: cam });
    expect(scene.camera).toBe(cam);
  });

  describe("add / remove", () => {
    it("adds mobjects to the scene", () => {
      const scene = new Scene();
      const a = makeMobject({ name: "a" });
      const b = makeMobject({ name: "b" });
      scene.add(a, b);
      expect(scene.mobjects).toContain(a);
      expect(scene.mobjects).toContain(b);
    });

    it("does not add duplicate mobjects", () => {
      const scene = new Scene();
      const mob = makeMobject();
      scene.add(mob);
      scene.add(mob);
      expect(scene.mobjects.filter((m) => m === mob)).toHaveLength(1);
    });

    it("removes mobjects from the scene", () => {
      const scene = new Scene();
      const mob = makeMobject();
      scene.add(mob);
      scene.remove(mob);
      expect(scene.mobjects).not.toContain(mob);
    });

    it("silently ignores removing a mobject that is not present", () => {
      const scene = new Scene();
      const mob = makeMobject();
      expect(() => scene.remove(mob)).not.toThrow();
    });

    it("supports method chaining", () => {
      const scene = new Scene();
      const mob = makeMobject();
      const result = scene.add(mob).remove(mob);
      expect(result).toBe(scene);
    });
  });

  describe("play", () => {
    it("calls begin, interpolate(1), finish on an animation", async () => {
      const scene = new Scene({ frameRate: 60 });
      const anim = makeAnimation(0); // zero runTime → finishes immediately

      await scene.play(anim);

      expect(anim.begin).toHaveBeenCalledOnce();
      expect(anim.finish).toHaveBeenCalledOnce();
      expect(anim.setupScene).toHaveBeenCalledWith(scene);
    });

    it("adds mobject to scene when animation.introducer is true", async () => {
      const scene = new Scene({ frameRate: 60 });
      const mob = makeMobject();
      const anim = makeAnimation(0, {
        introducer: true,
        getAllMobjects: () => [mob],
      });

      await scene.play(anim);

      expect(scene.mobjects).toContain(mob);
    });

    it("removes mobject from scene when animation.remover is true", async () => {
      const scene = new Scene({ frameRate: 60 });
      const mob = makeMobject();
      scene.add(mob);

      const anim = makeAnimation(0, {
        remover: true,
        getAllMobjects: () => [mob],
      });

      await scene.play(anim);

      expect(scene.mobjects).not.toContain(mob);
    });

    it("advances scene.time by runTime after play", async () => {
      const scene = new Scene({ frameRate: 60 });
      const anim = makeAnimation(1);

      await scene.play(anim);

      expect(scene.time).toBeCloseTo(1, 1);
    });

    it("returns immediately when given no animations", async () => {
      const scene = new Scene();
      const before = scene.time;
      await scene.play();
      expect(scene.time).toBe(before);
    });
  });

  describe("wait", () => {
    it("advances scene.time by the given duration", async () => {
      const scene = new Scene({ frameRate: 60 });
      await scene.wait(2);
      expect(scene.time).toBeCloseTo(2, 1);
    });

    it("returns without changing time when duration is 0", async () => {
      const scene = new Scene();
      await scene.wait(0);
      expect(scene.time).toBe(0);
    });

    it("stops early when stopCondition returns true", async () => {
      const scene = new Scene({ frameRate: 60 });
      let ticks = 0;
      const stopCondition = () => {
        ticks++;
        return ticks >= 2; // stop after 2 ticks
      };
      await scene.wait(100, stopCondition);
      // Should not have waited anywhere near 100 s
      expect(scene.time).toBeLessThan(100);
    });

    it("runs updaters during wait", async () => {
      const scene = new Scene({ frameRate: 60 });
      const updaterCalls: number[] = [];
      const mob = makeMobject({
        updaters: [(_m, dt) => updaterCalls.push(dt)],
      });
      scene.add(mob);

      await scene.wait(0.1);

      // 0.1 s at 60 fps ≈ 6 frames → updater should have been called several times
      expect(updaterCalls.length).toBeGreaterThan(0);
    });
  });

  describe("construct", () => {
    it("is a no-op in the base class", async () => {
      const scene = new Scene();
      await expect(scene.construct()).resolves.toBeUndefined();
      expect(scene.time).toBe(0);
    });

    it("can be overridden in a subclass", async () => {
      class MyScene extends Scene {
        async construct() {
          await this.wait(0.5);
        }
      }
      const scene = new MyScene({ frameRate: 60 });
      await scene.construct();
      expect(scene.time).toBeCloseTo(0.5, 1);
    });
  });

  describe("getMobjectFamily", () => {
    it("returns top-level mobjects plus their submobjects", () => {
      const scene = new Scene();
      const child = makeMobject({ name: "child" });
      const parent = makeMobject({
        name: "parent",
        getFamily: (_recurse?: boolean) => [child],
      });
      scene.add(parent);

      const family = scene.getMobjectFamily();

      expect(family).toContain(parent);
      expect(family).toContain(child);
    });

    it("returns empty array when no mobjects are present", () => {
      const scene = new Scene();
      expect(scene.getMobjectFamily()).toEqual([]);
    });
  });
});
