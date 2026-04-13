/**
 * TypeScript port of manim/renderer/opengl_renderer.py
 *
 * Contains OpenGLCamera and OpenGLRenderer classes for OpenGL-based scene rendering.
 *
 * NOTE: This module depends on mobject.opengl (OpenGLMobject, OpenGLPoint, OpenGLVMobject)
 * which has not yet been converted. Those types are represented here via local interfaces
 * and stubs until the actual module is available.
 *
 * Rendering internals that depend on moderngl (context creation, framebuffer management,
 * texture loading, shader pipeline) are stubbed with TODO markers — they require a
 * WebGL2 or headless-gl implementation.
 */

import { np } from "../../core/math/index.js";
import { ORIGIN, LEFT, RIGHT, DOWN, UP, OUT, PI } from "../../core/math/index.js";
import type { NDArray, Point3D } from "../../core/math/index.js";
import type { ICamera, IScene, IMobject, IAnimation, IColor } from "../../core/types.js";
import type { PathFuncType } from "../../utils/paths/index.js";
import { straightPath } from "../../utils/paths/index.js";
import {
  angleOfVector,
  quaternionFromAngleAxis,
  quaternionMult,
  rotationMatrix as spaceOpsRotationMatrix,
} from "../../utils/space_ops/index.js";
import { clip } from "../../utils/simple_functions/index.js";
import * as opengl from "../../utils/opengl/index.js";
import type { FlattenedMatrix4x4 } from "../../utils/opengl/index.js";
import { config, logger } from "../../_config/index.js";
import { EndSceneEarlyException } from "../../utils/exceptions/index.js";
import { handleCachingPlay } from "../../utils/caching/index.js";
import { Mesh, Shader } from "../shader/index.js";
import type { IOpenGLRenderer as IShaderOpenGLRenderer } from "../shader/index.js";
import {
  renderOpenGLVectorizedMobjectFill,
  renderOpenGLVectorizedMobjectStroke,
} from "../vectorized_mobject_rendering/index.js";
import type { IOpenGLVMobject, IOpenGLRenderer as IVMobjectRenderer } from "../vectorized_mobject_rendering/index.js";
import type { SceneFileWriterRenderer, SceneFileWriterConfig, PixelArray } from "../../scene/scene_file_writer/index.js";
import { SceneFileWriter } from "../../scene/scene_file_writer/index.js";
import type { Window } from "../opengl_renderer_window/index.js";
import { ManimColor, colorToRgba } from "../../utils/color/index.js";
import type { ParsableManimColor } from "../../utils/color/index.js";

// ─── Type aliases ────────────────────────────────────────────

type Point3DLike = number[] | NDArray;
type Vector3DLike = number[] | NDArray;
type MatrixMN = NDArray;
type FloatRGBA = [number, number, number, number];
type RGBAPixelArray = NDArray;

// ─── Interfaces for unconverted dependencies ────────────────

/**
 * Minimal interface for OpenGLMobject — used until mobject.opengl is converted.
 * Matches the subset of the OpenGLMobject API that OpenGLCamera and OpenGLRenderer use.
 */
interface IOpenGLMobject extends IMobject {
  points: NDArray;
  modelMatrix: NDArray;
  shouldRender: boolean;
  renderPrimitive: string | number;
  setPoints(points: NDArray | number[][]): void;
  setWidth(width: number, options?: { stretch?: boolean }): void;
  setHeight(height: number, options?: { stretch?: boolean }): void;
  center(): this;
  getShaderWrapperList(): IShaderWrapper[];
  interpolate(
    mob1: IOpenGLMobject,
    mob2: IOpenGLMobject,
    alpha: number,
    pathFunc?: PathFuncType,
  ): this;
}

/**
 * Minimal interface for OpenGLPoint (light source position holder).
 */
interface IOpenGLPoint {
  getLocation(): Point3D;
}

/**
 * Minimal interface for ShaderWrapper — used in render_mobject.
 */
interface IShaderWrapper {
  shaderFolder: string | null;
  texturePaths: Record<string, string>;
  uniforms: Record<string, unknown>;
  depthTest: boolean;
  vertData: unknown;
  vertIndices: number[] | Int32Array | null;
}

/**
 * Extended scene interface for the OpenGL renderer.
 */
interface IOpenGLScene {
  mobjects: IMobject[];
  time: number;
  camera: IOpenGLMobject & { getCenter(): Point3D };
  duration: number;
  interactiveMode: boolean;
  meshes: Array<{ getMeshes(): Array<{ setUniforms(r: unknown): void; render(): void }> }>;
  add(...mobjects: IMobject[]): this;
  remove(...mobjects: IMobject[]): this;
  play(...animations: IAnimation[]): Promise<void>;
  wait(duration?: number, stopCondition?: () => boolean): Promise<void>;
  construct(): Promise<void>;
  compileAnimationData(...args: unknown[]): void;
  beginAnimations(): void;
  isCurrentAnimationFrozenFrame(): boolean;
  playInternal(): void;
}

// ─── Quaternion-based rotation helpers (private) ─────────────

/**
 * Builds the transpose of the 3×3 rotation matrix from a quaternion [w,x,y,z].
 * Each row of the result is how a basis vector transforms.
 * This mirrors Python manim's `rotation_matrix_transpose_from_quaternion`.
 */
function quaternionConjugate(q: number[]): [number, number, number, number] {
  return [q[0], -q[1], -q[2], -q[3]];
}

function rotationMatrixTransposeFromQuaternion(
  quat: number[],
): NDArray {
  const q: [number, number, number, number] = [quat[0], quat[1], quat[2], quat[3]];
  const qInv = quaternionConjugate(q);
  const bases = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const rows: number[][] = bases.map((basis) => {
    const basisQuat: [number, number, number, number] = [0, basis[0], basis[1], basis[2]];
    const result = quaternionMult(q, basisQuat, qInv);
    return [result[1], result[2], result[3]];
  });
  return np.array(rows);
}

/**
 * Builds the transpose of the 3×3 rotation matrix for a given angle/axis.
 * Mirrors Python manim's `rotation_matrix_transpose(angle, axis)`.
 */
function rotationMatrixTranspose(angle: number, axis: NDArray | number[]): NDArray {
  const axisArr = axis instanceof Array ? np.array(axis) : axis;
  const R = spaceOpsRotationMatrix(angle, axisArr);
  return R.T;
}

// ─── OpenGLCamera ────────────────────────────────────────────

export interface OpenGLCameraOptions {
  frameShape?: [number, number];
  centerPoint?: Point3DLike;
  eulerAngles?: Point3DLike;
  focalDistance?: number;
  lightSourcePosition?: Point3DLike;
  orthographic?: boolean;
  minimumPolarAngle?: number;
  maximumPolarAngle?: number;
  modelMatrix?: MatrixMN;
}

/**
 * An OpenGL-based camera for 3D scene rendering.
 *
 * NOTE: In the Python original, OpenGLCamera extends OpenGLMobject.
 * Since OpenGLMobject is not yet converted, this is a standalone class
 * that implements the camera-specific API. When OpenGLMobject is available,
 * this should be refactored to extend it.
 */
export class OpenGLCamera {
  useZIndex: boolean;
  frameRate: number;
  orthographic: boolean;
  minimumPolarAngle: number;
  maximumPolarAngle: number;
  projectionMatrix: FlattenedMatrix4x4;
  unformattedProjectionMatrix: NDArray;
  frameShape: [number, number];
  centerPoint: NDArray;
  focalDistance: number;
  lightSourcePosition: NDArray;
  eulerAngles: NDArray;
  inverseRotationMatrix!: NDArray;
  defaultModelMatrix: NDArray;
  modelMatrix: NDArray;
  points: NDArray;

  // Stub for light source — in full conversion this would be OpenGLPoint
  lightSource: { getLocation(): Point3D };

  private _formattedViewMatrix: FlattenedMatrix4x4 | null = null;
  private _unformattedViewMatrix: NDArray | null = null;

  constructor(options: OpenGLCameraOptions = {}) {
    const {
      frameShape,
      centerPoint,
      eulerAngles,
      focalDistance = 2.0,
      lightSourcePosition,
      orthographic = false,
      minimumPolarAngle = -PI / 2,
      maximumPolarAngle = PI / 2,
      modelMatrix,
    } = options;

    this.useZIndex = true;
    this.frameRate = 60;
    this.orthographic = orthographic;
    this.minimumPolarAngle = minimumPolarAngle;
    this.maximumPolarAngle = maximumPolarAngle;

    if (this.orthographic) {
      this.projectionMatrix = opengl.orthographicProjectionMatrix() as FlattenedMatrix4x4;
      this.unformattedProjectionMatrix = opengl.orthographicProjectionMatrix(
        undefined, undefined, undefined, undefined, false,
      ) as NDArray;
    } else {
      this.projectionMatrix = opengl.perspectiveProjectionMatrix() as FlattenedMatrix4x4;
      this.unformattedProjectionMatrix = opengl.perspectiveProjectionMatrix(
        undefined, undefined, undefined, undefined, false,
      ) as NDArray;
    }

    if (frameShape != null) {
      this.frameShape = frameShape;
    } else {
      this.frameShape = [config.frameWidth, config.frameHeight];
    }

    if (centerPoint != null) {
      this.centerPoint = Array.isArray(centerPoint)
        ? np.array(centerPoint)
        : centerPoint;
    } else {
      this.centerPoint = ORIGIN;
    }

    const mm = modelMatrix ?? opengl.translationMatrix(0, 0, 11);
    this.defaultModelMatrix = mm;
    this.modelMatrix = mm;

    this.focalDistance = focalDistance;

    this.lightSourcePosition = Array.isArray(lightSourcePosition)
      ? np.array(lightSourcePosition)
      : lightSourcePosition ?? np.array([-10, 10, 10]);

    // Stub light source
    const lsp = this.lightSourcePosition;
    this.lightSource = {
      getLocation(): Point3D {
        return lsp;
      },
    };

    // Initialize points (simplified — full version inherits from OpenGLMobject)
    this.points = np.array([
      [0, 0, 0],
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
    ]);
    this.initPoints();

    const ea = eulerAngles != null
      ? (Array.isArray(eulerAngles) ? np.array(eulerAngles) : eulerAngles)
      : np.array([0, 0, 0]);
    this.eulerAngles = ea;
    this.refreshRotationMatrix();
  }

  getPosition(): Point3D {
    // model_matrix[:, 3][:3]
    const col3 = [
      this.modelMatrix.get([0, 3]) as number,
      this.modelMatrix.get([1, 3]) as number,
      this.modelMatrix.get([2, 3]) as number,
    ];
    return np.array(col3);
  }

  setPosition(position: Point3D): this {
    const posArr = position.toArray() as number[];
    this.modelMatrix.set([0, 3], posArr[0]);
    this.modelMatrix.set([1, 3], posArr[1]);
    this.modelMatrix.set([2, 3], posArr[2]);
    return this;
  }

  get formattedViewMatrix(): FlattenedMatrix4x4 {
    if (this._formattedViewMatrix == null) {
      this._formattedViewMatrix = opengl.matrixToShaderInput(this.unformattedViewMatrix);
    }
    return this._formattedViewMatrix;
  }

  get unformattedViewMatrix(): NDArray {
    if (this._unformattedViewMatrix == null) {
      this._unformattedViewMatrix = np.linalg.inv(this.modelMatrix) as NDArray;
    }
    return this._unformattedViewMatrix;
  }

  initPoints(): void {
    this.points = np.array([
      (ORIGIN.toArray() as number[]),
      (LEFT.toArray() as number[]),
      (RIGHT.toArray() as number[]),
      (DOWN.toArray() as number[]),
      (UP.toArray() as number[]),
    ]);
    // Scale points to match frame shape
    const [fw, fh] = this.frameShape;
    // Stretch width: scale x coordinates of points 1,2 (LEFT, RIGHT)
    const halfW = fw / 2;
    this.points.set([1, 0], -halfW);
    this.points.set([2, 0], halfW);
    // Stretch height: scale y coordinates of points 3,4 (DOWN, UP)
    const halfH = fh / 2;
    this.points.set([3, 1], -halfH);
    this.points.set([4, 1], halfH);
    // Move to center point
    const cp = this.centerPoint.toArray() as number[];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        const cur = this.points.get([i, j]) as number;
        this.points.set([i, j], cur + cp[j]);
      }
    }
  }

  toDefaultState(): this {
    // Reset to config defaults
    const fh = config.frameHeight;
    const fw = config.frameWidth;
    this.frameShape = [fw, fh];
    this.centerPoint = ORIGIN;
    this.initPoints();
    this.setEulerAngles(0, 0, 0);
    this.modelMatrix = this.defaultModelMatrix;
    this._formattedViewMatrix = null;
    this._unformattedViewMatrix = null;
    return this;
  }

  refreshRotationMatrix(): void {
    const theta = this.eulerAngles.get([0]) as number;
    const phi = this.eulerAngles.get([1]) as number;
    const gamma = this.eulerAngles.get([2]) as number;

    const quat = quaternionMult(
      quaternionFromAngleAxis(theta, OUT, true),
      quaternionFromAngleAxis(phi, RIGHT, true),
      quaternionFromAngleAxis(gamma, OUT, true),
    );
    this.inverseRotationMatrix = rotationMatrixTransposeFromQuaternion(
      quat as unknown as number[],
    );
    // Invalidate cached view matrices
    this._formattedViewMatrix = null;
    this._unformattedViewMatrix = null;
  }

  rotate(
    angle: number,
    axis: Vector3DLike = OUT,
    _aboutPoint?: Point3DLike,
  ): this {
    const axisNd = Array.isArray(axis) ? np.array(axis) : axis;
    const currRotT = this.inverseRotationMatrix;
    const addedRotT = rotationMatrixTranspose(angle, axisNd);
    const newRotT = np.dot(currRotT, addedRotT) as NDArray;

    // Extract row 2 (Fz)
    const fz0 = newRotT.get([2, 0]) as number;
    const fz1 = newRotT.get([2, 1]) as number;
    const fz2 = newRotT.get([2, 2]) as number;

    const phi = Math.acos(Math.max(-1, Math.min(1, fz2)));
    const theta = (angleOfVector(np.array([fz0, fz1])) as number) + PI / 2;

    const partialRotT = np.dot(
      rotationMatrixTranspose(phi, RIGHT),
      rotationMatrixTranspose(theta, OUT),
    ) as NDArray;

    const newRotTTranspose = newRotT.T;
    const product = np.dot(partialRotT, newRotTTranspose) as NDArray;
    // Get column 0 of the product
    const col0 = np.array([
      product.get([0, 0]) as number,
      product.get([1, 0]) as number,
    ]);
    const gammaVal = angleOfVector(col0) as number;
    this.setEulerAngles(theta, phi, gammaVal);
    return this;
  }

  setEulerAngles(
    theta?: number | null,
    phi?: number | null,
    gamma?: number | null,
  ): this {
    if (theta != null) {
      this.eulerAngles.set([0], theta);
    }
    if (phi != null) {
      this.eulerAngles.set([1], phi);
    }
    if (gamma != null) {
      this.eulerAngles.set([2], gamma);
    }
    this.refreshRotationMatrix();
    return this;
  }

  setTheta(theta: number): this {
    return this.setEulerAngles(theta, null, null);
  }

  setPhi(phi: number): this {
    return this.setEulerAngles(null, phi, null);
  }

  setGamma(gamma: number): this {
    return this.setEulerAngles(null, null, gamma);
  }

  incrementTheta(dtheta: number): this {
    const current = this.eulerAngles.get([0]) as number;
    this.eulerAngles.set([0], current + dtheta);
    this.refreshRotationMatrix();
    return this;
  }

  incrementPhi(dphi: number): this {
    const phi = this.eulerAngles.get([1]) as number;
    const newPhi = clip(phi + dphi, -PI / 2, PI / 2);
    this.eulerAngles.set([1], newPhi);
    this.refreshRotationMatrix();
    return this;
  }

  incrementGamma(dgamma: number): this {
    const current = this.eulerAngles.get([2]) as number;
    this.eulerAngles.set([2], current + dgamma);
    this.refreshRotationMatrix();
    return this;
  }

  getShape(): [number, number] {
    return [this.getWidth(), this.getHeight()];
  }

  getCenter(): Point3D {
    // First point in the points array
    return np.array([
      this.points.get([0, 0]) as number,
      this.points.get([0, 1]) as number,
      this.points.get([0, 2]) as number,
    ]);
  }

  getWidth(): number {
    return (this.points.get([2, 0]) as number) - (this.points.get([1, 0]) as number);
  }

  getHeight(): number {
    return (this.points.get([4, 1]) as number) - (this.points.get([3, 1]) as number);
  }

  getFocalDistance(): number {
    return this.focalDistance * this.getHeight();
  }

  interpolate(
    mobject1: OpenGLCamera,
    mobject2: OpenGLCamera,
    alpha: number,
    _pathFunc?: PathFuncType,
  ): this {
    // Simplified interpolation — linearly interpolate euler angles and points
    const ea1 = mobject1.eulerAngles.toArray() as number[];
    const ea2 = mobject2.eulerAngles.toArray() as number[];
    for (let i = 0; i < 3; i++) {
      this.eulerAngles.set([i], ea1[i] + alpha * (ea2[i] - ea1[i]));
    }
    this.refreshRotationMatrix();
    return this;
  }
}

// ─── OpenGLRenderer ──────────────────────────────────────────

export interface OpenGLRendererOptions {
  fileWriterClass?: typeof SceneFileWriter;
  skipAnimations?: boolean;
}

/**
 * An OpenGL-based renderer.
 *
 * Manages the rendering pipeline: camera setup, frame updates, animation playback,
 * and frame capture. The actual OpenGL context management (moderngl in Python)
 * is stubbed with TODOs — it requires a WebGL2 or headless-gl backend.
 */
export class OpenGLRenderer implements SceneFileWriterRenderer {
  antiAliasWidth: number;
  skipAnimations: boolean;
  animationStartTime: number;
  animationElapsedTime: number;
  time: number;
  animationsHashes: (string | null)[];
  numPlays: number;
  camera: OpenGLCamera;
  pressedKeys: Set<number>;
  window: Window | null;
  pathToTextureId: Map<string, number>;
  perspectiveUniforms: Record<string, unknown>;
  scene!: IOpenGLScene;
  fileWriter!: SceneFileWriter;
  partialMovieFiles!: (string | null)[];

  // TODO: Port from OpenGL — needs WebGL2/headless-gl implementation
  context: unknown = null;
  frameBufferObject: unknown = null;

  private _fileWriterClass: typeof SceneFileWriter;
  _originalSkippingStatus: boolean;
  private _backgroundColor: FloatRGBA = [0, 0, 0, 1];

  constructor(options: OpenGLRendererOptions = {}) {
    const {
      fileWriterClass = SceneFileWriter,
      skipAnimations = false,
    } = options;

    this.antiAliasWidth = 1.5;
    this._fileWriterClass = fileWriterClass;

    this._originalSkippingStatus = skipAnimations;
    this.skipAnimations = skipAnimations;
    this.animationStartTime = 0;
    this.animationElapsedTime = 0;
    this.time = 0;
    this.animationsHashes = [];
    this.numPlays = 0;

    this.camera = new OpenGLCamera();
    this.pressedKeys = new Set();
    this.window = null;
    this.pathToTextureId = new Map();
    this.perspectiveUniforms = {};

    this.backgroundColor = config.backgroundColor;
  }

  initScene(scene: IOpenGLScene): void {
    this.partialMovieFiles = [];
    // TODO: Port from OpenGL — SceneFileWriter constructor takes 3 args in TS
    // The config parameter needs to be assembled from the global config
    const writerConfig: SceneFileWriterConfig = {
      pixelWidth: config.pixelWidth,
      pixelHeight: config.pixelHeight,
      frameRate: config.frameRate,
      mediaDir: config.mediaDir,
    };
    this.fileWriter = new this._fileWriterClass(
      this,
      scene.constructor.name,
      writerConfig,
    );
    this.scene = scene;

    this.backgroundColor = config.backgroundColor;

    if (this.shouldCreateWindow()) {
      // TODO: Port from OpenGL — window creation needs WebGL2 context
      // import { Window } from "../opengl_renderer_window/index.js";
      // this.window = new Window(this);
      // this.context = this.window.ctx;
      // this.frameBufferObject = this.context.detect_framebuffer();
      logger.warning(
        "Window creation is not yet implemented in the TypeScript port. " +
        "Falling back to headless rendering.",
      );
    }

    // TODO: Port from OpenGL — needs WebGL2/headless-gl context creation
    // Standalone context creation (moderngl equivalent)
    // this.context = createGLContext();
    // this.frameBufferObject = this.getFrameBufferObject(this.context, 0);
    // this.frameBufferObject.use();
    // this.context.enable(BLEND);
    // this.context.wireframe = config.enableWireframe;
    // this.context.blendFunc = (SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE);
  }

  shouldCreateWindow(): boolean {
    if (config.forceWindow) {
      logger.warning(
        "'--force_window' is enabled, this is intended for debugging purposes " +
        "and may impact performance if used when outputting files",
      );
      return true;
    }
    return (
      config.preview &&
      !config.saveLastFrame &&
      !config.format &&
      !config.writeToMovie &&
      !config.dryRun
    );
  }

  getPixelShape(): [number, number] | null {
    // TODO: Port from OpenGL — read from framebuffer viewport
    if (this.frameBufferObject == null) {
      return null;
    }
    // In full implementation: extract viewport from frameBufferObject
    return [config.pixelWidth, config.pixelHeight];
  }

  refreshPerspectiveUniforms(camera: OpenGLCamera): void {
    const pixelShape = this.getPixelShape();
    if (pixelShape == null) {
      throw new Error("Pixel shape is null, cannot refresh perspective uniforms.");
    }

    const [_pixelWidth, pixelHeight] = pixelShape;
    const [_frameWidth, frameHeight] = camera.getShape();
    const antiAliasWidth = this.antiAliasWidth / (pixelHeight / frameHeight);

    // Orient light
    const rotation = camera.inverseRotationMatrix;
    const lightPos = camera.lightSource.getLocation();
    const transformedLightPos = np.dot(rotation, lightPos) as NDArray;

    const center = camera.getCenter();
    const centerArr = center.toArray() as number[];
    const rotArr = rotation.T.flatten().toArray() as number[];
    const lightArr = transformedLightPos.toArray() as number[];

    this.perspectiveUniforms = {
      frame_shape: camera.getShape(),
      anti_alias_width: antiAliasWidth,
      camera_center: centerArr,
      camera_rotation: rotArr,
      light_source_position: lightArr,
      focal_distance: camera.getFocalDistance(),
    };
  }

  renderMobject(mobject: unknown): void {
    // TODO: Port from OpenGL — needs manual rendering implementation
    // The full implementation renders shader wrappers via moderngl.
    // This is the main rendering pipeline entry point.

    // Check if mobject is a VMobject for vectorized rendering
    const mob = mobject as { shouldRender?: boolean; renderPrimitive?: unknown };

    // In full implementation:
    // if (mobject instanceof OpenGLVMobject) {
    //   if (config.useProjectionFillShaders) renderOpenGLVectorizedMobjectFill(this, mobject);
    //   if (config.useProjectionStrokeShaders) renderOpenGLVectorizedMobjectStroke(this, mobject);
    // }
    // Process shader wrappers, set uniforms, create meshes, render...
  }

  getTextureId(path: string): number {
    const existing = this.pathToTextureId.get(path);
    if (existing !== undefined) {
      return existing;
    }
    return this._createTexture(path);
  }

  private _createTexture(imagePath: string): number {
    // TODO: Port from OpenGL — needs WebGL2 texture creation
    // In full implementation: load image, create GL texture, assign ID
    const tid = this.pathToTextureId.size;
    this.pathToTextureId.set(imagePath, tid);
    return tid;
  }

  updateSkippingStatus(): void {
    // Check sections for skip flag
    if (
      this.fileWriter.sections.length > 0 &&
      this.fileWriter.sections[this.fileWriter.sections.length - 1].skipAnimations
    ) {
      this.skipAnimations = true;
    }
    if (
      config.fromAnimationNumber > 0 &&
      this.numPlays < config.fromAnimationNumber
    ) {
      this.skipAnimations = true;
    }
    if (
      config.uptoAnimationNumber >= 0 &&
      this.numPlays > config.uptoAnimationNumber
    ) {
      this.skipAnimations = true;
      throw new EndSceneEarlyException();
    }
  }

  play(
    scene: IOpenGLScene,
    ...animations: unknown[]
  ): void {
    // TODO: Integrate with handleCachingPlay decorator
    this.animationStartTime = Date.now() / 1000;
    this.fileWriter.beginAnimation(!this.skipAnimations);

    scene.compileAnimationData(...animations);
    scene.beginAnimations();

    if (scene.isCurrentAnimationFrozenFrame()) {
      this.updateFrame(scene);

      if (!this.skipAnimations) {
        // TODO: Port from OpenGL — write frozen frame data
        // this.fileWriter.writeFrame(this, { numFrames: Math.floor(config.frameRate * scene.duration) });
      }

      if (this.window != null) {
        // TODO: Port from OpenGL — swap buffers and wait
      }
      this.animationElapsedTime = scene.duration;
    } else {
      scene.playInternal();
    }

    // TODO: endAnimation is async in TS SceneFileWriter
    // await this.fileWriter.endAnimation(!this.skipAnimations);
    this.time += scene.duration;
    this.numPlays += 1;
  }

  clearScreen(): void {
    // TODO: Port from OpenGL — clear framebuffer with background color
    // this.frameBufferObject.clear(...this._backgroundColor);
    if (this.window == null) {
      return;
    }
    // this.window.swapBuffers();
  }

  render(
    scene: IOpenGLScene,
    frameOffset: number,
    _movingMobjects: IMobject[],
  ): void {
    this.updateFrame(scene);

    if (this.skipAnimations) {
      return;
    }

    // TODO: Port from OpenGL — write frame
    // this.fileWriter.writeFrame(this);

    if (this.window != null) {
      // TODO: Port from OpenGL — swap buffers and loop
      // this.window.swapBuffers();
      // while (this.animationElapsedTime < frameOffset) {
      //   this.updateFrame(scene);
      //   this.window.swapBuffers();
      // }
    }
  }

  updateFrame(scene: IOpenGLScene): void {
    // TODO: Port from OpenGL — clear framebuffer
    // this.frameBufferObject.clear(...this._backgroundColor);

    const cam = scene.camera as unknown as OpenGLCamera;
    this.refreshPerspectiveUniforms(cam);

    for (const mobject of scene.mobjects) {
      const mob = mobject as unknown as { shouldRender?: boolean };
      if (mob.shouldRender === false) {
        continue;
      }
      this.renderMobject(mobject);
    }

    for (const obj of scene.meshes) {
      for (const mesh of obj.getMeshes()) {
        mesh.setUniforms(this);
        mesh.render();
      }
    }

    this.animationElapsedTime = Date.now() / 1000 - this.animationStartTime;
  }

  sceneFinished(scene: IOpenGLScene): void {
    if (this.numPlays > 0) {
      // TODO: fileWriter.finish() is async
      // await this.fileWriter.finish();
    } else if (this.numPlays === 0 && config.writeToMovie) {
      config.writeToMovie = false;
    }

    if (this.shouldSaveLastFrame()) {
      config.saveLastFrame = true;
      this.updateFrame(scene);
      // TODO: Port from OpenGL — save image
      // const image = this.getImage();
      // await this.fileWriter.saveImage(image);
    }
  }

  shouldSaveLastFrame(): boolean {
    if (config.saveLastFrame) {
      return true;
    }
    if (this.scene.interactiveMode) {
      return false;
    }
    return this.numPlays === 0;
  }

  getImage(): PixelArray {
    // TODO: Port from OpenGL — needs WebGL2 framebuffer read
    // Reads raw RGBA buffer data and constructs an image
    const raw = this.getRawFrameBufferObjectData();
    const pixelShape = this.getPixelShape();
    if (pixelShape == null) {
      throw new Error("Pixel shape is null, cannot get image.");
    }
    // In full implementation: construct image from raw buffer data
    // using sharp or similar library
    return raw;
  }

  saveStaticFrameData(
    _scene: IOpenGLScene,
    _staticMobjects: Iterable<IMobject>,
  ): void {
    // No-op — matches Python implementation
  }

  getFrameBufferObject(context: unknown, samples: number = 0): unknown {
    // TODO: Port from OpenGL — needs WebGL2 framebuffer creation
    // Creates color texture + depth renderbuffer
    const pixelWidth = config.pixelWidth;
    const pixelHeight = config.pixelHeight;
    const numChannels = 4;
    // In full implementation:
    // return context.framebuffer({
    //   colorAttachments: context.texture([pixelWidth, pixelHeight], numChannels, samples),
    //   depthAttachment: context.depthRenderbuffer([pixelWidth, pixelHeight], samples),
    // });
    return null;
  }

  getRawFrameBufferObjectData(dtype: string = "f1"): Uint8Array {
    // TODO: Port from OpenGL — needs WebGL2 framebuffer read
    // In full implementation: read pixel data from framebuffer
    const pixelShape = this.getPixelShape();
    if (pixelShape == null) {
      return new Uint8Array(0);
    }
    return new Uint8Array(pixelShape[0] * pixelShape[1] * 4);
  }

  getFrame(): PixelArray {
    const raw = this.getRawFrameBufferObjectData("f1");
    const pixelShape = this.getPixelShape();
    if (pixelShape == null) {
      throw new Error("Pixel shape is null, cannot get frame.");
    }
    // TODO: Port from OpenGL — reshape raw data to (height, width, 4) and flip vertically
    // In full implementation, flip the rows for bottom-to-top → top-to-bottom
    return raw;
  }

  pixelCoordsToSpaceCoords(
    px: number,
    py: number,
    relative: boolean = false,
    topLeft: boolean = false,
  ): Point3D {
    const pixelShape = this.getPixelShape();
    if (pixelShape == null) {
      return np.array([0.0, 0.0, 0.0]);
    }
    const [pixelWidth, pixelHeight] = pixelShape;
    const frameHeight = config.frameHeight;
    const frameCenter = this.camera.getCenter();

    if (relative) {
      return np.array([
        2 * px / pixelWidth,
        2 * py / pixelHeight,
        0,
      ]);
    }

    const scale = frameHeight / pixelHeight;
    const yDirection = topLeft ? -1 : 1;

    const offset = np.array([
      (px - pixelWidth / 2),
      yDirection * (py - pixelHeight / 2),
      0.0,
    ]);
    return frameCenter.add(offset.multiply(scale)) as NDArray;
  }

  get backgroundColor(): FloatRGBA {
    return this._backgroundColor;
  }

  set backgroundColor(value: ParsableManimColor | IColor | FloatRGBA) {
    if (Array.isArray(value) && value.length === 4) {
      this._backgroundColor = value as FloatRGBA;
    } else if (value instanceof ManimColor) {
      const rgba = colorToRgba(value, 1.0);
      this._backgroundColor = rgba as unknown as FloatRGBA;
    } else if (
      typeof value === "object" &&
      value !== null &&
      "toArray" in value
    ) {
      // IColor interface — extract RGBA directly
      const arr = (value as IColor).toArray();
      this._backgroundColor = arr;
    } else {
      const rgba = colorToRgba(value as ParsableManimColor, 1.0);
      this._backgroundColor = rgba as unknown as FloatRGBA;
    }
  }
}
