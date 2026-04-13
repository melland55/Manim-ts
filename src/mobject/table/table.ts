/**
 * Mobjects representing tables.
 *
 * TypeScript port of manim/mobject/table.py
 */

import type { NDArray } from "numpy-ts";

import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import type { IVMobject, IAnimation } from "../../core/types.js";
import { Mobject } from "../mobject/index.js";
import type { MobjectConstructorOptions } from "../mobject/index.js";
import { ManimColor } from "../../utils/color/core.js";
import type { ParsableManimColor } from "../../utils/color/core.js";
import { BLACK, PURE_YELLOW } from "../../utils/color/manim_colors.js";

// ─── Dependency stubs for unconverted modules ─────────────────
// These will be replaced with real imports once the respective modules are converted.

class VMobject extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  strokeWidth: number;

  constructor(options: {
    fillColor?: ParsableManimColor;
    fillOpacity?: number;
    strokeColor?: ParsableManimColor;
    strokeOpacity?: number;
    strokeWidth?: number;
    color?: ParsableManimColor;
    name?: string;
    zIndex?: number;
  } = {}) {
    super({ color: options.color, name: options.name, zIndex: options.zIndex });
    this.fillColor = options.fillColor
      ? ManimColor.parse(options.fillColor) as ManimColor
      : new ManimColor("#FFFFFF");
    this.fillOpacity = options.fillOpacity ?? 0.0;
    this.strokeColor = options.strokeColor
      ? ManimColor.parse(options.strokeColor) as ManimColor
      : new ManimColor("#FFFFFF");
    this.strokeOpacity = options.strokeOpacity ?? 1.0;
    this.strokeWidth = options.strokeWidth ?? 4;
  }

  setFill(options?: { color?: ParsableManimColor; opacity?: number }): this {
    if (options?.color != null) {
      this.fillColor = ManimColor.parse(options.color) as ManimColor;
    }
    if (options?.opacity != null) {
      this.fillOpacity = options.opacity;
    }
    return this;
  }

  setStroke(options?: { color?: ParsableManimColor; width?: number; opacity?: number }): this {
    if (options?.color != null) {
      this.strokeColor = ManimColor.parse(options.color) as ManimColor;
    }
    if (options?.width != null) {
      this.strokeWidth = options.width;
    }
    if (options?.opacity != null) {
      this.strokeOpacity = options.opacity;
    }
    return this;
  }
}

class VGroup extends VMobject {
  constructor(...mobjects: Mobject[]) {
    super();
    this.add(...mobjects);
  }

  [Symbol.iterator](): Iterator<Mobject> {
    let index = 0;
    const subs = this.submobjects;
    return {
      next(): IteratorResult<Mobject> {
        if (index < subs.length) {
          return { value: subs[index++], done: false };
        }
        return { value: undefined as unknown as Mobject, done: true };
      },
    };
  }

  get length(): number {
    return this.submobjects.length;
  }

  at(index: number): Mobject | undefined {
    if (index < 0) index = this.submobjects.length + index;
    return this.submobjects[index];
  }
}

// Stub for Line (from geometry.line)
class Line extends VMobject {
  constructor(start: number[] | Point3D, end: number[] | Point3D, options: Record<string, unknown> = {}) {
    super(options as { color?: ParsableManimColor; strokeWidth?: number });
    const s = Array.isArray(start) ? np.array(start) : start as NDArray;
    const e = Array.isArray(end) ? np.array(end) : end as NDArray;
    this.points = np.vstack([s, e]);
    if (options.strokeWidth !== undefined) {
      this.strokeWidth = options.strokeWidth as number;
    }
    if (options.color !== undefined) {
      this.color = ManimColor.parse(options.color as ParsableManimColor) as ManimColor;
    }
    if (options.stroke_width !== undefined) {
      this.strokeWidth = options.stroke_width as number;
    }
  }
}

// Stub for Polygon (from geometry.polygram)
class Polygon extends VMobject {
  constructor(...args: (number[] | Point3D | Record<string, unknown>)[]) {
    const lastArg = args[args.length - 1];
    let options: Record<string, unknown> = {};
    let vertices: (number[] | Point3D)[];
    if (lastArg && typeof lastArg === "object" && !Array.isArray(lastArg) && !("shape" in (lastArg as object))) {
      options = lastArg as Record<string, unknown>;
      vertices = args.slice(0, -1) as (number[] | Point3D)[];
    } else {
      vertices = args as (number[] | Point3D)[];
    }
    super(options as { color?: ParsableManimColor });
    const pointArrays = vertices.map((v) =>
      Array.isArray(v) ? np.array(v) : v as NDArray,
    );
    if (pointArrays.length > 0) {
      this.points = np.vstack(pointArrays);
    }
    if (options.color !== undefined) {
      this.color = ManimColor.parse(options.color as ParsableManimColor) as ManimColor;
    }
  }
}

// Stub for BackgroundRectangle (from geometry.shape_matchers)
class BackgroundRectangle extends VMobject {
  originalFillOpacity: number;

  constructor(
    mobject: Mobject,
    options: { color?: ParsableManimColor; strokeWidth?: number; strokeOpacity?: number; fillOpacity?: number; buff?: number } = {},
  ) {
    super({
      color: options.color,
      strokeWidth: options.strokeWidth ?? 0,
      strokeOpacity: options.strokeOpacity ?? 0,
      fillOpacity: options.fillOpacity ?? 0.75,
    });
    this.originalFillOpacity = this.fillOpacity;
    if (options.color) {
      this.fillColor = ManimColor.parse(options.color) as ManimColor;
    }
    // Position to match the mobject
    const buff = options.buff ?? 0;
    // Copy the bounding box of the mobject (simplified stub)
    this.points = mobject.points.copy();
  }
}

// Stub for Paragraph (from text.text_mobject) — default element_to_mobject
class Paragraph extends VMobject {
  text: string;

  constructor(text: string | number, _config?: Record<string, unknown>) {
    super();
    this.text = String(text);
    // Set minimal points so the mobject has geometry
    this.points = np.array([[0, 0, 0], [0.1 * this.text.length, 0, 0], [0.1 * this.text.length, 0.3, 0], [0, 0.3, 0]]);
  }
}

// Stub for MathTex (from text.tex_mobject)
class MathTex extends VMobject {
  texString: string;

  constructor(texString: string | number, _config?: Record<string, unknown>) {
    super();
    this.texString = String(texString);
    this.points = np.array([[0, 0, 0], [0.1 * this.texString.length, 0, 0], [0.1 * this.texString.length, 0.3, 0], [0, 0.3, 0]]);
  }
}

// Stub for Integer (from text.numbers)
class IntegerMobject extends VMobject {
  number: number;

  constructor(value: number | string, _config?: Record<string, unknown>) {
    super();
    this.number = Math.round(Number(value));
    const text = String(this.number);
    this.points = np.array([[0, 0, 0], [0.1 * text.length, 0, 0], [0.1 * text.length, 0.3, 0], [0, 0.3, 0]]);
  }
}

// Stub for DecimalNumber (from text.numbers)
class DecimalNumberMobject extends VMobject {
  number: number;
  numDecimalPlaces: number;

  constructor(value: number | string, config: Record<string, unknown> = {}) {
    super();
    this.number = Number(value);
    this.numDecimalPlaces = (config.num_decimal_places as number) ?? (config.numDecimalPlaces as number) ?? 1;
    const text = this.number.toFixed(this.numDecimalPlaces);
    this.points = np.array([[0, 0, 0], [0.1 * text.length, 0, 0], [0.1 * text.length, 0.3, 0], [0, 0.3, 0]]);
  }
}

// Stub for Animation classes
class Animation {
  mobject: Mobject;
  constructor(mobject: Mobject, _options?: Record<string, unknown>) {
    this.mobject = mobject;
  }
}

class AnimationGroup extends Animation {
  animations: Animation[];
  lagRatio: number;

  constructor(...args: (Animation | Record<string, unknown>)[]) {
    const lastArg = args[args.length - 1];
    let options: Record<string, unknown> = {};
    let animations: Animation[];
    if (lastArg && !(lastArg instanceof Animation) && typeof lastArg === "object") {
      options = lastArg as Record<string, unknown>;
      animations = args.slice(0, -1) as Animation[];
    } else {
      animations = args as Animation[];
    }
    super(animations[0]?.mobject ?? new Mobject());
    this.animations = animations;
    this.lagRatio = (options.lagRatio as number) ?? (options.lag_ratio as number) ?? 0;
  }
}

class Create extends Animation {
  constructor(mobject: Mobject, options?: Record<string, unknown>) {
    super(mobject, options);
  }
}

class Write extends Animation {
  constructor(mobject: Mobject, options?: Record<string, unknown>) {
    super(mobject, options);
  }
}

class FadeIn extends Animation {
  constructor(mobject: Mobject, options?: Record<string, unknown>) {
    super(mobject, options);
  }
}

// ─── Helper: get_vectorized_mobject_class stub ────────────────

function getVectorizedMobjectClass(): typeof VMobject {
  return VMobject;
}

// ─── Table Options ───────────────────────────────────────────

export interface TableOptions extends MobjectConstructorOptions {
  rowLabels?: VMobject[] | null;
  colLabels?: VMobject[] | null;
  topLeftEntry?: VMobject | null;
  vBuff?: number;
  hBuff?: number;
  includeOuterLines?: boolean;
  addBackgroundRectanglesToEntries?: boolean;
  entriesBackgroundColor?: ParsableManimColor;
  includeBackgroundRectangle?: boolean;
  backgroundRectangleColor?: ParsableManimColor;
  elementToMobject?: (item: number | string | VMobject, ...args: unknown[]) => VMobject;
  elementToMobjectConfig?: Record<string, unknown>;
  arrangeInGridConfig?: Record<string, unknown>;
  lineConfig?: Record<string, unknown>;
}

// ─── Table ───────────────────────────────────────────────────

export class Table extends VGroup {
  rowLabels: VMobject[] | null;
  colLabels: VMobject[] | null;
  topLeftEntry: VMobject | null;
  rowDim: number;
  colDim: number;
  vBuff: number;
  hBuff: number;
  includeOuterLines: boolean;
  _addBackgroundRectanglesToEntries: boolean;
  entriesBackgroundColor: ManimColor;
  _includeBackgroundRectangle: boolean;
  backgroundRectangleColor: ManimColor;
  elementToMobject: (item: number | string | VMobject, ...args: unknown[]) => VMobject;
  elementToMobjectConfig: Record<string, unknown>;
  arrangeInGridConfig: Record<string, unknown>;
  lineConfig: Record<string, unknown>;
  mobTable: VMobject[][];
  elements: VGroup;
  elementsWithoutLabels: VGroup;
  horizontalLines!: VGroup;
  verticalLines!: VGroup;

  constructor(
    table: (number | string | VMobject)[][],
    options: TableOptions = {},
  ) {
    const {
      rowLabels = null,
      colLabels = null,
      topLeftEntry = null,
      vBuff = 0.8,
      hBuff = 1.3,
      includeOuterLines = false,
      addBackgroundRectanglesToEntries = false,
      entriesBackgroundColor = BLACK,
      includeBackgroundRectangle = false,
      backgroundRectangleColor = BLACK,
      elementToMobject = (item: number | string | VMobject, ...args: unknown[]) =>
        new Paragraph(item as string | number, args[0] as Record<string, unknown> | undefined),
      elementToMobjectConfig = {},
      arrangeInGridConfig = {},
      lineConfig = {},
      ...rest
    } = options;

    // Validate that all rows have same length
    const firstRowLen = table[0].length;
    for (const row of table) {
      if (row.length !== firstRowLen) {
        throw new Error("Not all rows in table have the same length.");
      }
    }

    super();

    this.rowLabels = rowLabels ? [...rowLabels] : null;
    this.colLabels = colLabels ? [...colLabels] : null;
    this.topLeftEntry = topLeftEntry;
    this.rowDim = table.length;
    this.colDim = firstRowLen;
    this.vBuff = vBuff;
    this.hBuff = hBuff;
    this.includeOuterLines = includeOuterLines;
    this._addBackgroundRectanglesToEntries = addBackgroundRectanglesToEntries;
    this.entriesBackgroundColor = ManimColor.parse(entriesBackgroundColor) as ManimColor;
    this._includeBackgroundRectangle = includeBackgroundRectangle;
    this.backgroundRectangleColor = ManimColor.parse(backgroundRectangleColor) as ManimColor;
    this.elementToMobject = elementToMobject;
    this.elementToMobjectConfig = elementToMobjectConfig;
    this.arrangeInGridConfig = arrangeInGridConfig;
    this.lineConfig = lineConfig;

    // Apply remaining Mobject options
    if (rest.color) this.color = ManimColor.parse(rest.color) as ManimColor;
    if (rest.name) this.name = rest.name;
    if (rest.zIndex !== undefined) this.zIndex = rest.zIndex;

    let mobTable = this._tableToMobTable(table);
    this.elementsWithoutLabels = new VGroup(
      ...mobTable.flat(),
    );
    mobTable = this._addLabels(mobTable);
    this._organizeMobTable(mobTable);
    this.elements = new VGroup(...mobTable.flat());

    // Remove placeholder with no points
    if (this.elements.submobjects.length > 0) {
      const first = this.elements.submobjects[0];
      if (first.getAllPoints().shape[0] === 0) {
        this.elements.remove(first);
      }
    }

    this.add(this.elements);
    this.center();
    this.mobTable = mobTable;
    this._addHorizontalLines();
    this._addVerticalLines();
    if (this._addBackgroundRectanglesToEntries) {
      this.addBackgroundToEntries(this.entriesBackgroundColor);
    }
    if (this._includeBackgroundRectangle) {
      this.addBackgroundRectangle(this.backgroundRectangleColor);
    }
  }

  private _tableToMobTable(
    table: (number | string | VMobject)[][],
  ): VMobject[][] {
    return table.map((row) =>
      row.map((item) =>
        this.elementToMobject(item, this.elementToMobjectConfig) as VMobject,
      ),
    );
  }

  private _organizeMobTable(table: VMobject[][]): VGroup {
    const helpTable = new VGroup();
    for (const row of table) {
      for (const cell of row) {
        helpTable.add(cell);
      }
    }
    helpTable.arrangeInGrid({
      rows: table.length,
      cols: table[0].length,
      buff: [this.hBuff, this.vBuff],
      ...this.arrangeInGridConfig,
    });
    return helpTable;
  }

  private _addLabels(mobTable: VMobject[][]): VMobject[][] {
    if (this.rowLabels != null) {
      for (let k = 0; k < this.rowLabels.length; k++) {
        mobTable[k] = [this.rowLabels[k] as VMobject, ...mobTable[k]];
      }
    }
    if (this.colLabels != null) {
      if (this.rowLabels != null) {
        if (this.topLeftEntry != null) {
          const colLabelsRow = [this.topLeftEntry as VMobject, ...this.colLabels as VMobject[]];
          mobTable.unshift(colLabelsRow);
        } else {
          const VMobjectClass = getVectorizedMobjectClass();
          const dummyMobject = new VMobjectClass();
          const colLabelsRow = [dummyMobject as VMobject, ...this.colLabels as VMobject[]];
          mobTable.unshift(colLabelsRow);
        }
      } else {
        mobTable.unshift([...this.colLabels as VMobject[]]);
      }
    }
    return mobTable;
  }

  private _addHorizontalLines(): this {
    const anchorLeft = (this.getLeft().get([0]) as number) - 0.5 * this.hBuff;
    const anchorRight = (this.getRight().get([0]) as number) + 0.5 * this.hBuff;
    const lineGroup = new VGroup();
    const rows = this.getRows();

    if (this.includeOuterLines) {
      const anchorTop = (rows.at(0)!.getTop().get([1]) as number) + 0.5 * this.vBuff;
      const line1 = new Line(
        [anchorLeft, anchorTop, 0],
        [anchorRight, anchorTop, 0],
        this.lineConfig,
      );
      lineGroup.add(line1);
      this.add(line1);

      const anchorBottom = (rows.at(-1)!.getBottom().get([1]) as number) - 0.5 * this.vBuff;
      const line2 = new Line(
        [anchorLeft, anchorBottom, 0],
        [anchorRight, anchorBottom, 0],
        this.lineConfig,
      );
      lineGroup.add(line2);
      this.add(line2);
    }

    for (let k = 0; k < this.mobTable.length - 1; k++) {
      const rowBelow = rows.submobjects[k + 1] as Mobject;
      const rowAbove = rows.submobjects[k] as Mobject;
      const anchor =
        (rowBelow.getTop().get([1]) as number) +
        0.5 * ((rowAbove.getBottom().get([1]) as number) - (rowBelow.getTop().get([1]) as number));
      const line = new Line(
        [anchorLeft, anchor, 0],
        [anchorRight, anchor, 0],
        this.lineConfig,
      );
      lineGroup.add(line);
      this.add(line);
    }
    this.horizontalLines = lineGroup;
    return this;
  }

  private _addVerticalLines(): this {
    const rows = this.getRows();
    const anchorTop = (rows.getTop().get([1]) as number) + 0.5 * this.vBuff;
    const anchorBottom = (rows.getBottom().get([1]) as number) - 0.5 * this.vBuff;
    const lineGroup = new VGroup();
    const columns = this.getColumns();

    if (this.includeOuterLines) {
      const anchorLeftCol =
        (columns.submobjects[0].getLeft().get([0]) as number) - 0.5 * this.hBuff;
      const line1 = new Line(
        [anchorLeftCol, anchorTop, 0],
        [anchorLeftCol, anchorBottom, 0],
        this.lineConfig,
      );
      lineGroup.add(line1);
      this.add(line1);

      const lastCol = columns.submobjects[columns.submobjects.length - 1];
      const anchorRightCol =
        (lastCol.getRight().get([0]) as number) + 0.5 * this.hBuff;
      const line2 = new Line(
        [anchorRightCol, anchorTop, 0],
        [anchorRightCol, anchorBottom, 0],
        this.lineConfig,
      );
      lineGroup.add(line2);
      this.add(line2);
    }

    for (let k = 0; k < this.mobTable[0].length - 1; k++) {
      const colRight = columns.submobjects[k] as Mobject;
      const colLeft = columns.submobjects[k + 1] as Mobject;
      const anchor =
        (colLeft.getLeft().get([0]) as number) +
        0.5 * ((colRight.getRight().get([0]) as number) - (colLeft.getLeft().get([0]) as number));
      const line = new Line(
        [anchor, anchorBottom, 0],
        [anchor, anchorTop, 0],
        this.lineConfig,
      );
      lineGroup.add(line);
      this.add(line);
    }
    this.verticalLines = lineGroup;
    return this;
  }

  getHorizontalLines(): VGroup {
    return this.horizontalLines;
  }

  getVerticalLines(): VGroup {
    return this.verticalLines;
  }

  getColumns(): VGroup {
    const result = new VGroup();
    for (let i = 0; i < this.mobTable[0].length; i++) {
      const col = new VGroup(
        ...this.mobTable.map((row) => row[i]),
      );
      result.add(col);
    }
    return result;
  }

  getRows(): VGroup {
    const result = new VGroup();
    for (const row of this.mobTable) {
      result.add(new VGroup(...row));
    }
    return result;
  }

  setColumnColors(...colors: ParsableManimColor[]): this {
    const columns = this.getColumns();
    for (let i = 0; i < Math.min(colors.length, columns.submobjects.length); i++) {
      columns.submobjects[i].setColor(colors[i]);
    }
    return this;
  }

  setRowColors(...colors: ParsableManimColor[]): this {
    const rows = this.getRows();
    for (let i = 0; i < Math.min(colors.length, rows.submobjects.length); i++) {
      rows.submobjects[i].setColor(colors[i]);
    }
    return this;
  }

  getEntries(pos?: [number, number]): VMobject | VGroup {
    if (pos != null) {
      if (
        this.rowLabels != null &&
        this.colLabels != null &&
        this.topLeftEntry == null
      ) {
        const index = this.mobTable[0].length * (pos[0] - 1) + pos[1] - 2;
        return this.elements.submobjects[index] as VMobject;
      } else {
        const index = this.mobTable[0].length * (pos[0] - 1) + pos[1] - 1;
        return this.elements.submobjects[index] as VMobject;
      }
    }
    return this.elements;
  }

  getEntriesWithoutLabels(pos?: [number, number]): VMobject | VGroup {
    if (pos != null) {
      const index = this.colDim * (pos[0] - 1) + pos[1] - 1;
      return this.elementsWithoutLabels.submobjects[index] as VMobject;
    }
    return this.elementsWithoutLabels;
  }

  getRowLabels(): VGroup {
    return new VGroup(...(this.rowLabels ?? []));
  }

  getColLabels(): VGroup {
    return new VGroup(...(this.colLabels ?? []));
  }

  getLabels(): VGroup {
    const labelGroup = new VGroup();
    if (this.topLeftEntry != null) {
      labelGroup.add(this.topLeftEntry);
    }
    for (const labels of [this.colLabels, this.rowLabels]) {
      if (labels != null) {
        labelGroup.add(...labels);
      }
    }
    return labelGroup;
  }

  addBackgroundToEntries(color: ParsableManimColor = BLACK): this {
    for (const mob of this.elements.submobjects) {
      mob.addBackgroundRectangle(color);
    }
    return this;
  }

  getCell(pos: [number, number] = [1, 1], options: Record<string, unknown> = {}): Polygon {
    const rows = this.getRows();
    const columns = this.getColumns();
    const row = rows.submobjects[pos[0] - 1];
    const col = columns.submobjects[pos[1] - 1];

    const edgeUL = [
      (col.getLeft().get([0]) as number) - this.hBuff / 2,
      (row.getTop().get([1]) as number) + this.vBuff / 2,
      0,
    ];
    const edgeUR = [
      (col.getRight().get([0]) as number) + this.hBuff / 2,
      (row.getTop().get([1]) as number) + this.vBuff / 2,
      0,
    ];
    const edgeDL = [
      (col.getLeft().get([0]) as number) - this.hBuff / 2,
      (row.getBottom().get([1]) as number) - this.vBuff / 2,
      0,
    ];
    const edgeDR = [
      (col.getRight().get([0]) as number) + this.hBuff / 2,
      (row.getBottom().get([1]) as number) - this.vBuff / 2,
      0,
    ];
    return new Polygon(edgeUL, edgeUR, edgeDR, edgeDL, options);
  }

  getHighlightedCell(
    pos: [number, number] = [1, 1],
    color: ParsableManimColor = PURE_YELLOW,
    options: Record<string, unknown> = {},
  ): BackgroundRectangle {
    const cell = this.getCell(pos);
    return new BackgroundRectangle(cell, {
      color: ManimColor.parse(color) as ManimColor,
      ...options,
    });
  }

  addHighlightedCell(
    pos: [number, number] = [1, 1],
    color: ParsableManimColor = PURE_YELLOW,
    options: Record<string, unknown> = {},
  ): this {
    const bgCell = this.getHighlightedCell(pos, color, options);
    this.addToBack(bgCell);
    const entry = this.getEntries(pos) as Mobject & { backgroundRectangle?: BackgroundRectangle };
    entry.backgroundRectangle = bgCell;
    return this;
  }

  create(options: {
    lagRatio?: number;
    lineAnimation?: (mobject: Mobject, opts?: Record<string, unknown>) => Animation;
    labelAnimation?: (mobject: Mobject, opts?: Record<string, unknown>) => Animation;
    elementAnimation?: (mobject: Mobject, opts?: Record<string, unknown>) => Animation;
    entryAnimation?: (mobject: Mobject, opts?: Record<string, unknown>) => Animation;
  } & Record<string, unknown> = {}): AnimationGroup {
    const {
      lagRatio = 1,
      lineAnimation = (m: Mobject, o?: Record<string, unknown>) => new Create(m, o),
      labelAnimation = (m: Mobject, o?: Record<string, unknown>) => new Write(m, o),
      elementAnimation = (m: Mobject, o?: Record<string, unknown>) => new Create(m, o),
      entryAnimation = (m: Mobject, o?: Record<string, unknown>) => new FadeIn(m, o),
      ...kwargs
    } = options;

    const animations: Animation[] = [
      lineAnimation(
        new VGroup(this.verticalLines, this.horizontalLines),
        kwargs,
      ),
      elementAnimation(this.elementsWithoutLabels, kwargs),
    ];

    const labels = this.getLabels();
    if (labels.submobjects.length > 0) {
      animations.push(labelAnimation(labels, kwargs));
    }

    if (this.elements.submobjects.length > 0) {
      for (const entry of this.elementsWithoutLabels.submobjects) {
        const typedEntry = entry as Mobject & { backgroundRectangle?: Mobject };
        if (typedEntry.backgroundRectangle) {
          animations.push(entryAnimation(typedEntry.backgroundRectangle, kwargs));
        }
      }
    }

    return new AnimationGroup(...animations, { lagRatio });
  }

  override scale(scaleFactor: number, options?: { aboutPoint?: Point3D; aboutEdge?: Point3D }): this {
    this.hBuff *= scaleFactor;
    this.vBuff *= scaleFactor;
    super.scale(scaleFactor, options);
    return this;
  }
}

// ─── MathTable ───────────────────────────────────────────────

export interface MathTableOptions extends Omit<TableOptions, "elementToMobject"> {
  elementToMobject?: (item: number | string | VMobject, ...args: unknown[]) => VMobject;
}

export class MathTable extends Table {
  constructor(
    table: (number | string)[][],
    options: MathTableOptions = {},
  ) {
    const {
      elementToMobject = (item: number | string | VMobject, ...args: unknown[]) =>
        new MathTex(item as number | string, args[0] as Record<string, unknown> | undefined),
      ...rest
    } = options;
    super(table, { elementToMobject, ...rest });
  }
}

// ─── MobjectTable ────────────────────────────────────────────

export interface MobjectTableOptions extends Omit<TableOptions, "elementToMobject"> {
  elementToMobject?: (item: VMobject) => VMobject;
}

export class MobjectTable extends Table {
  constructor(
    table: VMobject[][],
    options: MobjectTableOptions = {},
  ) {
    const {
      elementToMobject = (m: VMobject) => m,
      ...rest
    } = options;
    super(table, { elementToMobject: elementToMobject as TableOptions["elementToMobject"], ...rest });
  }
}

// ─── IntegerTable ────────────────────────────────────────────

export interface IntegerTableOptions extends Omit<TableOptions, "elementToMobject"> {
  elementToMobject?: (item: number | string | VMobject, ...args: unknown[]) => VMobject;
}

export class IntegerTable extends Table {
  constructor(
    table: (number | string)[][],
    options: IntegerTableOptions = {},
  ) {
    const {
      elementToMobject = (item: number | string | VMobject, ...args: unknown[]) =>
        new IntegerMobject(item as number | string, args[0] as Record<string, unknown> | undefined),
      ...rest
    } = options;
    super(table, { elementToMobject, ...rest });
  }
}

// ─── DecimalTable ────────────────────────────────────────────

export interface DecimalTableOptions extends Omit<TableOptions, "elementToMobject" | "elementToMobjectConfig"> {
  elementToMobject?: (item: number | string | VMobject, ...args: unknown[]) => VMobject;
  elementToMobjectConfig?: Record<string, unknown>;
}

export class DecimalTable extends Table {
  constructor(
    table: (number | string)[][],
    options: DecimalTableOptions = {},
  ) {
    const {
      elementToMobject = (item: number | string | VMobject, ...args: unknown[]) =>
        new DecimalNumberMobject(item as number | string, args[0] as Record<string, unknown> | undefined),
      elementToMobjectConfig = { num_decimal_places: 1 },
      ...rest
    } = options;
    super(table, { elementToMobject, elementToMobjectConfig, ...rest });
  }
}
