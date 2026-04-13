/**
 * Mobjects representing matrices.
 *
 * TypeScript port of manim/mobject/matrix.py
 */

import type { NDArray } from "numpy-ts";

import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import {
  DOWN,
  RIGHT,
  LEFT,
  DR,
  MED_SMALL_BUFF,
} from "../../constants/constants.js";
import {
  ManimColor,
  type ParsableManimColor,
} from "../../utils/color/core.js";
import { Mobject, type MobjectConstructorOptions } from "../mobject/index.js";

// ─── Dependency stubs ────────────────────────────────────────
// These classes are not yet converted. We define minimal local stubs
// so this module compiles. Replace with real imports once the
// respective modules land.

// VMobject stub — extends Mobject with vectorized mobject fields
// TODO: Replace with import from ../types/vectorized_mobject/index.js once converted
interface VMobjectStubOptions extends MobjectConstructorOptions {
  fillColor?: ParsableManimColor | null;
  fillOpacity?: number;
  strokeColor?: ParsableManimColor | null;
  strokeOpacity?: number;
  strokeWidth?: number;
}

class VMobject extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  declare strokeWidth: number;

  constructor(options: VMobjectStubOptions = {}) {
    super({
      color: options.color ?? undefined,
      name: options.name,
      zIndex: options.zIndex,
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
}

// VGroup stub
// TODO: Replace with import from ../types/vectorized_mobject/index.js once converted
class VGroup extends VMobject {
  constructor(...vmobjects: VMobject[]) {
    super();
    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }
  }
}

// MathTex stub — minimal placeholder for tex rendering
// TODO: Replace with import from ../text/tex_mobject/index.js once converted
class MathTex extends VMobject {
  texString: string;

  constructor(texString: string, _options: Record<string, unknown> = {}) {
    super();
    this.texString = texString;
  }

  scale(factor: number, options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this {
    return super.scale(factor, options);
  }

  stretchToFitHeight(
    h: number,
    options: { aboutPoint?: Point3D; aboutEdge?: Point3D } = {},
  ): this {
    return super.stretchToFitHeight(h, options);
  }
}

// Tex stub — minimal placeholder for text rendering
// TODO: Replace with import from ../text/tex_mobject/index.js once converted
class Tex extends VMobject {
  texString: string;

  constructor(texString: string, _options: Record<string, unknown> = {}) {
    super();
    this.texString = texString;
  }
}

// DecimalNumber stub — minimal placeholder for decimal display
// TODO: Replace with import from ../text/numbers/index.js once converted
class DecimalNumber extends VMobject {
  number: number;
  numDecimalPlaces: number;

  constructor(
    number: number,
    options: { numDecimalPlaces?: number } & VMobjectStubOptions = {},
  ) {
    super(options);
    this.number = number;
    this.numDecimalPlaces = options.numDecimalPlaces ?? 1;
  }
}

// Integer stub — minimal placeholder for integer display
// TODO: Replace with import from ../text/numbers/index.js once converted
class Integer extends VMobject {
  number: number;

  constructor(number: number, options: VMobjectStubOptions = {}) {
    super(options);
    this.number = Math.round(number);
  }
}

// ─── Helper functions ────────────────────────────────────────

/**
 * Convert a numpy-style matrix to a TeX array string.
 *
 * @param matrix - A 2D array or 1D array (treated as column vector)
 * @returns LaTeX string for the matrix
 */
export function matrixToTexString(matrix: number[][] | string[][] | NDArray): string {
  let rows: string[][];

  if ("shape" in matrix && typeof (matrix as NDArray).toArray === "function") {
    const arr = (matrix as NDArray).toArray() as number[] | number[][];
    if (!Array.isArray(arr[0])) {
      // 1D → column vector
      rows = (arr as number[]).map((v) => [String(v)]);
    } else {
      rows = (arr as number[][]).map((row) => row.map(String));
    }
  } else {
    const m = matrix as (number | string)[][];
    if (!Array.isArray(m[0])) {
      rows = (m as unknown as (number | string)[]).map((v) => [String(v)]);
    } else {
      rows = m.map((row) => row.map(String));
    }
  }

  const nCols = rows[0].length;
  const prefix = `\\left[ \\begin{array}{${"c".repeat(nCols)}}`;
  const suffix = "\\end{array} \\right]";
  const rowStrings = rows.map((row) => row.join(" & "));
  return prefix + rowStrings.join(" \\\\ ") + suffix;
}

/**
 * Convert a numpy-style matrix to a MathTex mobject.
 *
 * @param matrix - A 2D array or NDArray
 * @returns MathTex mobject displaying the matrix
 */
export function matrixToMobject(matrix: number[][] | string[][] | NDArray): MathTex {
  return new MathTex(matrixToTexString(matrix));
}

// ─── Matrix options ──────────────────────────────────────────

export interface MatrixOptions extends VMobjectStubOptions {
  vBuff?: number;
  hBuff?: number;
  bracketHBuff?: number;
  bracketVBuff?: number;
  addBackgroundRectanglesToEntries?: boolean;
  includeBackgroundRectangle?: boolean;
  elementToMobject?: (item: unknown, ...args: unknown[]) => VMobject;
  elementToMobjectConfig?: Record<string, unknown>;
  elementAlignmentCorner?: Point3D;
  leftBracket?: string;
  rightBracket?: string;
  stretchBrackets?: boolean;
  bracketConfig?: Record<string, unknown>;
}

// ─── Matrix class ────────────────────────────────────────────

/**
 * A mobject that displays a matrix on the screen.
 *
 * Python: manim.mobject.matrix.Matrix
 */
export class Matrix extends VMobject {
  vBuff: number;
  hBuff: number;
  bracketHBuff: number;
  bracketVBuff: number;
  addBackgroundRectanglesToEntries: boolean;
  includeBackgroundRectangle: boolean;
  elementToMobject: (item: unknown, ...args: unknown[]) => VMobject;
  elementToMobjectConfig: Record<string, unknown>;
  elementAlignmentCorner: Point3D;
  leftBracket: string;
  rightBracket: string;
  stretchBrackets: boolean;
  elements: VGroup;
  brackets: VGroup;
  mobMatrix: VMobject[][];

  constructor(
    matrix: Iterable<Iterable<unknown>>,
    options: MatrixOptions = {},
  ) {
    const defaultElementToMobject = (item: unknown, ...args: unknown[]) => {
      const opts = (args[0] ?? {}) as Record<string, unknown>;
      return new MathTex(String(item), opts);
    };
    const {
      vBuff = 0.8,
      hBuff = 1.3,
      bracketHBuff = MED_SMALL_BUFF,
      bracketVBuff = MED_SMALL_BUFF,
      addBackgroundRectanglesToEntries = false,
      includeBackgroundRectangle = false,
      elementToMobject = defaultElementToMobject,
      elementToMobjectConfig = {},
      elementAlignmentCorner = DR,
      leftBracket = "[",
      rightBracket = "]",
      stretchBrackets = true,
      bracketConfig = {},
      ...vmobjectOptions
    } = options;

    super(vmobjectOptions);

    this.vBuff = vBuff;
    this.hBuff = hBuff;
    this.bracketHBuff = bracketHBuff;
    this.bracketVBuff = bracketVBuff;
    this.addBackgroundRectanglesToEntries = addBackgroundRectanglesToEntries;
    this.includeBackgroundRectangle = includeBackgroundRectangle;
    this.elementToMobject = elementToMobject;
    this.elementToMobjectConfig = elementToMobjectConfig;
    this.elementAlignmentCorner = elementAlignmentCorner;
    this.leftBracket = leftBracket;
    this.rightBracket = rightBracket;
    this.stretchBrackets = stretchBrackets;

    const mobMatrix = this._matrixToMobMatrix(matrix);
    this._organizeMobMatrix(mobMatrix);

    // Flatten mob_matrix into elements VGroup
    const flatElements: VMobject[] = [];
    for (const row of mobMatrix) {
      for (const mob of row) {
        flatElements.push(mob);
      }
    }
    this.elements = new VGroup(...flatElements);
    this.add(this.elements);

    this.brackets = new VGroup();
    this._addBrackets(this.leftBracket, this.rightBracket, bracketConfig);

    this.center();
    this.mobMatrix = mobMatrix;

    if (this.addBackgroundRectanglesToEntries) {
      for (const mob of flatElements) {
        mob.addBackgroundRectangle();
      }
    }
    if (this.includeBackgroundRectangle) {
      this.addBackgroundRectangle();
    }
  }

  protected _matrixToMobMatrix(
    matrix: Iterable<Iterable<unknown>>,
  ): VMobject[][] {
    const result: VMobject[][] = [];
    for (const row of matrix) {
      const mobRow: VMobject[] = [];
      for (const item of row) {
        mobRow.push(this.elementToMobject(item, this.elementToMobjectConfig));
      }
      result.push(mobRow);
    }
    return result;
  }

  protected _organizeMobMatrix(matrix: VMobject[][]): this {
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[i].length; j++) {
        const mob = matrix[i][j];
        // Position: i * v_buff * DOWN + j * h_buff * RIGHT
        const pos = (DOWN as NDArray)
          .multiply(i * this.vBuff)
          .add((RIGHT as NDArray).multiply(j * this.hBuff)) as Point3D;
        mob.moveTo(pos, this.elementAlignmentCorner);
      }
    }
    return this;
  }

  protected _addBrackets(
    left: string = "[",
    right: string = "]",
    kwargs: Record<string, unknown> = {},
  ): this {
    // Height per row of LaTeX array with default settings
    const BRACKET_HEIGHT = 0.5977;

    const n = Math.floor(this.height / BRACKET_HEIGHT) + 1;
    const emptyTexArray = [
      "\\begin{array}{c}",
      ...Array.from({ length: n }, () => "\\quad \\\\"),
      "\\end{array}",
    ].join("");

    const texLeft = [
      "\\left" + left,
      emptyTexArray,
      "\\right.",
    ].join("");

    const texRight = [
      "\\left.",
      emptyTexArray,
      "\\right" + right,
    ].join("");

    const lBracket = new MathTex(texLeft, kwargs);
    const rBracket = new MathTex(texRight, kwargs);

    const bracketPair = new VGroup(lBracket, rBracket);
    if (this.stretchBrackets) {
      bracketPair.stretchToFitHeight(this.height + 2 * this.bracketVBuff);
    }
    lBracket.nextTo(this, LEFT, { buff: this.bracketHBuff });
    rBracket.nextTo(this, RIGHT, { buff: this.bracketHBuff });
    this.brackets = bracketPair;
    this.add(lBracket, rBracket);
    return this;
  }

  /**
   * Return columns of the matrix as VGroups.
   */
  getColumns(): VGroup {
    const numCols = this.mobMatrix[0]?.length ?? 0;
    const columns: VGroup[] = [];
    for (let j = 0; j < numCols; j++) {
      const colMobs: VMobject[] = [];
      for (const row of this.mobMatrix) {
        colMobs.push(row[j]);
      }
      columns.push(new VGroup(...colMobs));
    }
    return new VGroup(...columns);
  }

  /**
   * Set individual colors for each column of the matrix.
   *
   * @param colors - The list of colors; each color corresponds to a column.
   */
  setColumnColors(...colors: ParsableManimColor[]): this {
    const columns = this.getColumns();
    const colSubmobs = columns.submobjects;
    for (let i = 0; i < Math.min(colors.length, colSubmobs.length); i++) {
      colSubmobs[i].setColor(colors[i]);
    }
    return this;
  }

  /**
   * Return rows of the matrix as VGroups.
   */
  getRows(): VGroup {
    const rows: VGroup[] = [];
    for (const row of this.mobMatrix) {
      rows.push(new VGroup(...row));
    }
    return new VGroup(...rows);
  }

  /**
   * Set individual colors for each row of the matrix.
   *
   * @param colors - The list of colors; each color corresponds to a row.
   */
  setRowColors(...colors: ParsableManimColor[]): this {
    const rows = this.getRows();
    const rowSubmobs = rows.submobjects;
    for (let i = 0; i < Math.min(colors.length, rowSubmobs.length); i++) {
      rowSubmobs[i].setColor(colors[i]);
    }
    return this;
  }

  /**
   * Add a background rectangle to each entry.
   */
  addBackgroundToEntries(): this {
    for (const mob of this.getEntries().submobjects) {
      mob.addBackgroundRectangle();
    }
    return this;
  }

  /**
   * Return the underlying mob matrix.
   */
  getMobMatrix(): VMobject[][] {
    return this.mobMatrix;
  }

  /**
   * Return the individual entries of the matrix.
   */
  getEntries(): VGroup {
    return this.elements;
  }

  /**
   * Return the bracket mobjects.
   */
  getBrackets(): VGroup {
    return this.brackets;
  }
}

// ─── DecimalMatrix ───────────────────────────────────────────

export interface DecimalMatrixOptions extends MatrixOptions {
  // Inherits all MatrixOptions; defaults differ
}

/**
 * A mobject that displays a matrix with decimal entries on the screen.
 *
 * Python: manim.mobject.matrix.DecimalMatrix
 */
export class DecimalMatrix extends Matrix {
  constructor(
    matrix: Iterable<Iterable<unknown>>,
    options: DecimalMatrixOptions = {},
  ) {
    const defaultElementToMobject = (item: unknown, ...args: unknown[]) => {
      const opts = (args[0] ?? {}) as Record<string, unknown>;
      return new DecimalNumber(Number(item), {
        numDecimalPlaces: (opts.numDecimalPlaces as number) ?? 1,
        ...opts,
      });
    };
    const {
      elementToMobject = defaultElementToMobject,
      elementToMobjectConfig = { numDecimalPlaces: 1 },
      ...rest
    } = options;

    super(matrix, {
      elementToMobject,
      elementToMobjectConfig,
      ...rest,
    });
  }
}

// ─── IntegerMatrix ───────────────────────────────────────────

export interface IntegerMatrixOptions extends MatrixOptions {
  // Inherits all MatrixOptions; defaults differ
}

/**
 * A mobject that displays a matrix with integer entries on the screen.
 *
 * Python: manim.mobject.matrix.IntegerMatrix
 */
export class IntegerMatrix extends Matrix {
  constructor(
    matrix: Iterable<Iterable<unknown>>,
    options: IntegerMatrixOptions = {},
  ) {
    const defaultElementToMobject = (item: unknown, ..._args: unknown[]) =>
      new Integer(Number(item));
    const {
      elementToMobject = defaultElementToMobject,
      ...rest
    } = options;

    super(matrix, {
      elementToMobject,
      ...rest,
    });
  }
}

// ─── MobjectMatrix ──────────────────────────────────────────

export interface MobjectMatrixOptions extends MatrixOptions {
  // Inherits all MatrixOptions; defaults differ
}

/**
 * A mobject that displays a matrix of mobject entries on the screen.
 *
 * Python: manim.mobject.matrix.MobjectMatrix
 */
export class MobjectMatrix extends Matrix {
  constructor(
    matrix: Iterable<Iterable<unknown>>,
    options: MobjectMatrixOptions = {},
  ) {
    const defaultElementToMobject = (item: unknown, ..._args: unknown[]) =>
      item as VMobject;
    const {
      elementToMobject = defaultElementToMobject,
      ...rest
    } = options;

    super(matrix, {
      elementToMobject,
      ...rest,
    });
  }
}

// ─── get_det_text ────────────────────────────────────────────

/**
 * Helper function to create determinant text for a matrix.
 *
 * @param matrix - The matrix whose determinant is to be created
 * @param options - Configuration options
 * @returns A VGroup containing the determinant text
 */
export function getDetText(
  matrix: Matrix,
  options: {
    determinant?: number | string | null;
    backgroundRect?: boolean;
    initialScaleFactor?: number;
  } = {},
): VGroup {
  const {
    determinant = null,
    backgroundRect = false,
    initialScaleFactor = 2,
  } = options;

  const lParen = new MathTex("(");
  const rParen = new MathTex(")");
  lParen.scale(initialScaleFactor);
  rParen.scale(initialScaleFactor);
  lParen.stretchToFitHeight(matrix.height);
  rParen.stretchToFitHeight(matrix.height);

  lParen.nextTo(matrix, LEFT, { buff: 0.1 });
  rParen.nextTo(matrix, RIGHT, { buff: 0.1 });

  const det = new Tex("det");
  det.scale(initialScaleFactor);
  det.nextTo(lParen, LEFT, { buff: 0.1 });

  if (backgroundRect) {
    det.addBackgroundRectangle();
  }

  const detText = new VGroup(det, lParen, rParen);

  if (determinant != null) {
    const eq = new MathTex("=");
    eq.nextTo(rParen, RIGHT, { buff: 0.1 });
    const result = new MathTex(String(determinant));
    result.nextTo(eq, RIGHT, { buff: 0.2 });
    detText.add(eq, result);
  }

  return detText;
}
