/**
 * Animation of a mobject boundary and tracing of points.
 *
 * TypeScript port of manim/animation/changing.py
 */

import type { RateFunc, Point3D } from "../../core/types.js";
import { smooth } from "../../core/math/index.js";
import { np } from "../../core/math/index.js";
import type { NDArray } from "numpy-ts";
import type { ParsableManimColor } from "../../utils/color/index.js";
import { ManimColor, BLUE_D, BLUE_B, BLUE_E, GREY_BROWN, WHITE } from "../../utils/color/index.js";
import { Mobject } from "../../mobject/mobject/index.js";

// ─── Duck-typing helpers for VMobject methods ──────────────

function hasMethod(obj: unknown, name: string): boolean {
  return typeof (obj as Record<string, unknown>)[name] === "function";
}

function isVMobjectLike(mob: Mobject): boolean {
  return (
    hasMethod(mob, "pointwiseBecomePartial") &&
    hasMethod(mob, "setStyle") &&
    hasMethod(mob, "setStroke")
  );
}

// ─── AnimatedBoundary ──────────────────────────────────────

export interface AnimatedBoundaryOptions {
  colors?: ParsableManimColor[];
  maxStrokeWidth?: number;
  cycleRate?: number;
  backAndForth?: boolean;
  drawRateFunc?: RateFunc;
  fadeRateFunc?: RateFunc;
  color?: ParsableManimColor;
  name?: string;
  zIndex?: number;
}

/**
 * Boundary of a VMobject with animated color change.
 *
 * Extends Mobject (acting as a VGroup-like container) to hold two
 * boundary copies of the target VMobject that animate a growing/fading
 * colored stroke effect.
 */
export class AnimatedBoundary extends Mobject {
  colors: ManimColor[];
  maxStrokeWidth: number;
  cycleRate: number;
  backAndForth: boolean;
  drawRateFunc: RateFunc;
  fadeRateFunc: RateFunc;
  vmobject: Mobject;
  boundaryCopies: [Mobject, Mobject];
  totalTime: number;

  constructor(vmobject: Mobject, options: AnimatedBoundaryOptions = {}) {
    super({
      color: options.color != null
        ? ManimColor.parse(options.color) as ManimColor
        : undefined,
      name: options.name,
      zIndex: options.zIndex,
    });

    if (!isVMobjectLike(vmobject)) {
      throw new TypeError("AnimatedBoundary only works for VMobjects.");
    }

    const defaultColors: ManimColor[] = [BLUE_D, BLUE_B, BLUE_E, GREY_BROWN];
    this.colors = options.colors
      ? options.colors.map((c) => ManimColor.parse(c) as ManimColor)
      : defaultColors;
    this.maxStrokeWidth = options.maxStrokeWidth ?? 3;
    this.cycleRate = options.cycleRate ?? 0.5;
    this.backAndForth = options.backAndForth ?? true;
    this.drawRateFunc = options.drawRateFunc ?? smooth;
    this.fadeRateFunc = options.fadeRateFunc ?? smooth;
    this.vmobject = vmobject;

    const copy1 = vmobject.copy() as Mobject;
    const copy2 = vmobject.copy() as Mobject;
    if (hasMethod(copy1, "setStyle")) {
      (copy1 as unknown as { setStyle(o: Record<string, unknown>): void }).setStyle({
        strokeWidth: 0,
        fillOpacity: 0,
      });
    }
    if (hasMethod(copy2, "setStyle")) {
      (copy2 as unknown as { setStyle(o: Record<string, unknown>): void }).setStyle({
        strokeWidth: 0,
        fillOpacity: 0,
      });
    }
    this.boundaryCopies = [copy1, copy2];
    this.add(...this.boundaryCopies);

    this.totalTime = 0.0;
    this.addUpdater((_m: Mobject, dt: number) => this.updateBoundaryCopies(dt));
  }

  updateBoundaryCopies(dt: number): void {
    // Not actual time, but something which passes at
    // an altered rate to make the implementation below cleaner
    const time = this.totalTime * this.cycleRate;
    const [growing, fading] = this.boundaryCopies;
    const colors = this.colors;
    const msw = this.maxStrokeWidth;
    const vmobject = this.vmobject;

    const index = Math.floor(time) % colors.length;
    const alpha = time % 1;
    const drawAlpha = this.drawRateFunc(alpha);
    const fadeAlpha = this.fadeRateFunc(alpha);

    let bounds: [number, number];
    if (this.backAndForth && Math.floor(time) % 2 === 1) {
      bounds = [1.0 - drawAlpha, 1.0];
    } else {
      bounds = [0.0, drawAlpha];
    }

    this.fullFamilyBecomePartial(growing, vmobject, bounds[0], bounds[1]);
    if (hasMethod(growing, "setStroke")) {
      (growing as unknown as { setStroke(c: ManimColor, w: number): void }).setStroke(
        colors[index],
        msw,
      );
    }

    if (time >= 1) {
      this.fullFamilyBecomePartial(fading, vmobject, 0, 1);
      const prevIndex = ((index - 1) % colors.length + colors.length) % colors.length;
      if (hasMethod(fading, "setStroke")) {
        (fading as unknown as { setStroke(c: ManimColor, w: number): void }).setStroke(
          colors[prevIndex],
          (1 - fadeAlpha) * msw,
        );
      }
    }

    this.totalTime += dt;
  }

  fullFamilyBecomePartial(
    mob1: Mobject,
    mob2: Mobject,
    a: number,
    b: number,
  ): this {
    const family1 = mob1.familyMembersWithPoints();
    const family2 = mob2.familyMembersWithPoints();
    const len = Math.min(family1.length, family2.length);
    for (let i = 0; i < len; i++) {
      if (hasMethod(family1[i], "pointwiseBecomePartial")) {
        (family1[i] as unknown as { pointwiseBecomePartial(o: Mobject, a: number, b: number): void })
          .pointwiseBecomePartial(family2[i], a, b);
      }
    }
    return this;
  }
}

// ─── TracedPath ────────────────────────────────────────────

export interface TracedPathOptions {
  strokeWidth?: number;
  strokeColor?: ParsableManimColor;
  dissipatingTime?: number | null;
  strokeOpacity?: number | number[];
  color?: ParsableManimColor;
  name?: string;
}

/**
 * Traces the path of a point returned by a function call.
 *
 * Extends Mobject to act as a VMobject-like traced path. Uses an updater
 * to continuously append new points from the traced function.
 */
export class TracedPath extends Mobject {
  tracedPointFunc: () => Point3D;
  dissipatingTime: number | null;
  time: number | null;

  constructor(
    tracedPointFunc: () => Point3D,
    options: TracedPathOptions = {},
  ) {
    super({
      color: options.strokeColor != null
        ? ManimColor.parse(options.strokeColor) as ManimColor
        : options.color != null
          ? ManimColor.parse(options.color) as ManimColor
          : ManimColor.parse(WHITE) as ManimColor,
      name: options.name,
    });

    // Apply stroke properties if this is VMobject-like
    if (hasMethod(this, "setStroke")) {
      (this as unknown as { setStroke(c: ParsableManimColor, w: number): void }).setStroke(
        options.strokeColor ?? WHITE,
        options.strokeWidth ?? 2,
      );
    }

    this.tracedPointFunc = tracedPointFunc;
    this.dissipatingTime = options.dissipatingTime ?? null;
    this.time = this.dissipatingTime != null ? 1.0 : null;
    this.addUpdater((mob: Mobject, dt: number) => this.updatePath(mob, dt));
  }

  updatePath(mob: Mobject, dt: number): void {
    const newPoint = this.tracedPointFunc();

    const hasPts = mob.getNumPoints() > 0;

    if (!hasPts) {
      if (hasMethod(mob, "startNewPath")) {
        (mob as unknown as { startNewPath(p: Point3D): void }).startNewPath(newPoint);
      } else {
        mob.points = np.array([(newPoint as NDArray).toArray()]);
      }
    }

    if (hasMethod(mob, "addLineTo")) {
      (mob as unknown as { addLineTo(p: Point3D): void }).addLineTo(newPoint);
    } else {
      // Fallback: append point directly
      const ptArr = (newPoint as NDArray).toArray() as number[];
      const current = mob.points;
      if (current.shape[0] === 0) {
        mob.points = np.array([ptArr]);
      } else {
        mob.points = np.vstack([current, np.array([ptArr])]);
      }
    }

    if (this.dissipatingTime != null) {
      this.time! += dt;
      if (this.time! - 1 > this.dissipatingTime) {
        const nppcc = (mob as unknown as { nPointsPerCurve?: number }).nPointsPerCurve ?? 4;
        const numPts = mob.points.shape[0];
        if (numPts > nppcc) {
          const remaining = mob.points.toArray() as number[][];
          mob.points = np.array(remaining.slice(nppcc));
        }
      }
    }
  }
}
