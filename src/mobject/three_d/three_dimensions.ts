/**
 * Three-dimensional mobjects.
 *
 * TypeScript port of manim/mobject/three_d/three_dimensions.py
 */

import type { NDArray } from "numpy-ts";
import {
  np,
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  IN,
  OUT,
  PI,
  TAU,
} from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import type { ParsableManimColor } from "../../utils/color/core.js";
import {
  ManimColor,
  interpolateColor,
} from "../../utils/color/core.js";
import {
  BLUE,
  BLUE_D,
  BLUE_E,
  LIGHT_GREY,
  WHITE,
} from "../../utils/color/manim_colors.js";
import {
  DEFAULT_DOT_RADIUS,
  LineJointType,
  RendererType,
  Z_AXIS,
  Y_AXIS,
  X_AXIS,
} from "../../constants/constants.js";
import { config } from "../../_config/index.js";
import { Mobject } from "../mobject/index.js";
import {
  normalize,
  perpendicularBisector,
  zToVector,
} from "../../utils/space_ops/index.js";

import { VMobject, VGroup, VectorizedPoint } from "../types/index.js";
import { Circle } from "../geometry/arc/index.js";
import { Square } from "../geometry/polygram/index.js";

// ─── ThreeDVMobject ─────────────────────────────────────────

export interface ThreeDVMobjectOptions {
  shadeIn3d?: boolean;
  fillColor?: ParsableManimColor;
  fillOpacity?: number;
  strokeColor?: ParsableManimColor;
  strokeOpacity?: number;
  strokeWidth?: number;
  color?: ParsableManimColor;
  name?: string;
}

export class ThreeDVMobject extends VMobject {
  uIndex: number = 0;
  vIndex: number = 0;
  u1: number = 0;
  u2: number = 0;
  v1: number = 0;
  v2: number = 0;
  shadeIn3d: boolean;

  constructor(options: ThreeDVMobjectOptions = {}) {
    super({
      fillColor: options.fillColor
        ? (ManimColor.parse(options.fillColor) as ManimColor)
        : undefined,
      fillOpacity: options.fillOpacity,
      strokeColor: options.strokeColor
        ? (ManimColor.parse(options.strokeColor) as ManimColor)
        : undefined,
      strokeOpacity: options.strokeOpacity,
      strokeWidth: options.strokeWidth,
      color: options.color
        ? (ManimColor.parse(options.color) as ManimColor)
        : undefined,
    });
    if (options.name !== undefined) {
      this.name = options.name;
    }
    this.shadeIn3d = options.shadeIn3d ?? true;
  }

  /** Set points as straight-line corners (builds Bezier path with line segments). */
  setPointsAsCorners(corners: (Point3D | number[])[]): this {
    this.clearPoints();
    if (corners.length < 2) return this;
    const first = Array.isArray(corners[0]) ? np.array(corners[0]) : corners[0];
    this.startNewPath(first as Point3D);
    for (let i = 1; i < corners.length; i++) {
      const pt = Array.isArray(corners[i]) ? np.array(corners[i]) : corners[i];
      this.addLineTo(pt as Point3D);
    }
    return this;
  }
}

// ─── Surface ────────────────────────────────────────────────

export interface SurfaceOptions {
  uRange?: [number, number];
  vRange?: [number, number];
  resolution?: number | [number, number];
  surfacePieceConfig?: Record<string, unknown>;
  fillColor?: ParsableManimColor;
  fillOpacity?: number;
  checkerboardColors?: ParsableManimColor[] | false;
  strokeColor?: ParsableManimColor;
  strokeWidth?: number;
  shouldMakeJagged?: boolean;
  preFunctionHandleToAnchorScaleFactor?: number;
  color?: ParsableManimColor;
  name?: string;
}

export class Surface extends VGroup {
  uRange: [number, number];
  vRange: [number, number];
  resolution: number | [number, number];
  surfacePieceConfig: Record<string, unknown>;
  checkerboardColors: ManimColor[] | false;
  shouldMakeJagged: boolean;
  preFunctionHandleToAnchorScaleFactor: number;
  listOfFaces: ThreeDVMobject[];
  private _func: (u: number, v: number) => NDArray | number[];

  constructor(
    func: (u: number, v: number) => NDArray | number[],
    options: SurfaceOptions = {},
  ) {
    const fillColor = options.fillColor ?? BLUE_D;
    const strokeColor = options.strokeColor ?? LIGHT_GREY;
    super();
    this.fillColor = ManimColor.parse(fillColor) as ManimColor;
    this.fillOpacity = options.fillOpacity ?? 1.0;
    this.strokeColor = ManimColor.parse(strokeColor) as ManimColor;
    this.strokeWidth = options.strokeWidth ?? 0.5;
    if (options.color !== undefined) {
      this.setColor(ManimColor.parse(options.color) as ManimColor);
    }
    if (options.name !== undefined) {
      this.name = options.name;
    }

    this.uRange = options.uRange ?? [0, 1];
    this.vRange = options.vRange ?? [0, 1];
    this.resolution = options.resolution ?? 32;
    this.surfacePieceConfig = options.surfacePieceConfig ?? {};
    this.shouldMakeJagged = options.shouldMakeJagged ?? false;
    this.preFunctionHandleToAnchorScaleFactor =
      options.preFunctionHandleToAnchorScaleFactor ?? 0.00001;
    this.listOfFaces = [];

    const cb = options.checkerboardColors;
    if (cb === false) {
      this.checkerboardColors = false;
    } else if (cb !== undefined) {
      this.checkerboardColors = cb.map((c) => ManimColor.parse(c) as ManimColor);
    } else {
      this.checkerboardColors = [
        ManimColor.parse(BLUE_D) as ManimColor,
        ManimColor.parse(BLUE_E) as ManimColor,
      ];
    }

    this._func = func;
    this._setupInUvSpace();
    this.applyFunction((p: Point3D) => {
      const arr = p.toArray() as number[];
      const result = func(arr[0], arr[1]);
      if (Array.isArray(result)) {
        return np.array(result);
      }
      return result as NDArray;
    });
    // Note: makeJagged not yet implemented on VMobject; shouldMakeJagged is stored
    // but no geometry transform is applied.
  }

  func(u: number, v: number): NDArray | number[] {
    return this._func(u, v);
  }

  private _getUValuesAndVValues(): [number[], number[]] {
    let uRes: number;
    let vRes: number;
    if (typeof this.resolution === "number") {
      uRes = vRes = this.resolution;
    } else {
      [uRes, vRes] = this.resolution;
    }

    const uValues = np.linspace(this.uRange[0], this.uRange[1], uRes + 1)
      .toArray() as number[];
    const vValues = np.linspace(this.vRange[0], this.vRange[1], vRes + 1)
      .toArray() as number[];

    return [uValues, vValues];
  }

  private _setupInUvSpace(): void {
    const [uValues, vValues] = this._getUValuesAndVValues();
    const faces = new VGroup();
    this.listOfFaces = [];

    for (let i = 0; i < uValues.length - 1; i++) {
      for (let j = 0; j < vValues.length - 1; j++) {
        const u1 = uValues[i];
        const u2 = uValues[i + 1];
        const v1 = vValues[j];
        const v2 = vValues[j + 1];

        const face = new ThreeDVMobject();
        face.setPointsAsCorners([
          [u1, v1, 0],
          [u2, v1, 0],
          [u2, v2, 0],
          [u1, v2, 0],
          [u1, v1, 0],
        ]);
        faces.add(face);
        face.uIndex = i;
        face.vIndex = j;
        face.u1 = u1;
        face.u2 = u2;
        face.v1 = v1;
        face.v2 = v2;
        this.listOfFaces.push(face);
      }
    }

    faces.setFill(this.fillColor, this.fillOpacity);
    faces.setStroke(this.strokeColor, this.strokeWidth, this.strokeOpacity);
    this.add(...(faces.submobjects as VMobject[]));

    if (this.checkerboardColors) {
      this.setFillByCheckerboard(...this.checkerboardColors);
    }
  }

  setFillByCheckerboard(
    ...colors: ParsableManimColor[]
  ): this {
    const nColors = colors.length;
    for (const face of this.listOfFaces) {
      const cIndex = (face.uIndex + face.vIndex) % nColors;
      face.setFill(ManimColor.parse(colors[cIndex]) as ManimColor);
    }
    return this;
  }

  setFillByValue(
    axes: {
      xRange: number[];
      yRange: number[];
      zRange: number[];
      pointToCoords(point: Point3D): number[];
    },
    colorscale?:
      | ParsableManimColor[]
      | Array<[ParsableManimColor, number]>
      | null,
    axis: number = 2,
  ): this {
    if (colorscale == null) {
      console.warn(
        "The value passed to the colorscale keyword argument was null/undefined, " +
        "the surface fill color has not been changed",
      );
      return this;
    }

    const colorscaleList = [...colorscale];
    const ranges = [axes.xRange, axes.yRange, axes.zRange];

    let newColors: ManimColor[];
    let pivots: number[];

    if (
      colorscaleList.length > 0 &&
      Array.isArray(colorscaleList[0]) &&
      (colorscaleList[0] as unknown[]).length === 2
    ) {
      const tuples = colorscaleList as Array<[ParsableManimColor, number]>;
      newColors = tuples.map(([c]) => ManimColor.parse(c) as ManimColor);
      pivots = tuples.map(([, v]) => v);
    } else {
      newColors = (colorscaleList as ParsableManimColor[]).map(
        (c) => ManimColor.parse(c) as ManimColor,
      );
      const currentRange = ranges[axis];
      const pivotMin = currentRange[0];
      const pivotMax = currentRange[1];
      const pivotFrequency = (pivotMax - pivotMin) / (newColors.length - 1);
      pivots = [];
      for (let v = pivotMin; v <= pivotMax + pivotFrequency * 0.5; v += pivotFrequency) {
        pivots.push(v);
      }
    }

    for (const mob of this.familyMembersWithPoints()) {
      const midpoint = mob.getMidpoint();
      const axisValue = axes.pointToCoords(midpoint)[axis];
      if (axisValue <= pivots[0]) {
        mob.setColor(newColors[0]);
      } else if (axisValue >= pivots[pivots.length - 1]) {
        mob.setColor(newColors[newColors.length - 1]);
      } else {
        for (let i = 0; i < pivots.length; i++) {
          if (pivots[i] > axisValue) {
            let colorIndex =
              (axisValue - pivots[i - 1]) / (pivots[i] - pivots[i - 1]);
            colorIndex = Math.min(colorIndex, 1);
            const mobColor = interpolateColor(
              newColors[i - 1],
              newColors[i],
              colorIndex,
            );
            mob.setColor(mobColor);
            break;
          }
        }
      }
    }

    return this;
  }
}

// ─── ParametricSurface ──────────────────────────────────────

export interface ParametricSurfaceOptions extends Omit<SurfaceOptions, "uRange" | "vRange" | "resolution"> {
  uRange?: [number, number];
  vRange?: [number, number];
  resolution?: number | [number, number];
}

/**
 * A Surface generated by a user-defined parametric function (u, v) → (x, y, z).
 *
 * TypeScript port of manim.mobject.three_d.three_dimensions.ParametricSurface
 *
 * Python Manim reference:
 *   class ParametricSurface(Surface):
 *     def uv_func(self, u, v): return self.func(u, v)
 */
export class ParametricSurface extends Surface {
  readonly parametricFunc: (u: number, v: number) => Point3D | number[];

  constructor(
    func: (u: number, v: number) => Point3D | number[],
    options: ParametricSurfaceOptions = {},
  ) {
    super(func, {
      ...options,
      uRange: options.uRange ?? [-1, 1],
      vRange: options.vRange ?? [-1, 1],
      resolution: options.resolution ?? [32, 32],
    });
    this.parametricFunc = func;
  }

  /** Mirror of Python's uv_func — delegates to the user-supplied func. */
  uvFunc(u: number, v: number): Point3D | number[] {
    return this.parametricFunc(u, v);
  }
}

// ─── Specific shapes ────────────────────────────────────────

export interface SphereOptions extends SurfaceOptions {
  center?: Point3D | number[];
  radius?: number;
}

export class Sphere extends Surface {
  radius: number;

  constructor(options: SphereOptions = {}) {
    const radius = options.radius ?? 1;
    const center = options.center ?? ORIGIN;

    let resValue: [number, number];
    if (config.renderer === RendererType.OPENGL) {
      resValue = [101, 51];
    } else {
      resValue = [24, 12];
    }
    const resolution = options.resolution ?? resValue;

    // Must assign radius before super() calls func(), but we can't access
    // `this` before super(). Use a closure to capture radius.
    const sphereRadius = radius;
    const sphereFunc = (u: number, v: number): number[] => [
      sphereRadius * Math.cos(u) * Math.sin(v),
      sphereRadius * Math.sin(u) * Math.sin(v),
      sphereRadius * (-Math.cos(v)),
    ];

    super(sphereFunc, {
      ...options,
      resolution,
      uRange: options.uRange ?? [0, TAU],
      vRange: options.vRange ?? [0, PI],
    });

    this.radius = radius;

    const centerArr = Array.isArray(center)
      ? center
      : (center.toArray() as number[]);
    if (centerArr.some((v) => v !== 0)) {
      this.shift(np.array(centerArr));
    }
  }

  func(u: number, v: number): number[] {
    return [
      this.radius * Math.cos(u) * Math.sin(v),
      this.radius * Math.sin(u) * Math.sin(v),
      this.radius * (-Math.cos(v)),
    ];
  }
}

export interface Dot3DOptions extends SphereOptions {
  point?: Point3D | number[];
}

export class Dot3D extends Sphere {
  constructor(options: Dot3DOptions = {}) {
    const point = options.point ?? ORIGIN;
    const radius = options.radius ?? DEFAULT_DOT_RADIUS;
    const color = options.color ?? WHITE;
    const resolution = options.resolution ?? [8, 8];

    super({
      ...options,
      center: point,
      radius,
      resolution,
    });
    this.setColor(ManimColor.parse(color) as ManimColor);
  }
}

export interface CubeOptions {
  sideLength?: number;
  fillOpacity?: number;
  fillColor?: ParsableManimColor;
  strokeWidth?: number;
  color?: ParsableManimColor;
  name?: string;
}

export class Cube extends VGroup {
  sideLength: number;

  constructor(options: CubeOptions = {}) {
    const fillColor = options.fillColor ?? BLUE;
    super();
    this.fillColor = ManimColor.parse(fillColor) as ManimColor;
    this.fillOpacity = options.fillOpacity ?? 0.75;
    this.strokeWidth = options.strokeWidth ?? 0;
    if (options.color !== undefined) {
      this.setColor(ManimColor.parse(options.color) as ManimColor);
    }
    if (options.name !== undefined) {
      this.name = options.name;
    }
    this.sideLength = options.sideLength ?? 2;
    // Mobject base constructor called generatePoints() before sideLength
    // was set. Clear and regenerate now that sideLength is initialized.
    this.submobjects = [];
    this.generatePoints();
  }

  generatePoints(): void {
    const directions = [IN, OUT, LEFT, RIGHT, UP, DOWN];
    for (const vect of directions) {
      const face = new Square({
        sideLength: this.sideLength,
      });
      (face as VMobject & { shadeIn3d?: boolean; jointType?: number }).shadeIn3d = true;
      (face as VMobject & { jointType?: number }).jointType = LineJointType.BEVEL;
      face.flip();
      const shiftVec = (OUT as NDArray).multiply(this.sideLength / 2.0);
      face.shift(shiftVec as Point3D);
      const mat = zToVector(vect);
      face.applyMatrix(mat);
      this.add(face);
    }
  }

  initPoints(): void {
    this.generatePoints();
  }
}

export interface PrismOptions extends CubeOptions {
  dimensions?: number[] | [number, number, number];
}

export class Prism extends Cube {
  dimensions: number[];

  constructor(options: PrismOptions = {}) {
    const dimensions = options.dimensions ?? [3, 2, 1];
    // Store dimensions before super (which calls generatePoints)
    // We override generatePoints to handle dimensions
    super(options);
    this.dimensions = dimensions;
    // Re-generate after dimensions is set
    this.submobjects = [];
    this.generatePoints();
    for (let dim = 0; dim < this.dimensions.length; dim++) {
      this.rescaleToFit(this.dimensions[dim], dim, true);
    }
  }
}

// ─── Cone ───────────────────────────────────────────────────

export interface ConeOptions extends SurfaceOptions {
  baseRadius?: number;
  height?: number;
  direction?: Point3D | number[];
  showBase?: boolean;
  uMin?: number;
}

export class Cone extends Surface {
  direction: NDArray;
  theta: number;
  newHeight: number;
  baseCircle: Circle;
  startPoint: VectorizedPoint;
  endPoint: VectorizedPoint;
  private _currentTheta: number = 0;
  private _currentPhi: number = 0;

  constructor(options: ConeOptions = {}) {
    const baseRadius = options.baseRadius ?? 1;
    const height = options.height ?? 1;
    const direction = options.direction ?? Z_AXIS;
    const showBase = options.showBase ?? false;
    const uMin = options.uMin ?? 0;
    const checkerboardColors = options.checkerboardColors ?? false;

    const coneTheta = PI - Math.atan(baseRadius / height);
    const uMax = Math.sqrt(baseRadius ** 2 + height ** 2);

    // Capture for closure
    const coneThetaVal = coneTheta;
    const coneFunc = (u: number, v: number): number[] => {
      const r = u;
      const phi = v;
      return [
        r * Math.sin(coneThetaVal) * Math.cos(phi),
        r * Math.sin(coneThetaVal) * Math.sin(phi),
        r * Math.cos(coneThetaVal),
      ];
    };

    super(coneFunc, {
      ...options,
      vRange: options.vRange ?? [0, TAU],
      uRange: [uMin, uMax],
      checkerboardColors,
    });

    this.direction = np.array(
      Array.isArray(direction) ? direction : (direction.toArray() as number[]),
    );
    this.theta = coneTheta;
    this.newHeight = height;
    this._currentTheta = 0;
    this._currentPhi = 0;

    this.baseCircle = new Circle({
      radius: baseRadius,
      color: this.fillColor,
      fillOpacity: this.fillOpacity,
      strokeWidth: 0,
    });
    this.baseCircle.shift((IN as NDArray).multiply(height) as Point3D);

    this.startPoint = new VectorizedPoint();
    this.endPoint = new VectorizedPoint();
    this._setStartAndEndAttributes(this.direction);

    if (showBase) {
      this.add(this.baseCircle);
    }

    this._rotateToDirection();
  }

  func(u: number, v: number): number[] {
    const r = u;
    const phi = v;
    return [
      r * Math.sin(this.theta) * Math.cos(phi),
      r * Math.sin(this.theta) * Math.sin(phi),
      r * Math.cos(this.theta),
    ];
  }

  getStart(): Point3D {
    return this.startPoint.getCenter();
  }

  getEnd(): Point3D {
    return this.endPoint.getCenter();
  }

  private _rotateToDirection(): void {
    const dir = this.direction.toArray() as number[];
    const [x, y, z] = dir;

    const r = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
    const theta = r > 0 ? Math.acos(z / r) : 0;

    let phi: number;
    if (x === 0) {
      if (y === 0) {
        phi = 0;
      } else {
        phi = Math.atan(Infinity);
        if (y < 0) phi += PI;
      }
    } else {
      phi = Math.atan(y / x);
    }
    if (x < 0) phi += PI;

    // Undo old rotation (in reverse order)
    this.rotate(-this._currentPhi, Z_AXIS, { aboutPoint: ORIGIN });
    this.rotate(-this._currentTheta, Y_AXIS, { aboutPoint: ORIGIN });

    // Do new rotation
    this.rotate(theta, Y_AXIS, { aboutPoint: ORIGIN });
    this.rotate(phi, Z_AXIS, { aboutPoint: ORIGIN });

    this._currentTheta = theta;
    this._currentPhi = phi;
  }

  setDirection(direction: Point3D | number[]): void {
    this.direction = np.array(
      Array.isArray(direction) ? direction : (direction.toArray() as number[]),
    );
    this._rotateToDirection();
  }

  getDirection(): NDArray {
    return this.direction;
  }

  private _setStartAndEndAttributes(direction: NDArray): void {
    const dirNorm = np.linalg.norm(direction) as number;
    const normalizedDirection = direction.multiply(dirNorm);

    const start = this.baseCircle.getCenter();
    const end = (start as NDArray).add(
      normalizedDirection.multiply(this.newHeight),
    ) as Point3D;

    this.startPoint = new VectorizedPoint(start);
    this.endPoint = new VectorizedPoint(end);
    this.add(this.startPoint, this.endPoint);
  }
}

// ─── Cylinder ───────────────────────────────────────────────

export interface CylinderOptions extends SurfaceOptions {
  radius?: number;
  height?: number;
  direction?: Point3D | number[];
  showEnds?: boolean;
}

export class Cylinder extends Surface {
  radius: number;
  _height: number;
  direction: NDArray | number[];
  baseTop!: Circle;
  baseBottom!: Circle;
  private _currentTheta: number = 0;
  private _currentPhi: number = 0;

  constructor(options: CylinderOptions = {}) {
    const height = options.height ?? 2;
    const radius = options.radius ?? 1;
    const direction = options.direction ?? Z_AXIS;
    const showEnds = options.showEnds ?? true;
    const resolution = options.resolution ?? [24, 24];

    const cylRadius = radius;
    const cylFunc = (u: number, v: number): number[] => {
      const h = u;
      const phi = v;
      return [cylRadius * Math.cos(phi), cylRadius * Math.sin(phi), h];
    };

    super(cylFunc, {
      ...options,
      resolution,
      uRange: [-height / 2, height / 2],
      vRange: options.vRange ?? [0, TAU],
    });

    this._height = height;
    this.radius = radius;
    this.direction = direction;

    if (showEnds) {
      this.addBases();
    }

    this._currentPhi = 0;
    this._currentTheta = 0;
    this.setDirection(direction);
  }

  func(u: number, v: number): number[] {
    const h = u;
    const phi = v;
    return [this.radius * Math.cos(phi), this.radius * Math.sin(phi), h];
  }

  addBases(): void {
    const color = this.fillColor;
    const opacity = this.fillOpacity;

    this.baseTop = new Circle({
      radius: this.radius,
      color,
      fillOpacity: opacity,
      strokeWidth: 0,
    });
    (this.baseTop as VMobject & { shadeIn3d?: boolean }).shadeIn3d = true;
    this.baseTop.shift((IN as NDArray).multiply(this.uRange[1]) as Point3D);

    this.baseBottom = new Circle({
      radius: this.radius,
      color,
      fillOpacity: opacity,
      strokeWidth: 0,
    });
    (this.baseBottom as VMobject & { shadeIn3d?: boolean }).shadeIn3d = true;
    this.baseBottom.shift((IN as NDArray).multiply(this.uRange[0]) as Point3D);

    this.add(this.baseTop, this.baseBottom);
  }

  private _rotateToDirection(): void {
    const dir = Array.isArray(this.direction)
      ? this.direction
      : (this.direction as NDArray).toArray() as number[];
    const [x, y, z] = dir;

    const r = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
    const theta = r > 0 ? Math.acos(z / r) : 0;

    let phi: number;
    if (x === 0) {
      if (y === 0) {
        phi = 0;
      } else {
        phi = Math.atan(Infinity);
        if (y < 0) phi += PI;
      }
    } else {
      phi = Math.atan(y / x);
    }
    if (x < 0) phi += PI;

    this.rotate(-this._currentPhi, Z_AXIS, { aboutPoint: ORIGIN });
    this.rotate(-this._currentTheta, Y_AXIS, { aboutPoint: ORIGIN });

    this.rotate(theta, Y_AXIS, { aboutPoint: ORIGIN });
    this.rotate(phi, Z_AXIS, { aboutPoint: ORIGIN });

    this._currentTheta = theta;
    this._currentPhi = phi;
  }

  setDirection(direction: Point3D | number[]): void {
    this.direction = direction;
    this._rotateToDirection();
  }

  getDirection(): NDArray | number[] {
    return this.direction;
  }
}

// ─── Line3D ─────────────────────────────────────────────────

export interface Line3DOptions extends CylinderOptions {
  start?: Point3D | number[];
  end?: Point3D | number[];
  thickness?: number;
  color?: ParsableManimColor;
}

export class Line3D extends Cylinder {
  thickness: number;
  vect: NDArray;
  length: number;
  start: NDArray;
  end: NDArray;

  constructor(options: Line3DOptions = {}) {
    const start = options.start ?? LEFT;
    const end = options.end ?? RIGHT;
    const thickness = options.thickness ?? 0.02;
    const resolution = options.resolution ?? 24;

    // Placeholder — will be set in setStartAndEndAttrs
    const tempObj = {
      thickness,
      resolution:
        typeof resolution === "number" ? [2, resolution] as [number, number] : resolution,
      vect: np.zeros([3]),
      length: 0,
      direction: np.zeros([3]),
      start: np.zeros([3]),
      end: np.zeros([3]),
    };

    const startArr = Array.isArray(start)
      ? np.array(start)
      : start;
    const endArr = Array.isArray(end)
      ? np.array(end)
      : end;

    const roughStart = startArr;
    const roughEnd = endArr;
    const vect = roughEnd.subtract(roughStart);
    const len = np.linalg.norm(vect) as number;
    const dir = normalize(vect);

    // Initialize via Cylinder
    const cylOpts: CylinderOptions = {
      ...options,
      height: len,
      radius: thickness,
      direction: dir,
      resolution: typeof resolution === "number" ? [2, resolution] : resolution,
    };

    // We can't call super with custom start/end logic easily,
    // so we call super and then shift
    super(cylOpts);

    this.thickness = thickness;
    this.vect = vect;
    this.length = len;
    this.start = roughStart as NDArray;
    this.end = roughEnd as NDArray;

    // Shift to center between start and end
    const mid = (this.start as NDArray).add(this.end).multiply(0.5);
    this.shift(mid as Point3D);

    if (options.color !== undefined) {
      this.setColor(ManimColor.parse(options.color) as ManimColor);
    }
  }

  pointify(
    mobOrPoint: Mobject | Point3D | number[],
    direction?: Point3D | number[] | null,
  ): NDArray {
    if (mobOrPoint instanceof Mobject) {
      if (direction == null) {
        return mobOrPoint.getCenter() as NDArray;
      } else {
        return mobOrPoint.getBoundaryPoint(
          Array.isArray(direction) ? np.array(direction) : direction,
        ) as NDArray;
      }
    }
    return Array.isArray(mobOrPoint) ? np.array(mobOrPoint) : mobOrPoint as NDArray;
  }

  override getStart(): Point3D {
    return this.start as Point3D;
  }

  override getEnd(): Point3D {
    return this.end as Point3D;
  }

  static parallelTo(
    line: Line3D,
    point: Point3D | number[] = ORIGIN,
    length: number = 5,
    options: Line3DOptions = {},
  ): Line3D {
    const npPoint = Array.isArray(point) ? np.array(point) : point;
    const vect = normalize(line.vect);
    return new Line3D({
      ...options,
      start: npPoint.add(vect.multiply(length / 2)),
      end: npPoint.subtract(vect.multiply(length / 2)),
    });
  }

  static perpendicularTo(
    line: Line3D,
    point: Point3D | number[] = ORIGIN,
    length: number = 5,
    options: Line3DOptions = {},
  ): Line3D {
    const npPoint = Array.isArray(point) ? np.array(point) : point;
    const norm = np.cross(line.vect, npPoint.subtract(line.start));
    const normVal = np.linalg.norm(norm) as number;
    if (normVal === 0) {
      throw new Error("Could not find the perpendicular.");
    }

    const [bisStart, bisEnd] = perpendicularBisector(
      [line.start, line.end],
      norm,
    );
    const vect = normalize(bisEnd.subtract(bisStart));
    return new Line3D({
      ...options,
      start: npPoint.add(vect.multiply(length / 2)),
      end: npPoint.subtract(vect.multiply(length / 2)),
    });
  }
}

// ─── Arrow3D ────────────────────────────────────────────────

export interface Arrow3DOptions extends Line3DOptions {
  height?: number;
  baseRadius?: number;
}

export class Arrow3D extends Line3D {
  cone: Cone;
  endPoint: VectorizedPoint;

  constructor(options: Arrow3DOptions = {}) {
    const start = options.start ?? LEFT;
    const end = options.end ?? RIGHT;
    const thickness = options.thickness ?? 0.02;
    const arrowHeight = options.height ?? 0.3;
    const baseRadius = options.baseRadius ?? 0.08;
    const color = options.color ?? WHITE;
    const resolution = options.resolution ?? 24;

    super({
      start,
      end,
      thickness,
      color,
      resolution,
    });

    const endArr = Array.isArray(end) ? np.array(end) : end;
    const dir = normalize(this.vect);

    this.cone = new Cone({
      direction: dir,
      baseRadius,
      height: arrowHeight,
    });
    this.cone.shift(endArr as Point3D);
    this.endPoint = new VectorizedPoint(endArr as Point3D);
    this.add(this.endPoint, this.cone);
    this.setColor(ManimColor.parse(color) as ManimColor);
  }

  override getEnd(): Point3D {
    return this.endPoint.getCenter();
  }
}

// ─── Torus ──────────────────────────────────────────────────

export interface TorusOptions extends SurfaceOptions {
  majorRadius?: number;
  minorRadius?: number;
}

export class Torus extends Surface {
  R: number;
  r: number;

  constructor(options: TorusOptions = {}) {
    const majorRadius = options.majorRadius ?? 3;
    const minorRadius = options.minorRadius ?? 1;

    let resValue: [number, number];
    if (config.renderer === RendererType.OPENGL) {
      resValue = [101, 101];
    } else {
      resValue = [24, 24];
    }
    const resolution = options.resolution ?? resValue;

    const R = majorRadius;
    const r = minorRadius;

    const torusFunc = (u: number, v: number): number[] => {
      const P = [Math.cos(u), Math.sin(u), 0];
      const scale = R - r * Math.cos(v);
      const outArr = OUT.toArray() as number[];
      return [
        scale * P[0] - r * Math.sin(v) * outArr[0],
        scale * P[1] - r * Math.sin(v) * outArr[1],
        scale * P[2] - r * Math.sin(v) * outArr[2],
      ];
    };

    super(torusFunc, {
      ...options,
      uRange: options.uRange ?? [0, TAU],
      vRange: options.vRange ?? [0, TAU],
      resolution,
    });

    this.R = majorRadius;
    this.r = minorRadius;
  }

  func(u: number, v: number): number[] {
    const P = [Math.cos(u), Math.sin(u), 0];
    const scale = this.R - this.r * Math.cos(v);
    const outArr = OUT.toArray() as number[];
    return [
      scale * P[0] - this.r * Math.sin(v) * outArr[0],
      scale * P[1] - this.r * Math.sin(v) * outArr[1],
      scale * P[2] - this.r * Math.sin(v) * outArr[2],
    ];
  }
}
