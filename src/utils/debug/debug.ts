/**
 * Debugging utilities.
 *
 * TypeScript port of manim/utils/debug.py
 */

import { Mobject, type MobjectConstructorOptions } from "../../mobject/mobject/index.js";
import { ManimColor } from "../color/core.js";
import { BLACK } from "../color/manim_colors.js";
// ── Dependency stubs ────────────────────────────────────────
// Integer and VGroup are not yet converted. Minimal stubs for this module.

class VMobjectStub extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  strokeWidth: number;

  constructor(options: MobjectConstructorOptions = {}) {
    super(options);
    this.fillColor = ManimColor.fromHex("#FFFFFF");
    this.fillOpacity = 0.0;
    this.strokeColor = ManimColor.fromHex("#FFFFFF");
    this.strokeOpacity = 1.0;
    this.strokeWidth = 4.0;
  }

  setStroke(
    color?: ManimColor,
    width?: number,
    opacity?: number,
    options?: { background?: boolean },
  ): this {
    if (options?.background) {
      // Background stroke stub — real implementation in VMobject
    } else {
      if (color !== undefined) this.strokeColor = color;
      if (width !== undefined) this.strokeWidth = width;
      if (opacity !== undefined) this.strokeOpacity = opacity;
    }
    return this;
  }
}

class VGroupStub extends VMobjectStub {
  override add(...mobjects: Mobject[]): this {
    for (const m of mobjects) {
      this.submobjects.push(m);
    }
    return this;
  }
}

class IntegerStub extends VMobjectStub {
  private _number: number;

  constructor(number: number, options: MobjectConstructorOptions = {}) {
    super(options);
    this._number = number;
    this.name = `Integer(${number})`;
  }

  getNumber(): number {
    return this._number;
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * For debugging purposes — recursively prints a mobject and its submobjects
 * with indentation showing the hierarchy.
 */
export function printFamily(mobject: Mobject, nTabs: number = 0): void {
  console.log("\t".repeat(nTabs), mobject.toString(), mobject.name);
  for (const submob of mobject.submobjects) {
    printFamily(submob as Mobject, nTabs + 1);
  }
}

export interface IndexLabelsOptions {
  labelHeight?: number;
  backgroundStrokeWidth?: number;
  backgroundStrokeColor?: ManimColor;
}

/**
 * Returns a VGroup of Integer mobjects that shows the index of each submobject.
 *
 * Useful for working with parts of complicated mobjects.
 *
 * @param mobject - The mobject that will have its submobjects labelled.
 * @param options - Configuration options.
 * @param options.labelHeight - The height of the labels, by default 0.15.
 * @param options.backgroundStrokeWidth - The stroke width of the outline of the labels, by default 5.
 * @param options.backgroundStrokeColor - The stroke color of the outline of labels, by default BLACK.
 */
export function indexLabels(
  mobject: Mobject,
  options: IndexLabelsOptions = {},
): Mobject {
  const {
    labelHeight = 0.15,
    backgroundStrokeWidth = 5,
    backgroundStrokeColor = BLACK,
  } = options;

  const labels = new VGroupStub();

  for (let n = 0; n < mobject.submobjects.length; n++) {
    const submob = mobject.submobjects[n];
    const label = new IntegerStub(n);
    label.setStroke(backgroundStrokeColor, backgroundStrokeWidth, undefined, {
      background: true,
    });
    label.height = labelHeight;
    label.moveTo(submob.getCenter());
    labels.add(label);
  }

  return labels;
}
