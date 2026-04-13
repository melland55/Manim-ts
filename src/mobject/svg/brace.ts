/**
 * Mobject representing curly braces.
 *
 * TypeScript port of manim/mobject/svg/brace.py
 */

import type { NDArray } from "numpy-ts";

import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import {
  ORIGIN,
  DOWN,
  UP,
  LEFT,
  RIGHT,
  DEFAULT_FONT_SIZE,
  DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,
} from "../../constants/constants.js";
import { config } from "../../_config/index.js";
import {
  ManimColor,
  type ParsableManimColor,
} from "../../utils/color/core.js";
import { BLACK } from "../../utils/color/manim_colors.js";
import { Mobject } from "../mobject/index.js";

import {
  VMobjectFromSVGPath,
  _VMobjectStub as VMobject,
  _VGroupStub as VGroup,
  _LineStub as Line,
  type VMobjectStubOptions,
} from "./svg_mobject.js";

// ─── Dependency stubs for not-yet-converted modules ──────────
// TODO: Replace these stubs with real imports once the respective modules land

// Arc stub — minimal for ArcBrace
// TODO: Replace with import from ../geometry/arc once converted
class Arc extends VMobject {
  startAngle: number;
  angle: number;
  radius: number;

  constructor(
    options: {
      startAngle?: number;
      angle?: number;
      radius?: number;
    } = {},
  ) {
    super();
    this.startAngle = options.startAngle ?? 0;
    this.angle = options.angle ?? Math.PI / 2;
    this.radius = options.radius ?? 1.0;
  }

  getArcCenter(): Point3D {
    return np.array([0, 0, 0]);
  }
}

// Tex/MathTex/Text stubs — minimal for BraceLabel
// TODO: Replace with imports from ../text/ once converted
class Tex extends VMobject {
  constructor(..._args: unknown[]) {
    super();
  }
}

class MathTex extends VMobject {
  constructor(..._args: unknown[]) {
    super();
  }
}

class SingleStringMathTex extends VMobject {
  constructor(..._args: unknown[]) {
    super();
  }
}

class Text extends VMobject {
  constructor(..._args: unknown[]) {
    super();
  }
}

// Animation stubs
// TODO: Replace with imports from ../../animation/ once converted
class Animation {
  mobject: Mobject;
  constructor(mobject: Mobject) {
    this.mobject = mobject;
  }
}

class AnimationGroup {
  animations: Animation[];
  constructor(...animations: Animation[]) {
    this.animations = animations;
  }
}

class FadeIn extends Animation {
  constructor(mobject: Mobject) {
    super(mobject);
  }
}

class GrowFromCenter extends Animation {
  constructor(mobject: Mobject) {
    super(mobject);
  }
}

// ─── Brace ───────────────────────────────────────────────────

export interface BraceOptions extends VMobjectStubOptions {
  buff?: number;
  sharpness?: number;
}

export class Brace extends VMobjectFromSVGPath {
  buff: number;

  constructor(
    mobject: Mobject,
    direction: Point3D = DOWN,
    options: BraceOptions = {},
  ) {
    const {
      buff = 0.2,
      sharpness = 2,
      strokeWidth = 0,
      fillOpacity = 1.0,
      backgroundStrokeWidth = 0,
      backgroundStrokeColor = BLACK as unknown as ParsableManimColor,
      ...restOptions
    } = options;

    const pathStringTemplate =
      "m0.01216 0c-0.01152 0-0.01216 6.103e-4 -0.01216 0.01311v0.007762c0.06776 " +
      "0.122 0.1799 0.1455 0.2307 0.1455h{0}c0.03046 3.899e-4 0.07964 0.00449 " +
      "0.1246 0.02636 0.0537 0.02695 0.07418 0.05816 0.08648 0.07769 0.001562 " +
      "0.002538 0.004539 0.002563 0.01098 0.002563 0.006444-2e-8 0.009421-2.47e-" +
      "5 0.01098-0.002563 0.0123-0.01953 0.03278-0.05074 0.08648-0.07769 0.04491" +
      "-0.02187 0.09409-0.02597 0.1246-0.02636h{0}c0.05077 0 0.1629-0.02346 " +
      "0.2307-0.1455v-0.007762c-1.78e-6 -0.0125-6.365e-4 -0.01311-0.01216-0.0131" +
      "1-0.006444-3.919e-8 -0.009348 2.448e-5 -0.01091 0.002563-0.0123 0.01953-" +
      "0.03278 0.05074-0.08648 0.07769-0.04491 0.02187-0.09416 0.02597-0.1246 " +
      "0.02636h{1}c-0.04786 0-0.1502 0.02094-0.2185 0.1256-0.06833-0.1046-0.1706" +
      "-0.1256-0.2185-0.1256h{1}c-0.03046-3.899e-4 -0.07972-0.004491-0.1246-0.02" +
      "636-0.0537-0.02695-0.07418-0.05816-0.08648-0.07769-0.001562-0.002538-" +
      "0.004467-0.002563-0.01091-0.002563z";

    const defaultMinWidth = 0.90552;

    // Compute angle from direction
    const dirArr = (direction as NDArray).toArray() as number[];
    const angle = -Math.atan2(dirArr[0], dirArr[1]) + Math.PI;

    // Temporarily rotate mobject to compute dimensions
    mobject.rotate(-angle, undefined, { aboutPoint: ORIGIN });
    const left = mobject.getCorner(
      np.array([(DOWN as NDArray).toArray() as number[], (LEFT as NDArray).toArray() as number[]]
        .reduce((a, b) => a.map((v, i) => v + b[i]))),
    );
    const right = mobject.getCorner(
      np.array([(DOWN as NDArray).toArray() as number[], (RIGHT as NDArray).toArray() as number[]]
        .reduce((a, b) => a.map((v, i) => v + b[i]))),
    );
    const leftArr = (left as NDArray).toArray() as number[];
    const rightArr = (right as NDArray).toArray() as number[];
    const targetWidth = rightArr[0] - leftArr[0];
    const linearSectionLength = Math.max(
      0,
      (targetWidth * sharpness - defaultMinWidth) / 2,
    );

    const pathString = pathStringTemplate
      .replace(/\{0\}/g, String(linearSectionLength))
      .replace(/\{1\}/g, String(-linearSectionLength));

    super({
      pathString,
      strokeWidth,
      fillOpacity,
      ...restOptions,
    });

    this.buff = buff;
    this.flip(RIGHT);
    this.stretchToFitWidth(targetWidth);

    const upLeft = np.array([(UP as NDArray).toArray() as number[], (LEFT as NDArray).toArray() as number[]]
      .reduce((a, b) => a.map((v, i) => v + b[i])));
    const corner = this.getCorner(upLeft);
    const cornerArr = (corner as NDArray).toArray() as number[];
    const shiftVec = np.array([
      leftArr[0] - cornerArr[0],
      leftArr[1] - cornerArr[1] + buff * -1,
      leftArr[2] - cornerArr[2],
    ]);
    this.shift(shiftVec);

    // Rotate both back
    mobject.rotate(angle, undefined, { aboutPoint: ORIGIN });
    this.rotate(angle, undefined, { aboutPoint: ORIGIN });
  }

  putAtTip(
    mob: Mobject,
    options: { useNextTo?: boolean; buff?: number } = {},
  ): this {
    const { useNextTo = true, buff: buffOpt } = options;
    if (useNextTo) {
      const dir = this.getDirection();
      const roundedDir = np.array(
        ((dir as NDArray).toArray() as number[]).map((v) => Math.round(v)),
      );
      mob.nextTo(this.getTip(), roundedDir, { buff: buffOpt });
    } else {
      mob.moveTo(this.getTip());
      const b = buffOpt ?? DEFAULT_MOBJECT_TO_MOBJECT_BUFFER;
      const shiftDist = mob.getWidth() / 2.0 + b;
      const dir = this.getDirection();
      mob.shift((dir as NDArray).multiply(shiftDist));
    }
    return this;
  }

  getText(...text: string[]): Tex {
    const textMob = new Tex(...text);
    this.putAtTip(textMob);
    return textMob;
  }

  getTex(...tex: string[]): MathTex {
    const texMob = new MathTex(...tex);
    this.putAtTip(texMob);
    return texMob;
  }

  getTip(): Point3D {
    if (config.renderer === "opengl") {
      return this.points.get([34]) as unknown as Point3D;
    }
    return this.points.get([28]) as unknown as Point3D;
  }

  getDirection(): Point3D {
    const tip = this.getTip();
    const center = this.getCenter();
    const vect = (tip as NDArray).subtract(center);
    const norm = np.linalg.norm(vect) as number;
    if (norm === 0) return np.array([0, 0, 0]);
    return vect.divide(norm) as Point3D;
  }
}

// ─── BraceLabel ──────────────────────────────────────────────

type LabelConstructor = new (...args: unknown[]) => VMobject;

export interface BraceLabelOptions extends VMobjectStubOptions {
  braceDirection?: Point3D;
  labelConstructor?: LabelConstructor;
  fontSize?: number;
  buff?: number;
  braceConfig?: Record<string, unknown>;
}

export class BraceLabel extends VMobject {
  braceDirection: Point3D;
  brace: Brace;
  label: VMobject;
  labelConstructor: LabelConstructor;

  constructor(
    obj: Mobject,
    text: string | string[],
    options: BraceLabelOptions = {},
  ) {
    const {
      braceDirection = DOWN,
      labelConstructor = MathTex as unknown as LabelConstructor,
      fontSize = DEFAULT_FONT_SIZE,
      buff = 0.2,
      braceConfig = {},
      ...vmobOptions
    } = options;

    super(vmobOptions);

    this.labelConstructor = labelConstructor;
    this.braceDirection = braceDirection;

    this.brace = new Brace(obj, braceDirection, { buff, ...braceConfig });

    if (Array.isArray(text)) {
      this.label = new this.labelConstructor(
        ...text,
        { fontSize },
      ) as VMobject;
    } else {
      this.label = new this.labelConstructor(
        String(text),
        { fontSize },
      ) as VMobject;
    }

    this.brace.putAtTip(this.label);
    this.add(this.brace as unknown as Mobject, this.label as unknown as Mobject);
  }

  creationAnim(
    labelAnimClass: new (mob: Mobject) => Animation = FadeIn,
    braceAnimClass: new (mob: Mobject) => Animation = GrowFromCenter,
  ): AnimationGroup {
    return new AnimationGroup(
      new braceAnimClass(this.brace as unknown as Mobject),
      new labelAnimClass(this.label as unknown as Mobject),
    );
  }

  shiftBrace(obj: Mobject | Mobject[], options: Record<string, unknown> = {}): this {
    let target: Mobject;
    if (Array.isArray(obj)) {
      const group = new (this.getGroupClass())();
      group.add(...obj);
      target = group as unknown as Mobject;
    } else {
      target = obj;
    }
    this.brace = new Brace(target, this.braceDirection, options as BraceOptions);
    this.brace.putAtTip(this.label);
    return this;
  }

  changeLabel(...text: string[]): this {
    this.remove(this.label as unknown as Mobject);
    this.label = new this.labelConstructor(...text) as VMobject;
    this.brace.putAtTip(this.label);
    this.add(this.label as unknown as Mobject);
    return this;
  }

  changeBraceLabel(obj: Mobject, ...text: string[]): this {
    this.shiftBrace(obj);
    this.changeLabel(...text);
    return this;
  }
}

// ─── BraceText ───────────────────────────────────────────────

export class BraceText extends BraceLabel {
  constructor(
    obj: Mobject,
    text: string,
    options: BraceLabelOptions = {},
  ) {
    super(obj, text, {
      labelConstructor: Text as unknown as LabelConstructor,
      ...options,
    });
  }
}

// ─── BraceBetweenPoints ──────────────────────────────────────

export class BraceBetweenPoints extends Brace {
  constructor(
    point1: Point3D,
    point2: Point3D,
    direction: Point3D = ORIGIN,
    options: BraceOptions = {},
  ) {
    const p1 = (point1 as NDArray).toArray() as number[];
    const p2 = (point2 as NDArray).toArray() as number[];
    const dirArr = (direction as NDArray).toArray() as number[];
    const isOrigin = dirArr.every((v) => v === 0);

    let dir: Point3D;
    if (isOrigin) {
      const lineVec = p2.map((v, i) => v - p1[i]);
      dir = np.array([lineVec[1], -lineVec[0], 0]);
    } else {
      dir = direction;
    }

    const lineMob = new Line(point1, point2);
    super(lineMob as unknown as Mobject, dir, options);
  }
}

// ─── ArcBrace ────────────────────────────────────────────────

export class ArcBrace extends Brace {
  constructor(
    arc?: Arc | null,
    direction: Point3D = RIGHT,
    options: BraceOptions = {},
  ) {
    if (arc == null) {
      arc = new Arc({ startAngle: -1, angle: 2, radius: 1 });
    }

    const arcEndAngle = arc.startAngle + arc.angle;
    const upArr = (UP as NDArray).toArray() as number[];
    const lineStart = np.array(upArr.map((v) => v * arc!.startAngle));
    const lineEnd = np.array(upArr.map((v) => v * arcEndAngle));

    const lineMob = new Line(lineStart, lineEnd);
    const scaleShift = np.array([Math.log(arc.radius), 0, 0]);

    if (arc.radius >= 1) {
      lineMob.scale(arc.radius, { aboutPoint: ORIGIN });
      super(lineMob as unknown as Mobject, direction, options);
      this.scale(1 / arc.radius, { aboutPoint: ORIGIN });
    } else {
      super(lineMob as unknown as Mobject, direction, options);
    }

    if (arc.radius >= 0.3) {
      this.shift(scaleShift);
    } else {
      this.shift(np.array([Math.log(0.3), 0, 0]));
    }

    this.applyComplexFunction((z) => ({
      re: Math.exp(z.re) * Math.cos(z.im),
      im: Math.exp(z.re) * Math.sin(z.im),
    }));

    this.shift(arc.getArcCenter());
  }
}

// Line stub used internally
class _Line extends Mobject {
  constructor(start: Point3D, end: Point3D) {
    super();
    this.points = np.array([
      (start as NDArray).toArray(),
      (end as NDArray).toArray(),
    ]);
  }
}
