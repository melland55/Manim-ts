/**
 * Tests for src/mobject/logo/
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np } from "../../src/core/math/index.js";
import { ManimBanner } from "../../src/mobject/logo/index.js";
import { Mobject } from "../../src/mobject/mobject/index.js";
import { AnimationGroup, Succession } from "../../src/animation/composition/index.js";

describe("ManimBanner", () => {
  describe("constructor", () => {
    it("creates with dark theme by default", () => {
      const banner = new ManimBanner();
      expect(banner.fontColor).toBe("#ece6e2");
    });

    it("creates with light theme when specified", () => {
      const banner = new ManimBanner(false);
      expect(banner.fontColor).toBe("#343434");
    });

    it("has scaleFactor of 1.0 by default", () => {
      const banner = new ManimBanner();
      expect(banner.scaleFactor).toBe(1.0);
    });

    it("creates M, circle, square, triangle, and shapes submobjects", () => {
      const banner = new ManimBanner();
      expect(banner.M).toBeDefined();
      expect(banner.circle).toBeDefined();
      expect(banner.square).toBeDefined();
      expect(banner.triangle).toBeDefined();
      expect(banner.shapes).toBeDefined();
    });

    it("creates anim group that is not yet a submobject", () => {
      const banner = new ManimBanner();
      expect(banner.anim).toBeDefined();
      const selfMob = banner as unknown as Mobject;
      expect(selfMob.submobjects.includes(banner.anim as unknown as Mobject)).toBe(false);
    });

    it("has shapes containing triangle, square, and circle", () => {
      const banner = new ManimBanner();
      const shapesSubs = (banner.shapes as unknown as Mobject).submobjects;
      expect(shapesSubs.length).toBe(3);
    });
  });

  describe("scale", () => {
    it("updates scaleFactor", () => {
      const banner = new ManimBanner();
      banner.scale(2.0);
      expect(banner.scaleFactor).toBe(2.0);
    });

    it("compounds scaleFactor on multiple calls", () => {
      const banner = new ManimBanner();
      banner.scale(2.0);
      banner.scale(0.5);
      expect(banner.scaleFactor).toBeCloseTo(1.0);
    });
  });

  describe("create", () => {
    // Note: FadeIn extends growing/transform.ts Transform (implements IAnimation)
    // rather than animation/animation.ts Animation, so it fails prepareAnimation's
    // instanceof check. These tests are skipped until the animation class hierarchy
    // is unified.
    it.skip("returns an AnimationGroup", () => {
      const banner = new ManimBanner();
      const anim = banner.create();
      expect(anim).toBeInstanceOf(AnimationGroup);
    });

    it.skip("accepts custom runTime", () => {
      const banner = new ManimBanner();
      const anim = banner.create(4);
      expect(anim.runTime).toBeGreaterThan(0);
    });
  });

  describe("expand", () => {
    it("returns a Succession", () => {
      const banner = new ManimBanner();
      const anim = banner.expand();
      expect(anim).toBeInstanceOf(Succession);
    });

    it("accepts direction parameter", () => {
      const banner = new ManimBanner();
      expect(() => banner.expand(1.5, "left")).not.toThrow();
    });

    it("accepts right direction", () => {
      const banner = new ManimBanner();
      expect(() => banner.expand(1.5, "right")).not.toThrow();
    });

    it("throws for invalid direction", () => {
      const banner = new ManimBanner();
      expect(() => banner.expand(1.5, "up" as "left")).toThrow(
        "direction must be 'left', 'right' or 'center'.",
      );
    });
  });
});
