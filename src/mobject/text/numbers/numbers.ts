/**
 * Mobjects representing numbers.
 *
 * TypeScript port of manim/mobject/text/numbers.py
 */

import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  DEFAULT_FONT_SIZE,
  RendererType,
} from "../../../constants/constants.js";
import { config } from "../../../_config/index.js";
import {
  ManimColor,
  type ParsableManimColor,
} from "../../../utils/color/core.js";
import { Mobject } from "../../mobject/index.js";
import {
  SVGMobject,
  type SVGMobjectOptions,
} from "../../svg/svg_mobject.js";
import {
  SingleStringMathTex,
  MathTex,
  Tex,
} from "../tex_mobject/index.js";
import type {
  SingleStringMathTexOptions,
} from "../tex_mobject/index.js";
import { Text } from "../text_mobject/index.js";
import { ValueTracker } from "../../value_tracker/index.js";

// ─── Dependency stubs ───────────────────────────────────────
// These mirror the stubs used in tex_mobject.ts.
// Replace with real imports once the respective modules are fully converted.

// VMobject stub
// TODO: Replace with import from ../../types/vectorized_mobject/index.js once converted
class VMobject extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  declare strokeWidth: number;

  constructor(
    options: {
      color?: ParsableManimColor | null;
      name?: string;
      fillColor?: ParsableManimColor | null;
      fillOpacity?: number;
      strokeColor?: ParsableManimColor | null;
      strokeOpacity?: number;
      strokeWidth?: number;
    } = {},
  ) {
    super({
      color: options.color ?? undefined,
      name: options.name,
    });
    this.fillColor = options.fillColor
      ? (ManimColor.parse(options.fillColor) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);
    this.fillOpacity = options.fillOpacity ?? 0.0;
    this.strokeColor = options.strokeColor
      ? (ManimColor.parse(options.strokeColor) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);
    this.strokeOpacity = options.strokeOpacity ?? 1.0;
    this.strokeWidth = options.strokeWidth ?? 4;
  }

  setFill(color?: ParsableManimColor, opacity?: number): this {
    if (color !== undefined) {
      this.fillColor = ManimColor.parse(color) as ManimColor;
    }
    if (opacity !== undefined) {
      this.fillOpacity = opacity;
    }
    return this;
  }
}

// ─── Module-level cache ────────────────────────────────────

const stringToMobMap: Map<string, SingleStringMathTex> = new Map();

// ─── Options interfaces ────────────────────────────────────

export interface DecimalNumberOptions {
  number?: number;
  numDecimalPlaces?: number;
  mobClass?: typeof SingleStringMathTex | typeof MathTex;
  includeSign?: boolean;
  groupWithCommas?: boolean;
  digitBuffPerFontUnit?: number;
  showEllipsis?: boolean;
  unit?: string | null;
  unitBuffPerFontUnit?: number;
  includeBackgroundRectangle?: boolean;
  edgeToFix?: Point3D;
  fontSize?: number;
  strokeWidth?: number;
  fillOpacity?: number;
  color?: ParsableManimColor | null;
  name?: string;
}

export interface IntegerOptions extends DecimalNumberOptions {
}

export interface VariableOptions {
  color?: ParsableManimColor | null;
  name?: string;
}

// ─── DecimalNumber ─────────────────────────────────────────

/**
 * A mobject representing a decimal number.
 *
 * The numeric value can be modified using {@link setValue}.
 */
export class DecimalNumber extends VMobject {
  number: number;
  numDecimalPlaces: number;
  includeSign: boolean;
  mobClass: typeof SingleStringMathTex | typeof MathTex;
  groupWithCommas: boolean;
  digitBuffPerFontUnit: number;
  showEllipsis: boolean;
  unit: string | null;
  unitBuffPerFontUnit: number;
  includeBackgroundRectangle: boolean;
  edgeToFix: Point3D;
  _fontSize: number;
  initialHeight: number;
  unitSign?: Mobject;

  private initialConfig: DecimalNumberOptions;

  constructor(options: DecimalNumberOptions = {}) {
    const {
      number: num = 0,
      numDecimalPlaces = 2,
      mobClass = MathTex,
      includeSign = false,
      groupWithCommas = true,
      digitBuffPerFontUnit = 0.001,
      showEllipsis = false,
      unit = null,
      unitBuffPerFontUnit = 0,
      includeBackgroundRectangle = false,
      edgeToFix = LEFT as Point3D,
      fontSize = DEFAULT_FONT_SIZE,
      strokeWidth = 0,
      fillOpacity = 1.0,
      color,
      name,
    } = options;

    super({ fillOpacity, strokeWidth, color, name });

    this.number = num;
    this.numDecimalPlaces = numDecimalPlaces;
    this.includeSign = includeSign;
    this.mobClass = mobClass;
    this.groupWithCommas = groupWithCommas;
    this.digitBuffPerFontUnit = digitBuffPerFontUnit;
    this.showEllipsis = showEllipsis;
    this.unit = unit;
    this.unitBuffPerFontUnit = unitBuffPerFontUnit;
    this.includeBackgroundRectangle = includeBackgroundRectangle;
    this.edgeToFix = edgeToFix;
    this._fontSize = fontSize;
    this.fillOpacity = fillOpacity;
    this.initialHeight = 0;

    this.initialConfig = {
      numDecimalPlaces,
      includeSign,
      groupWithCommas,
      digitBuffPerFontUnit,
      showEllipsis,
      unit,
      unitBuffPerFontUnit,
      includeBackgroundRectangle,
      edgeToFix,
      fontSize,
      strokeWidth,
      fillOpacity,
    };

    this._setSubmobjectsFromNumber(num);
    this.initColors();
  }

  get fontSize(): number {
    if (this.initialHeight === 0) return this._fontSize;
    return (this.height / this.initialHeight) * this._fontSize;
  }

  set fontSize(fontVal: number) {
    if (fontVal <= 0) {
      throw new Error("font_size must be greater than 0.");
    } else if (this.height > 0) {
      // Scale to a factor of the initial height so that setting
      // font_size does not depend on current size.
      this.scale(fontVal / this.fontSize);
    }
  }

  _setSubmobjectsFromNumber(number: number): void {
    this.number = number;
    this.submobjects = [];

    const numString = this._getNumString(number);
    for (const ch of numString) {
      this.add(this._stringToMob(ch));
    }

    // Add non-numerical bits
    if (this.showEllipsis) {
      this.add(
        this._stringToMob("\\dots", SingleStringMathTex),
      );
    }

    this.arrange(
      RIGHT as Point3D,
      this.digitBuffPerFontUnit * this._fontSize,
      true,
    );

    if (this.unit !== null) {
      this.unitSign = this._stringToMob(this.unit, SingleStringMathTex);
      this.unitSign.nextTo(
        this,
        RIGHT as Point3D,
        {
          buff: (this.unitBuffPerFontUnit + this.digitBuffPerFontUnit) * this._fontSize,
          alignedEdge: DOWN as Point3D,
        },
      );
      this.add(this.unitSign);
    }

    this.moveTo(ORIGIN as Point3D);

    // Handle alignment of parts that should be aligned to the bottom
    const chars = [...numString];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === "-" && chars.length > i + 1) {
        this.submobjects[i].alignTo(this.submobjects[i + 1], UP as Point3D);
        this.submobjects[i].shift(
          np.array([0, -this.submobjects[i + 1].height / 2, 0]) as Point3D,
        );
      } else if (c === ",") {
        this.submobjects[i].shift(
          np.array([0, -this.submobjects[i].height / 2, 0]) as Point3D,
        );
      }
    }
    if (this.unit && this.unit.startsWith("^")) {
      this.unitSign!.alignTo(this, UP as Point3D);
    }

    // Track initial height for fontSize scaling
    this.initialHeight = this.height;

    if (this.includeBackgroundRectangle) {
      this.addBackgroundRectangle();
    }
  }

  _getNumString(number: number | { real: number; imag: number }): string {
    if (typeof number === "object" && "real" in number && "imag" in number) {
      return this._formatComplex(number);
    }
    const formatter = this._getFormatter();
    let numString = this._formatNumber(number, formatter);

    const rounded = Math.round(number * Math.pow(10, this.numDecimalPlaces)) /
      Math.pow(10, this.numDecimalPlaces);
    if (numString.startsWith("-") && rounded === 0) {
      numString = this.includeSign
        ? "+" + numString.slice(1)
        : numString.slice(1);
    }

    return numString;
  }

  private _formatNumber(
    number: number,
    formatter: { includeSign: boolean; groupWithCommas: boolean; numDecimalPlaces: number },
  ): string {
    const sign = formatter.includeSign && number >= 0 ? "+" : "";
    const fixed = number.toFixed(formatter.numDecimalPlaces);
    let result: string;

    if (formatter.groupWithCommas) {
      const parts = fixed.split(".");
      const intPart = parts[0].replace(/^[-+]/, "");
      const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const prefix = fixed.startsWith("-") ? "-" : "";
      result = parts.length > 1
        ? `${prefix}${grouped}.${parts[1]}`
        : `${prefix}${grouped}`;
    } else {
      result = fixed;
    }

    return sign + result;
  }

  private _formatComplex(
    number: { real: number; imag: number },
  ): string {
    const realFormatter = this._getFormatter();
    const imagFormatter = this._getFormatter({ includeSign: true });
    const realPart = this._formatNumber(number.real, realFormatter);
    const imagPart = this._formatNumber(number.imag, imagFormatter);
    return `${realPart}${imagPart}i`;
  }

  _stringToMob(
    str: string,
    mobClass?: typeof SingleStringMathTex | typeof MathTex,
  ): Mobject {
    const cls = mobClass ?? this.mobClass;

    if (!stringToMobMap.has(str)) {
      stringToMobMap.set(str, new (cls as typeof SingleStringMathTex)(str));
    }
    const mob = stringToMobMap.get(str)!.copy() as SingleStringMathTex;
    mob.fontSize = this._fontSize;
    return mob;
  }

  _getFormatter(
    overrides: {
      includeSign?: boolean;
      groupWithCommas?: boolean;
      numDecimalPlaces?: number;
    } = {},
  ): { includeSign: boolean; groupWithCommas: boolean; numDecimalPlaces: number } {
    return {
      includeSign: overrides.includeSign ?? this.includeSign,
      groupWithCommas: overrides.groupWithCommas ?? this.groupWithCommas,
      numDecimalPlaces: overrides.numDecimalPlaces ?? this.numDecimalPlaces,
    };
  }

  /**
   * Set the value of the DecimalNumber to a new number.
   */
  setValue(number: number): this {
    const oldFamily = this.getFamily();
    const oldFontSize = this.fontSize;
    const moveToPoint = this.getEdgeCenter(this.edgeToFix);
    const oldSubmobjects = [...this.submobjects];

    this._setSubmobjectsFromNumber(number);
    this.fontSize = oldFontSize;
    this.moveTo(moveToPoint, this.edgeToFix);

    // Match styles between corresponding submobjects
    const minLen = Math.min(this.submobjects.length, oldSubmobjects.length);
    for (let i = 0; i < minLen; i++) {
      // Copy color from old submobject
      this.submobjects[i].setColor(oldSubmobjects[i].color);
    }

    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // In Cairo renderer, zero out old family points for updater compatibility
    if (config.renderer === RendererType.CAIRO) {
      for (const mob of oldFamily) {
        if (mob.points && mob.points.shape[0] > 0) {
          // Zero out points for scene family handling compatibility
          const shape = mob.points.shape as number[];
          mob.points = np.zeros(shape);
        }
      }
    }

    this.initColors();
    return this;
  }

  getValue(): number {
    return this.number;
  }

  incrementValue(deltaT: number = 1): void {
    this.setValue(this.getValue() + deltaT);
  }
}

// ─── Integer ───────────────────────────────────────────────

/**
 * A class for displaying Integers.
 */
export class Integer extends DecimalNumber {
  constructor(options: IntegerOptions = {}) {
    const { numDecimalPlaces = 0, ...rest } = options;
    super({ numDecimalPlaces, ...rest });
  }

  getValue(): number {
    return Math.round(super.getValue());
  }
}

// ─── Variable ──────────────────────────────────────────────

/**
 * A class for displaying text that shows "label = value" with
 * the value continuously updated from a ValueTracker.
 */
export class Variable extends VMobject {
  label: Mobject;
  tracker: ValueTracker;
  value: DecimalNumber | Integer;

  constructor(
    varValue: number,
    label: string | Tex | MathTex | Text | SingleStringMathTex,
    options: {
      varType?: typeof DecimalNumber | typeof Integer;
      numDecimalPlaces?: number;
    } & VariableOptions = {},
  ) {
    const {
      varType = DecimalNumber,
      numDecimalPlaces = 2,
      ...vmobjectOptions
    } = options;

    // Create label
    const labelMob = typeof label === "string"
      ? new MathTex([label])
      : label;

    // Create equals sign and attach to label
    const equals = new MathTex(["="]);
    equals.nextTo(labelMob, RIGHT as Point3D);
    labelMob.add(equals);

    // Create tracker
    const tracker = new ValueTracker({ value: varValue });

    // Create value display
    let valueMob: DecimalNumber | Integer;
    if (varType === Integer) {
      valueMob = new Integer({ number: tracker.getValue() });
    } else {
      valueMob = new DecimalNumber({
        number: tracker.getValue(),
        numDecimalPlaces,
      });
    }

    // Add updater to value and position it
    valueMob.addUpdater(
      (v: Mobject) => (v as DecimalNumber).setValue(tracker.getValue()),
    );
    valueMob.nextTo(labelMob, RIGHT as Point3D);

    super(vmobjectOptions);

    this.label = labelMob;
    this.tracker = tracker;
    this.value = valueMob;
    this.add(this.label, this.value);
  }
}
