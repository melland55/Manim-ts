/**
 * Mobjects that inherit from lines and contain a label along the length.
 *
 * TypeScript port of manim/mobject/geometry/labeled.py
 */

import type { NDArray } from "numpy-ts";
import { np } from "../../../core/math/index.js";
import type { Point3D } from "../../../core/math/index.js";
import {
  DEFAULT_FONT_SIZE,
} from "../../../constants/index.js";
import { VMobject } from "../../types/index.js";
import type { VMobjectOptions } from "../../types/index.js";
import { Mobject } from "../../mobject/index.js";
import { Line, Arrow } from "../line/index.js";
import type { LineOptions, ArrowOptions } from "../line/index.js";
import { Polygram } from "../polygram/index.js";
import type { PolygramOptions } from "../polygram/index.js";
import {
  BackgroundRectangle,
  SurroundingRectangle,
} from "../shape_matchers/index.js";
import type {
  BackgroundRectangleOptions,
  SurroundingRectangleOptions,
} from "../shape_matchers/index.js";
import { MathTex, Tex } from "../../text/tex_mobject/index.js";
import type { MathTexOptions } from "../../text/tex_mobject/index.js";
import { Text } from "../../text/text_mobject/index.js";
import { WHITE } from "../../../utils/color/manim_colors.js";
import type { IColor } from "../../../core/types.js";
import { polylabel } from "../../../utils/polylabel/index.js";

// ── VGroup stub ───────────────────────────────────────────────
// TODO: Replace with import from ../../types/vectorized_mobject/index.js once VGroup is exported

class VGroup extends VMobject {
  constructor(...vmobjects: VMobject[]) {
    super();
    for (const vm of vmobjects) {
      this.add(vm);
    }
  }
}

// ── Label ─────────────────────────────────────────────────────

export interface LabelOptions extends VMobjectOptions {
  labelConfig?: Record<string, unknown>;
  boxConfig?: Record<string, unknown>;
  frameConfig?: Record<string, unknown>;
}

/**
 * A Label consisting of text surrounded by a frame.
 */
export class Label extends VGroup {
  renderedLabel: MathTex | Tex | Text;
  backgroundRect: BackgroundRectangle;
  frame: SurroundingRectangle;

  constructor(
    label: string | Tex | MathTex | Text,
    options: LabelOptions = {},
  ) {
    const {
      labelConfig: userLabelConfig,
      boxConfig: userBoxConfig,
      frameConfig: userFrameConfig,
      ...vgroupOpts
    } = options;

    super();

    // Setup Defaults
    const defaultLabelConfig: Record<string, unknown> = {
      color: WHITE as unknown as IColor,
      fontSize: DEFAULT_FONT_SIZE,
    };

    const defaultBoxConfig: Record<string, unknown> = {
      color: undefined,
      buff: 0.05,
      fillOpacity: 1,
      strokeWidth: 0.5,
    };

    const defaultFrameConfig: Record<string, unknown> = {
      color: WHITE as unknown as IColor,
      buff: 0.05,
      strokeWidth: 0.5,
    };

    // Merge Defaults
    const labelConfig = { ...defaultLabelConfig, ...(userLabelConfig ?? {}) };
    const boxConfig = { ...defaultBoxConfig, ...(userBoxConfig ?? {}) };
    const frameConfig = { ...defaultFrameConfig, ...(userFrameConfig ?? {}) };

    // Determine the type of label and instantiate the appropriate object
    if (typeof label === "string") {
      this.renderedLabel = new MathTex([label], labelConfig as MathTexOptions);
    } else if (
      label instanceof MathTex ||
      label instanceof Tex ||
      label instanceof Text
    ) {
      this.renderedLabel = label;
    } else {
      throw new TypeError(
        "Unsupported label type. Must be MathTex, Tex, or Text.",
      );
    }

    // Add a background box
    this.backgroundRect = new BackgroundRectangle(
      this.renderedLabel as unknown as Mobject,
      boxConfig as BackgroundRectangleOptions,
    );

    // Add a frame around the label
    this.frame = new SurroundingRectangle(
      this.renderedLabel as unknown as Mobject,
      frameConfig as SurroundingRectangleOptions,
    );

    // Add components to the VGroup
    this.add(this.backgroundRect as unknown as VMobject);
    this.add(this.renderedLabel as unknown as VMobject);
    this.add(this.frame as unknown as VMobject);
  }
}

// ── LabeledLine ───────────────────────────────────────────────

export interface LabeledLineOptions extends LineOptions {
  label: string | Tex | MathTex | Text;
  labelPosition?: number;
  labelConfig?: Record<string, unknown>;
  boxConfig?: Record<string, unknown>;
  frameConfig?: Record<string, unknown>;
}

/**
 * Constructs a line containing a label box somewhere along its length.
 */
export class LabeledLine extends Line {
  label: Label;

  constructor(options: LabeledLineOptions) {
    const {
      label: labelInput,
      labelPosition = 0.5,
      labelConfig,
      boxConfig,
      frameConfig,
      ...lineOpts
    } = options;

    super(lineOpts);

    // Create Label
    this.label = new Label(labelInput, {
      labelConfig,
      boxConfig,
      frameConfig,
    });

    // Compute Label Position
    const lineStart = this.getStart();
    const lineEnd = this.getEnd();
    const newVec = (lineEnd as NDArray).subtract(lineStart).multiply(labelPosition);
    const labelCoords = (lineStart as NDArray).add(newVec) as Point3D;

    this.label.moveTo(labelCoords);
    this.add(this.label as unknown as VMobject);
  }
}

// ── LabeledArrow ──────────────────────────────────────────────

export interface LabeledArrowOptions extends ArrowOptions {
  label: string | Tex | MathTex | Text;
  labelPosition?: number;
  labelConfig?: Record<string, unknown>;
  boxConfig?: Record<string, unknown>;
  frameConfig?: Record<string, unknown>;
}

/**
 * Constructs an arrow containing a label box somewhere along its length.
 *
 * In Python Manim, this uses multiple inheritance (LabeledLine, Arrow).
 * Since TypeScript doesn't support multiple inheritance, we extend Arrow
 * and compose the label behavior from LabeledLine.
 */
export class LabeledArrow extends Arrow {
  label: Label;

  constructor(options: LabeledArrowOptions) {
    const {
      label: labelInput,
      labelPosition = 0.5,
      labelConfig,
      boxConfig,
      frameConfig,
      ...arrowOpts
    } = options;

    super(arrowOpts);

    // Create Label (same logic as LabeledLine)
    this.label = new Label(labelInput, {
      labelConfig,
      boxConfig,
      frameConfig,
    });

    // Compute Label Position
    const lineStart = this.getStart();
    const lineEnd = this.getEnd();
    const newVec = (lineEnd as NDArray).subtract(lineStart).multiply(labelPosition);
    const labelCoords = (lineStart as NDArray).add(newVec) as Point3D;

    this.label.moveTo(labelCoords);
    this.add(this.label as unknown as VMobject);
  }
}

// ── LabeledPolygram ───────────────────────────────────────────

export interface LabeledPolygramOptions extends PolygramOptions {
  label: string | Tex | MathTex | Text;
  precision?: number;
  labelConfig?: Record<string, unknown>;
  boxConfig?: Record<string, unknown>;
  frameConfig?: Record<string, unknown>;
}

/**
 * Constructs a polygram containing a label box at its pole of inaccessibility.
 */
export class LabeledPolygram extends Polygram {
  label: Label;
  pole: Point3D;
  radius: number;

  constructor(
    vertexGroups: number[][][],
    options: LabeledPolygramOptions,
  ) {
    const {
      label: labelInput,
      precision = 0.01,
      labelConfig,
      boxConfig,
      frameConfig,
      ...polygramOpts
    } = options;

    // Initialize the Polygram with the vertex groups
    super(vertexGroups, polygramOpts);

    // Create Label
    this.label = new Label(labelInput, {
      labelConfig,
      boxConfig,
      frameConfig,
    });

    // Close Vertex Groups — ensure each ring is closed
    const rings: number[][][] = vertexGroups.map((group) => {
      const first = group[0];
      const last = group[group.length - 1];
      const isClosed =
        first.length === last.length &&
        first.every((v, i) => v === last[i]);
      return isClosed ? group : [...group, first];
    });

    // Compute the Pole of Inaccessibility
    const cell = polylabel(rings, precision);
    // Pad the 2D point to 3D: [x, y] → [x, y, 0]
    this.pole = np.array([cell.c[0], cell.c[1], 0]);
    this.radius = cell.d;

    // Position the label at the pole
    this.label.moveTo(this.pole);
    this.add(this.label as unknown as VMobject);
  }
}
