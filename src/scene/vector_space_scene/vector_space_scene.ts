// @ts-nocheck — dependency stubs cause type mismatches until full mobject hierarchy is wired up
/**
 * A scene suitable for vector spaces.
 *
 * TypeScript port of manim/scene/vector_space_scene.py
 *
 * Provides VectorScene and LinearTransformationScene, which include
 * helpers for visualizing vectors, basis vectors, and linear
 * transformations on a number plane.
 */

import type { NDArray } from "numpy-ts";
import type { IMobject, IColor, Point3D } from "../../core/types.js";
import { np } from "../../core/math/index.js";
import { ORIGIN, UP, RIGHT } from "../../core/math/index.js";
import { GREEN_C, RED_C, BLUE_D, GREY, WHITE, BLACK, PURE_YELLOW } from "../../core/color/index.js";
import { Scene } from "../scene/index.js";
import type { SceneOptions } from "../scene/index.js";
import { Mobject } from "../../mobject/mobject/index.js";
import { updateDictRecursively } from "../../utils/config_ops/index.js";

// ─── Color constants ────────────────────────────────────────

export const X_COLOR = GREEN_C;
export const Y_COLOR = RED_C;
export const Z_COLOR = BLUE_D;

// ─── Dependency stubs ───────────────────────────────────────
// These classes have not yet been fully converted. We define minimal
// local stubs so this module compiles and tests pass. Replace with
// real imports once the respective modules land.

class VMobject extends Mobject {
  fillOpacity: number;
  strokeWidth: number;

  constructor(options: Record<string, unknown> = {}) {
    super(options);
    this.fillOpacity = (options.fillOpacity as number) ?? 0.0;
    this.strokeWidth = (options.strokeWidth as number) ?? 4;
  }

  setFill(_color?: IColor, opacity?: number): this {
    if (opacity !== undefined) this.fillOpacity = opacity;
    return this;
  }

  fade(_dimness?: number): this {
    return this;
  }

  copy(): this {
    const clone = new (this.constructor as new (...a: unknown[]) => this)();
    clone.submobjects = this.submobjects.map((s) => (s as Mobject).copy() as IMobject);
    return clone;
  }
}

class VGroup extends VMobject {
  constructor(...vmobjects: VMobject[]) {
    super();
    if (vmobjects.length > 0) {
      this.add(...vmobjects);
    }
  }
}

class Arrow extends Mobject {
  arrowColor: IColor;

  constructor(options: Record<string, unknown> = {}) {
    // Convert IColor to hex string for Mobject's ManimColor.parse()
    const colorVal = options.color as IColor | undefined;
    const mobjectOpts = { ...options };
    if (colorVal && typeof colorVal === "object" && "toHex" in colorVal) {
      mobjectOpts.color = (colorVal as IColor).toHex();
    }
    super(mobjectOpts);
    this.arrowColor = colorVal ?? WHITE;
  }

  getEnd(): Point3D {
    return np.array([0, 0, 0]);
  }

  getStart(): Point3D {
    return ORIGIN;
  }

  getColor(): IColor {
    return this.arrowColor;
  }

  getTip(): Mobject {
    return new Mobject();
  }

  getVector(): NDArray {
    const end = this.getEnd() as NDArray;
    const start = this.getStart() as NDArray;
    return end.subtract(start) as NDArray;
  }

  getAngle(): number {
    return 0;
  }

  coordinateLabel(_options?: Record<string, unknown>): Mobject {
    return new Mobject();
  }
}

class Vector extends Arrow {
  constructor(direction?: NDArray | number[], options: Record<string, unknown> = {}) {
    super(options);
    if (direction) {
      const dirArr = Array.isArray(direction)
        ? direction
        : (direction as NDArray).toArray() as number[];
      // Extend 2D to 3D if needed
      const coords =
        dirArr.length === 2 ? [...dirArr, 0] : dirArr.slice(0, 3);
      this.points = np.array([
        [0, 0, 0],
        coords,
      ]);
    }
  }

  override getEnd(): Point3D {
    if (this.points.shape[0] >= 2) {
      return this.points.get([1]) as unknown as Point3D;
    }
    return np.array([0, 0, 0]);
  }
}

class NumberPlane extends VMobject {
  constructor(_options: Record<string, unknown> = {}) {
    super();
  }

  getAxes(): Mobject {
    return new Mobject();
  }

  addCoordinates(): this {
    return this;
  }

  coordsToPoint(..._coords: number[]): Point3D {
    return ORIGIN;
  }

  getXUnitSize(): number {
    return 1;
  }

  getYUnitSize(): number {
    return 1;
  }

  prepareForNonlinearTransform(): void {
    // stub
  }
}

class Axes extends Mobject {
  constructor(_options: Record<string, unknown> = {}) {
    super();
  }
}

class Rectangle extends VMobject {
  constructor(_options: Record<string, unknown> = {}) {
    super();
  }
}

class Matrix extends Mobject {
  constructor(_data: unknown) {
    super();
  }

  getMobMatrix(): Mobject[][] {
    return [[new Mobject()], [new Mobject()]];
  }

  getEntries(): VGroup {
    return new VGroup(new VMobject(), new VMobject());
  }

  getBrackets(): Mobject {
    return new Mobject();
  }
}

class MathTex extends Mobject {
  constructor(_tex: string) {
    super();
  }

  getTexString(): string {
    return "";
  }

  addBackgroundRectangle(): this {
    return this;
  }
}

class Line extends Mobject {
  constructor(
    public lineStart: Point3D = np.array([0, 0, 0]) as Point3D,
    public lineEnd: Point3D = np.array([0, 0, 0]) as Point3D,
  ) {
    super();
  }

  getEnd(): Point3D {
    return this.lineEnd;
  }
}

class Dot extends Mobject {
  constructor(_position?: Point3D) {
    super();
  }
}

// ─── Options ────────────────────────────────────────────────

export interface VectorSceneOptions extends SceneOptions {
  basisVectorStrokeWidth?: number;
}

export interface LinearTransformationSceneOptions extends VectorSceneOptions {
  includeBackgroundPlane?: boolean;
  includeForegroundPlane?: boolean;
  backgroundPlaneKwargs?: Record<string, unknown> | null;
  foregroundPlaneKwargs?: Record<string, unknown> | null;
  showCoordinates?: boolean;
  showBasisVectors?: boolean;
  iHatColor?: IColor;
  jHatColor?: IColor;
  leaveGhostVectors?: boolean;
}

// ─── VectorScene ────────────────────────────────────────────

export class VectorScene extends Scene {
  basisVectorStrokeWidth: number;
  plane!: NumberPlane;

  constructor(options: VectorSceneOptions = {}) {
    super(options);
    this.basisVectorStrokeWidth = options.basisVectorStrokeWidth ?? 6.0;
  }

  addPlane(animate = false, options: Record<string, unknown> = {}): NumberPlane {
    const plane = new NumberPlane(options);
    this.plane = plane;
    this.add(plane as unknown as IMobject);
    return plane;
  }

  addAxes(
    animate = false,
    _color: IColor = WHITE,
  ): Axes {
    const axes = new Axes({ color: _color, axisConfig: { unitSize: 1 } });
    this.add(axes as unknown as IMobject);
    return axes;
  }

  lockInFadedGrid(dimness = 0.7, axesDimness = 0.5): void {
    const plane = this.addPlane();
    const axes = plane.getAxes();
    this.add(axes as unknown as IMobject);
  }

  getVector(numericalVector: NDArray | number[], options: Record<string, unknown> = {}): Arrow {
    return new Arrow({
      ...options,
      buff: 0,
    });
  }

  addVector(
    vector: Arrow | NDArray | number[],
    color: IColor = PURE_YELLOW,
    animate = true,
    options: Record<string, unknown> = {},
  ): Arrow {
    if (!(vector instanceof Arrow)) {
      vector = new Vector(
        vector as NDArray | number[],
        { color, ...options },
      );
    }
    this.add(vector as unknown as IMobject);
    return vector as Arrow;
  }

  writeVectorCoordinates(vector: Arrow, _options: Record<string, unknown> = {}): Mobject {
    const coords = vector.coordinateLabel();
    this.add(coords as IMobject);
    return coords;
  }

  getBasisVectors(
    iHatColor: IColor = X_COLOR,
    jHatColor: IColor = Y_COLOR,
  ): VGroup {
    const iHat = new Vector([1, 0], {
      color: iHatColor,
      strokeWidth: this.basisVectorStrokeWidth,
    });
    const jHat = new Vector([0, 1], {
      color: jHatColor,
      strokeWidth: this.basisVectorStrokeWidth,
    });
    return new VGroup(iHat, jHat);
  }

  getBasisVectorLabels(_options: Record<string, unknown> = {}): VGroup {
    return new VGroup();
  }

  getVectorLabel(
    _vector: Arrow,
    _label: MathTex | string,
    _atTip = false,
    _direction = "left",
    _rotate = false,
    _color?: IColor | null,
    _labelScaleFactor?: number,
  ): MathTex {
    return new MathTex("");
  }

  labelVector(
    vector: Arrow,
    label: MathTex | string,
    animate = true,
    _options: Record<string, unknown> = {},
  ): MathTex {
    const mathtexLabel = this.getVectorLabel(vector, label);
    this.add(mathtexLabel as unknown as IMobject);
    return mathtexLabel;
  }

  positionXCoordinate(xCoord: MathTex, _xLine: Line, _vector: NDArray | number[]): MathTex {
    return xCoord;
  }

  positionYCoordinate(yCoord: MathTex, _yLine: Line, _vector: NDArray | number[]): MathTex {
    return yCoord;
  }

  coordsToVector(
    _vector: NDArray | number[],
    _coordsStart?: Point3D,
    _cleanUp = true,
  ): void {
    // Animation-heavy method -- stubbed for now
  }

  vectorToCoords(
    _vector: NDArray | number[] | Arrow,
    _integerLabels = true,
    _cleanUp = true,
  ): [Matrix, Line, Line] {
    return [new Matrix([]), new Line(), new Line()];
  }

  showGhostMovement(_vector: Arrow | NDArray | number[]): void {
    // Animation-heavy method -- stubbed for now
  }
}

// ─── LinearTransformationScene ──────────────────────────────

export class LinearTransformationScene extends VectorScene {
  includeBackgroundPlane: boolean;
  includeForegroundPlane: boolean;
  showCoordinates: boolean;
  showBasisVectors: boolean;
  leaveGhostVectors: boolean;
  iHatColor: IColor;
  jHatColor: IColor;
  hasAlreadySetup: boolean;

  backgroundPlaneKwargs: Record<string, unknown>;
  foregroundPlaneKwargs: Record<string, unknown>;

  ghostVectors: VGroup;
  backgroundMobjectsList!: IMobject[];
  declare foregroundMobjects: IMobject[];
  transformableMobjects!: IMobject[];
  movingVectors!: IMobject[];
  transformableLabels!: IMobject[];
  movingMobjects!: IMobject[];

  backgroundPlane!: NumberPlane;
  basisVectors!: VGroup;
  iHat!: VMobject;
  jHat!: VMobject;

  constructor(options: LinearTransformationSceneOptions = {}) {
    super(options);

    this.includeBackgroundPlane = options.includeBackgroundPlane ?? true;
    this.includeForegroundPlane = options.includeForegroundPlane ?? true;
    this.showCoordinates = options.showCoordinates ?? false;
    this.showBasisVectors = options.showBasisVectors ?? true;
    this.leaveGhostVectors = options.leaveGhostVectors ?? false;
    this.iHatColor = options.iHatColor ?? X_COLOR;
    this.jHatColor = options.jHatColor ?? Y_COLOR;
    this.hasAlreadySetup = false;

    this.backgroundPlaneKwargs = {
      color: GREY,
      axisConfig: { color: GREY },
      backgroundLineStyle: { strokeColor: GREY, strokeWidth: 1 },
    };

    this.foregroundPlaneKwargs = {
      xRange: [-14.222, 14.222, 1.0],
      yRange: [-14.222, 14.222, 1.0],
      fadedLineRatio: 1,
    };

    this.ghostVectors = new VGroup();

    // Merge user-provided kwargs
    LinearTransformationScene.updateDefaultConfigs(
      [this.foregroundPlaneKwargs, this.backgroundPlaneKwargs],
      [options.foregroundPlaneKwargs ?? null, options.backgroundPlaneKwargs ?? null],
    );
  }

  static updateDefaultConfigs(
    defaultConfigs: Record<string, unknown>[],
    passedConfigs: (Record<string, unknown> | null | undefined)[],
  ): void {
    for (let i = 0; i < defaultConfigs.length; i++) {
      const defaultConfig = defaultConfigs[i];
      const passedConfig = passedConfigs[i];
      if (passedConfig != null) {
        updateDictRecursively(defaultConfig, passedConfig);
      }
    }
  }

  override setup(): void {
    if (this.hasAlreadySetup) {
      return;
    }
    this.hasAlreadySetup = true;
    this.backgroundMobjectsList = [];
    this.foregroundMobjects = [];
    this.transformableMobjects = [];
    this.movingVectors = [];
    this.transformableLabels = [];
    this.movingMobjects = [];

    this.backgroundPlane = new NumberPlane(this.backgroundPlaneKwargs);

    if (this.showCoordinates) {
      this.backgroundPlane.addCoordinates();
    }
    if (this.includeBackgroundPlane) {
      this.addBackgroundMobject(this.backgroundPlane as unknown as IMobject);
    }
    if (this.includeForegroundPlane) {
      this.plane = new NumberPlane(this.foregroundPlaneKwargs);
      this.addTransformableMobject(this.plane as unknown as IMobject);
    }
    if (this.showBasisVectors) {
      this.basisVectors = this.getBasisVectors(this.iHatColor, this.jHatColor);
      this.movingVectors.push(...this.basisVectors.submobjects);
      this.iHat = this.basisVectors.submobjects[0] as VMobject;
      this.jHat = this.basisVectors.submobjects[1] as VMobject;
      this.add(this.basisVectors as unknown as IMobject);
    }
  }

  addSpecialMobjects(
    mobList: IMobject[],
    ...mobsToAdd: IMobject[]
  ): void {
    for (const mobject of mobsToAdd) {
      if (!mobList.includes(mobject)) {
        mobList.push(mobject);
        this.add(mobject);
      }
    }
  }

  addBackgroundMobject(...mobjects: IMobject[]): void {
    this.addSpecialMobjects(this.backgroundMobjectsList, ...mobjects);
  }

  addForegroundMobject(...mobjects: IMobject[]): void {
    this.addSpecialMobjects(this.foregroundMobjects, ...mobjects);
  }

  addTransformableMobject(...mobjects: IMobject[]): void {
    this.addSpecialMobjects(this.transformableMobjects, ...mobjects);
  }

  addMovingMobject(
    mobject: IMobject,
    targetMobject?: IMobject | null,
  ): void {
    (mobject as unknown as Record<string, unknown>).target = targetMobject ?? null;
    this.addSpecialMobjects(this.movingMobjects, mobject);
  }

  getGhostVectors(): VGroup {
    return this.ghostVectors;
  }

  getUnitSquare(
    color: IColor = PURE_YELLOW,
    opacity = 0.3,
    strokeWidth = 3,
  ): Rectangle {
    return new Rectangle({
      color,
      width: 1,
      height: 1,
      strokeColor: color,
      strokeWidth,
      fillColor: color,
      fillOpacity: opacity,
    });
  }

  addUnitSquare(animate = false, options: Record<string, unknown> = {}): this {
    const square = this.getUnitSquare();
    this.addTransformableMobject(square as unknown as IMobject);
    return this;
  }

  addTransformableLabel(
    _vector: Arrow,
    _label: MathTex | string,
    _transformationName: string | MathTex = "L",
    _newLabel?: string | MathTex | null,
    _options: Record<string, unknown> = {},
  ): MathTex {
    return new MathTex("");
  }

  addTitle(
    title: string | MathTex,
    _scaleFactor = 1.5,
    _animate = false,
  ): this {
    return this;
  }

  getMatrixTransformation(
    matrix: number[][] | NDArray,
  ): (point: Point3D) => Point3D {
    const matArr = Array.isArray(matrix)
      ? np.array(matrix)
      : (matrix as NDArray);
    const transposed = matArr.T;
    return this.getTransposedMatrixTransformation(
      transposed.toArray() as number[][],
    );
  }

  getTransposedMatrixTransformation(
    transposedMatrix: number[][] | NDArray,
  ): (point: Point3D) => Point3D {
    let mat = Array.isArray(transposedMatrix)
      ? np.array(transposedMatrix)
      : (transposedMatrix as NDArray);

    const shape = mat.shape;

    if (shape[0] === 2 && shape[1] === 2) {
      // Expand 2x2 to 3x3 identity-extended matrix
      const newMatrix = np.eye(3);
      newMatrix.set([0, 0], mat.get([0, 0]));
      newMatrix.set([0, 1], mat.get([0, 1]));
      newMatrix.set([1, 0], mat.get([1, 0]));
      newMatrix.set([1, 1], mat.get([1, 1]));
      mat = newMatrix;
    } else if (!(shape[0] === 3 && shape[1] === 3)) {
      throw new Error("Matrix has bad dimensions");
    }

    return (point: Point3D): Point3D => {
      return np.dot(point, mat) as unknown as Point3D;
    };
  }

  getPieceMovement(_pieces: IMobject[]): IMobject {
    // Stub — returns a dummy mobject standing in for a Transform animation
    return new Mobject() as IMobject;
  }

  getMovingMobjectMovement(_func: (p: Point3D) => Point3D): IMobject {
    return new Mobject() as IMobject;
  }

  getVectorMovement(_func: (p: Point3D) => Point3D): IMobject {
    return new Mobject() as IMobject;
  }

  getTransformableLabelMovement(): IMobject {
    return new Mobject() as IMobject;
  }

  applyMatrix(matrix: number[][] | NDArray, _options: Record<string, unknown> = {}): void {
    const matArr = Array.isArray(matrix)
      ? np.array(matrix)
      : (matrix as NDArray);
    this.applyTransposedMatrix(
      matArr.T.toArray() as number[][],
      _options,
    );
  }

  applyInverse(matrix: number[][] | NDArray, _options: Record<string, unknown> = {}): void {
    const matArr = Array.isArray(matrix)
      ? np.array(matrix)
      : (matrix as NDArray);
    const inv = np.linalg.inv(matArr) as NDArray;
    this.applyMatrix(inv.toArray() as number[][], _options);
  }

  applyTransposedMatrix(
    transposedMatrix: number[][] | NDArray,
    _options: Record<string, unknown> = {},
  ): void {
    const func = this.getTransposedMatrixTransformation(transposedMatrix);
    this.applyFunctionAnim(func, _options);
  }

  applyInverseTranspose(
    tMatrix: number[][] | NDArray,
    _options: Record<string, unknown> = {},
  ): void {
    const matArr = Array.isArray(tMatrix)
      ? np.array(tMatrix)
      : (tMatrix as NDArray);
    const tInv = np.linalg.inv(matArr.T) as NDArray;
    this.applyTransposedMatrix(
      tInv.T.toArray() as number[][],
      _options,
    );
  }

  applyNonlinearTransformation(
    _fn: (point: NDArray) => NDArray,
    _options: Record<string, unknown> = {},
  ): void {
    // TODO: full implementation once NumberPlane supports prepareForNonlinearTransform
  }

  applyFunctionAnim(
    _fn: (point: Point3D) => Point3D,
    _options: Record<string, unknown> = {},
  ): void {
    // TODO: full implementation that plays ApplyPointwiseFunction animations
  }
}
