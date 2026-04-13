/**
 * Tests for animation/specialized — Broadcast
 */

import { describe, it, expect } from "vitest";
import "../../tests/helpers/point-matchers.js";

import { np, ORIGIN, UP, RIGHT } from "../../src/core/math/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";
import { Broadcast } from "../../src/animation/specialized/index.js";
import type { BroadcastOptions } from "../../src/animation/specialized/index.js";
import { Restore } from "../../src/animation/transform/index.js";

// ─── Tests ───────────────────────────────────────────────────

describe("Broadcast", () => {
  it("constructs with defaults", () => {
    const mob = new Mobject();
    const anim = new Broadcast(mob);

    expect(anim.focalPoint).toBeCloseToPoint(ORIGIN);
    expect(anim.nMobs).toBe(5);
    expect(anim.initialOpacity).toBe(1);
    expect(anim.finalOpacity).toBe(0);
    expect(anim.initialWidth).toBe(0.0);
    expect(anim.runTime).toBe(3);
    expect(anim.lagRatio).toBe(0.2);
  });

  it("constructs with custom options", () => {
    const mob = new Mobject();
    const focal = np.array([1, 2, 0]);
    const anim = new Broadcast(mob, {
      focalPoint: focal,
      nMobs: 3,
      initialOpacity: 0.8,
      finalOpacity: 0.1,
      initialWidth: 0.5,
      runTime: 5,
      lagRatio: 0.4,
    });

    expect(anim.focalPoint).toBeCloseToPoint(focal);
    expect(anim.nMobs).toBe(3);
    expect(anim.initialOpacity).toBe(0.8);
    expect(anim.finalOpacity).toBe(0.1);
    expect(anim.initialWidth).toBe(0.5);
    expect(anim.runTime).toBe(5);
    expect(anim.lagRatio).toBe(0.4);
  });

  it("creates the correct number of sub-animations", () => {
    const mob = new Mobject();
    const anim = new Broadcast(mob, { nMobs: 7 });

    expect(anim.animations.length).toBe(7);
  });

  it("creates sub-animations with remover=true by default", () => {
    const mob = new Mobject();
    const anim = new Broadcast(mob);

    for (const sub of anim.animations) {
      expect(sub.remover).toBe(true);
    }
  });

  it("respects remover=false option", () => {
    const mob = new Mobject();
    const anim = new Broadcast(mob, { remover: false });

    for (const sub of anim.animations) {
      expect(sub.remover).toBe(false);
    }
  });

  it("handles nMobs=1", () => {
    const mob = new Mobject();
    const anim = new Broadcast(mob, { nMobs: 1 });

    expect(anim.animations.length).toBe(1);
  });

  it("handles nMobs=0 (no sub-animations)", () => {
    const mob = new Mobject();
    const anim = new Broadcast(mob, { nMobs: 0 });

    expect(anim.animations.length).toBe(0);
  });

  it("uses custom focal point", () => {
    const mob = new Mobject();
    const focal = np.array([3, 4, 0]);
    const anim = new Broadcast(mob, { focalPoint: focal });

    expect(anim.focalPoint).toBeCloseToPoint(focal);
  });

  it("exports from barrel index", async () => {
    const mod = await import("../../src/animation/specialized/index.js");
    expect(mod.Broadcast).toBeDefined();
    expect(typeof mod.Broadcast).toBe("function");
  });

  it("sub-animations are Restore instances", () => {
    const mob = new Mobject();
    const anim = new Broadcast(mob, { nMobs: 3 });

    for (const sub of anim.animations) {
      expect(sub).toBeInstanceOf(Restore);
    }
  });
});
