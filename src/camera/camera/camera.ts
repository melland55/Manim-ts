/**
 * Camera — converts the mobjects contained in a Scene into an array of pixels.
 *
 * TypeScript port of manim/camera/camera.py.
 * Rendering uses @napi-rs/canvas (Canvas2D) instead of Cairo.
 */

import { createCanvas, getContext2D } from "../../core/canvas-factory.js";
import type { CanvasLike, CanvasContext2D } from "../../core/canvas-factory.js";

import type { ICamera, IColor, IMobject, IVMobject, Point3D, NDArray } from "../../core/types.js";
import { np, ORIGIN } from "../../core/math/index.js";
import { BLACK } from "../../core/color/index.js";
import { config, logger } from "../../_config/index.js";
import { LineJointType, CapStyleType } from "../../constants/index.js";
import { Mobject } from "../../mobject/mobject/index.js";
import { ManimColor, colorToIntRgba } from "../../utils/color/index.js";
import type { ParsableManimColor } from "../../utils/color/index.js";
import { extractMobjectFamilyMembers } from "../../utils/family/index.js";
import { getFullRasterImagePath } from "../../utils/images/index.js";
import { listDifferenceUpdate } from "../../utils/iterables/index.js";
import { cross2d } from "../../utils/space_ops/index.js";

// ─── Canvas2D line join / cap maps ────────────────────────────

const LINE_JOIN_MAP: Record<number, CanvasLineJoin | null> = {
  [LineJointType.AUTO]: null,
  [LineJointType.ROUND]: "round",
  [LineJointType.BEVEL]: "bevel",
  [LineJointType.MITER]: "miter",
};

const CAP_STYLE_MAP: Record<number, CanvasLineCap | null> = {
  [CapStyleType.AUTO]: null,
  [CapStyleType.ROUND]: "round",
  [CapStyleType.BUTT]: "butt",
  [CapStyleType.SQUARE]: "square",
};

// ─── PixelArray type ──────────────────────────────────────────

/** Pixel array: height × width × channels stored as a flat Uint8ClampedArray with shape metadata. */
export interface PixelArray {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

function createPixelArray(width: number, height: number, channels: number = 4): PixelArray {
  return {
    data: new Uint8ClampedArray(width * height * channels),
    width,
    height,
    channels,
  };
}

function copyPixelArray(src: PixelArray): PixelArray {
  return {
    data: new Uint8ClampedArray(src.data),
    width: src.width,
    height: src.height,
    channels: src.channels,
  };
}

function fillPixelArray(pa: PixelArray, rgba: [number, number, number, number]): void {
  const { data, width, height, channels } = pa;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const offset = i * channels;
    data[offset] = rgba[0];
    data[offset + 1] = rgba[1];
    data[offset + 2] = rgba[2];
    if (channels >= 4) data[offset + 3] = rgba[3];
  }
}

function copyPixelDataInto(dst: PixelArray, src: PixelArray): void {
  dst.data.set(src.data);
}

// ─── Camera options ───────────────────────────────────────────

export interface CameraOptions {
  backgroundImage?: string;
  frameCenter?: Point3D;
  imageMode?: string;
  nChannels?: number;
  pixelArrayDtype?: string;
  cairoLineWidthMultiple?: number;
  useZIndex?: boolean;
  background?: PixelArray;
  pixelHeight?: number;
  pixelWidth?: number;
  frameHeight?: number;
  frameWidth?: number;
  frameRate?: number;
  backgroundColor?: ParsableManimColor | IColor;
  backgroundOpacity?: number;
}

// ─── Camera ───────────────────────────────────────────────────

export class Camera implements ICamera {
  backgroundImage: string | null;
  frameCenter: Point3D;
  imageMode: string;
  nChannels: number;
  pixelArrayDtype: string;
  cairoLineWidthMultiple: number;
  useZIndex: boolean;
  background!: PixelArray;
  backgroundColoredVmobjectDisplayer: BackgroundColoredVMobjectDisplayer | null;

  pixelHeight: number;
  pixelWidth: number;
  frameHeight: number;
  frameWidth: number;
  frameRate: number;

  private _backgroundColor: ManimColor;
  backgroundOpacity: number;

  maxAllowableNorm: number;
  rgbMaxVal: number;

  pixelArray!: PixelArray;

  private _canvas!: CanvasLike;
  private _ctx!: CanvasContext2D & Record<string, any>;

  constructor(options: CameraOptions = {}) {
    this.backgroundImage = options.backgroundImage ?? null;
    this.frameCenter = options.frameCenter ?? ORIGIN.copy();
    this.imageMode = options.imageMode ?? "RGBA";
    this.nChannels = options.nChannels ?? 4;
    this.pixelArrayDtype = options.pixelArrayDtype ?? "uint8";
    this.cairoLineWidthMultiple = options.cairoLineWidthMultiple ?? 0.01;
    this.useZIndex = options.useZIndex ?? true;
    this.backgroundColoredVmobjectDisplayer = null;

    this.pixelHeight = options.pixelHeight ?? config.pixelHeight;
    this.pixelWidth = options.pixelWidth ?? config.pixelWidth;
    this.frameHeight = options.frameHeight ?? config.frameHeight;
    this.frameWidth = options.frameWidth ?? config.frameWidth;
    this.frameRate = options.frameRate ?? config.frameRate;

    if (options.backgroundColor == null) {
      const bg = config.backgroundColor;
      this._backgroundColor = (bg instanceof ManimColor) ? bg : new ManimColor(bg.toHex());
    } else {
      const bgOpt = options.backgroundColor;
      if (bgOpt instanceof ManimColor) {
        this._backgroundColor = bgOpt;
      } else if (typeof bgOpt === "object" && bgOpt !== null && "toHex" in bgOpt) {
        // IColor-like object (e.g., Color from core/color)
        this._backgroundColor = new ManimColor((bgOpt as IColor).toHex());
      } else {
        this._backgroundColor = new ManimColor(bgOpt as ParsableManimColor);
      }
    }
    this.backgroundOpacity = options.backgroundOpacity ?? config.backgroundOpacity;

    this.maxAllowableNorm = config.frameWidth;
    this.rgbMaxVal = 255; // uint8 max

    if (options.background) {
      this.background = options.background;
    }

    this._canvas = createCanvas(this.pixelWidth, this.pixelHeight);
    this._ctx = getContext2D(this._canvas) as CanvasContext2D & Record<string, any>;

    // Call the private init directly to avoid virtual dispatch issues:
    // Subclasses that override initBackground() may access properties not
    // yet initialized during their super() call.
    this._initBackgroundImpl();
    // resizeFrameShape adjusts frame dimensions to match pixel aspect ratio.
    // Only call when pixel dimensions differ from defaults (e.g., resetPixelShape).
    // Calling in constructor with default config values causes floating-point drift.
    if (
      options.pixelHeight != null || options.pixelWidth != null
    ) {
      this.resizeFrameShape();
    }
    this._resetImpl();
  }

  // ── ICamera interface ────────────────────────────────────────

  get backgroundColor(): ManimColor {
    return this._backgroundColor;
  }

  set backgroundColor(color: ManimColor) {
    this._backgroundColor = color;
    this.initBackground();
  }

  setBackgroundOpacity(alpha: number): void {
    this.backgroundOpacity = alpha;
    this.initBackground();
  }

  getFrameCenter(): Point3D {
    return this.frameCenter.copy();
  }

  setFrameCenter(point: Point3D): void {
    this.frameCenter = point.copy();
  }

  captureFrame(): void {
    const { r, g, b, a } = this._backgroundColor;
    this._ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
    this._ctx.fillRect(0, 0, this.pixelWidth, this.pixelHeight);
  }

  // ── Canvas access ────────────────────────────────────────────

  get canvas(): CanvasLike {
    return this._canvas;
  }

  get context(): CanvasContext2D {
    return this._ctx;
  }

  // ── Type dispatch ────────────────────────────────────────────

  typeOrRaise(mobject: IMobject): string {
    // In the TS port, we use string-based type discrimination
    // since we don't have the same class hierarchy as Python.
    // Check for VMobject-like (has points, fillColor, strokeColor)
    if ("fillColor" in mobject && "strokeColor" in mobject && "points" in mobject) {
      return "VMobject";
    }
    // Check for PMobject-like (has points, rgbas)
    if ("rgbas" in mobject && "strokeWidth" in mobject && !("fillColor" in mobject)) {
      return "PMobject";
    }
    // Check for ImageMobject-like
    if ("getPixelArray" in mobject) {
      return "ImageMobject";
    }
    // Base Mobject — do nothing
    return "Mobject";
  }

  // ── Pixel shape ──────────────────────────────────────────────

  resetPixelShape(newHeight: number, newWidth: number): void {
    this.pixelWidth = newWidth;
    this.pixelHeight = newHeight;
    this._canvas = createCanvas(newWidth, newHeight);
    this._ctx = getContext2D(this._canvas) as CanvasContext2D & Record<string, any>;
    this.initBackground();
    this.resizeFrameShape();
    this.reset();
  }

  resizeFrameShape(fixedDimension: number = 0): void {
    const aspectRatio = this.pixelWidth / this.pixelHeight;
    if (fixedDimension === 0) {
      this.frameHeight = this.frameWidth / aspectRatio;
    } else {
      this.frameWidth = aspectRatio * this.frameHeight;
    }
  }

  // ── Background ───────────────────────────────────────────────

  /** @internal Non-virtual background initialization (safe during construction) */
  private _initBackgroundImpl(): void {
    const height = this.pixelHeight;
    const width = this.pixelWidth;

    if (this.backgroundImage != null) {
      // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
      // In Python, this loads an image via PIL and converts to numpy array.
      // For now, create a blank background — async image loading would be
      // needed for full support.
      this.background = createPixelArray(width, height, this.nChannels);
    } else {
      const backgroundRgba = colorToIntRgba(
        this._backgroundColor,
        this.backgroundOpacity,
      );
      this.background = createPixelArray(width, height, this.nChannels);
      fillPixelArray(this.background, backgroundRgba);
    }
  }

  initBackground(): void {
    this._initBackgroundImpl();
  }

  getImage(): Buffer | string {
    // Node: returns a Buffer via @napi-rs/canvas toBuffer
    // Browser: returns a data URL string
    if (typeof (this._canvas as any).toBuffer === "function") {
      return (this._canvas as any).toBuffer("image/png");
    }
    return (this._canvas as any).toDataURL("image/png");
  }

  convertPixelArray(
    pixelArray: PixelArray,
    convertFromFloats: boolean = false,
  ): PixelArray {
    if (convertFromFloats) {
      const result = copyPixelArray(pixelArray);
      for (let i = 0; i < result.data.length; i++) {
        result.data[i] = Math.round(result.data[i] * this.rgbMaxVal);
      }
      return result;
    }
    return copyPixelArray(pixelArray);
  }

  setPixelArray(
    pixelArray: PixelArray | unknown,
    convertFromFloats?: boolean | Record<string, unknown>,
  ): void {
    if (!(pixelArray && typeof pixelArray === "object" && "data" in (pixelArray as PixelArray))) {
      return; // Unsupported pixel array format
    }
    const converted = this.convertPixelArray(
      pixelArray as PixelArray,
      typeof convertFromFloats === "boolean" ? convertFromFloats : false,
    );
    if (
      !this.pixelArray ||
      this.pixelArray.width !== converted.width ||
      this.pixelArray.height !== converted.height
    ) {
      this.pixelArray = converted;
    } else {
      copyPixelDataInto(this.pixelArray, converted);
    }
  }

  setBackground(
    pixelArray: PixelArray | unknown,
    convertFromFloats?: boolean | Record<string, unknown>,
  ): void {
    if (!(pixelArray && typeof pixelArray === "object" && "data" in (pixelArray as PixelArray))) {
      return; // Unsupported pixel array format
    }
    this.background = this.convertPixelArray(
      pixelArray as PixelArray,
      typeof convertFromFloats === "boolean" ? convertFromFloats : false,
    );
  }

  makeBackgroundFromFunc(
    coordsToColorsFunc: (coords: [number, number]) => [number, number, number, number],
  ): PixelArray {
    logger.info("Starting set_background");
    const pa = createPixelArray(this.pixelWidth, this.pixelHeight, this.nChannels);
    const fw = this.frameWidth;
    const fh = this.frameHeight;
    const pw = this.pixelWidth;
    const ph = this.pixelHeight;

    for (let row = 0; row < ph; row++) {
      for (let col = 0; col < pw; col++) {
        const x = (col / pw) * fw - fw / 2;
        const y = -((row / ph) * fh - fh / 2);
        const rgba = coordsToColorsFunc([x, y]);
        const offset = (row * pw + col) * this.nChannels;
        pa.data[offset] = Math.round(rgba[0] * this.rgbMaxVal);
        pa.data[offset + 1] = Math.round(rgba[1] * this.rgbMaxVal);
        pa.data[offset + 2] = Math.round(rgba[2] * this.rgbMaxVal);
        if (this.nChannels >= 4) pa.data[offset + 3] = Math.round(rgba[3] * this.rgbMaxVal);
      }
    }
    logger.info("Ending set_background");
    return pa;
  }

  setBackgroundFromFunc(
    coordsToColorsFunc: (coords: [number, number]) => [number, number, number, number],
  ): void {
    this.setBackground(this.makeBackgroundFromFunc(coordsToColorsFunc));
  }

  /** @internal Non-virtual reset (safe during construction) */
  private _resetImpl(): void {
    this.setPixelArray(this.background);
  }

  reset(): this {
    this._resetImpl();
    return this;
  }

  setFrameToBackground(background: PixelArray): void {
    this.setPixelArray(background);
  }

  // ── Mobject display ──────────────────────────────────────────

  getMobjectsToDisplay(
    mobjects: Iterable<IMobject>,
    includeSubmobjects: boolean = true,
    excludedMobjects?: IMobject[],
  ): IMobject[] {
    let result: Iterable<IMobject> = mobjects;
    if (includeSubmobjects) {
      result = extractMobjectFamilyMembers(
        result,
        this.useZIndex,
        true,
      );
      if (excludedMobjects && excludedMobjects.length > 0) {
        const allExcluded = extractMobjectFamilyMembers(
          excludedMobjects,
          this.useZIndex,
        );
        result = listDifferenceUpdate(
          result as IMobject[],
          allExcluded,
        );
      }
    }
    return [...result];
  }

  isInFrame(mobject: IMobject): boolean {
    const fc = this.frameCenter;
    const fh = this.frameHeight;
    const fw = this.frameWidth;
    const fcx = fc.item(0) as number;
    const fcy = fc.item(1) as number;

    const rightX = mobject.getRight().item(0) as number;
    const bottomY = mobject.getBottom().item(1) as number;
    const leftX = mobject.getLeft().item(0) as number;
    const topY = mobject.getTop().item(1) as number;

    return !(
      rightX < fcx - fw / 2 ||
      bottomY > fcy + fh / 2 ||
      leftX > fcx + fw / 2 ||
      topY < fcy - fh / 2
    );
  }

  captureMobject(
    mobject: IMobject,
    options?: {
      includeSubmobjects?: boolean;
      excludedMobjects?: IMobject[];
    },
  ): void {
    this.captureMobjects([mobject], options);
  }

  captureMobjects(
    mobjects: Iterable<IMobject>,
    options?: {
      includeSubmobjects?: boolean;
      excludedMobjects?: IMobject[];
    },
  ): void {
    const toDisplay = this.getMobjectsToDisplay(
      mobjects,
      options?.includeSubmobjects,
      options?.excludedMobjects,
    );

    // Group consecutive mobjects by type and display each batch
    let currentType: string | null = null;
    let currentBatch: IMobject[] = [];

    const flushBatch = (): void => {
      if (currentBatch.length === 0 || currentType === null) return;
      switch (currentType) {
        case "VMobject":
          this.displayMultipleVectorizedMobjects(currentBatch as unknown as IVMobject[]);
          break;
        case "PMobject":
          this.displayMultiplePointCloudMobjects(currentBatch);
          break;
        case "ImageMobject":
          this.displayMultipleImageMobjects(currentBatch);
          break;
        // Mobject — do nothing
      }
    };

    for (const mob of toDisplay) {
      const mType = this.typeOrRaise(mob);
      if (mType !== currentType) {
        flushBatch();
        currentType = mType;
        currentBatch = [mob];
      } else {
        currentBatch.push(mob);
      }
    }
    flushBatch();
  }

  // ── Canvas2D rendering context ──────────────────────────────

  getCanvasContext(): CanvasContext2D {
    return this._ctx;
  }

  setupContextTransform(ctx: CanvasContext2D): void {
    const pw = this.pixelWidth;
    const ph = this.pixelHeight;
    const fw = this.frameWidth;
    const fh = this.frameHeight;
    const fcx = this.frameCenter.item(0) as number;
    const fcy = this.frameCenter.item(1) as number;

    ctx.setTransform(
      pw / fw,              // a: horizontal scale
      0,                    // b
      0,                    // c
      -(ph / fh),           // d: vertical scale (flipped)
      pw / 2 - fcx * (pw / fw),   // e: horizontal translate
      ph / 2 + fcy * (ph / fh),   // f: vertical translate
    );
  }

  // ── VMobject display ─────────────────────────────────────────

  displayMultipleVectorizedMobjects(vmobjects: IVMobject[]): void {
    if (vmobjects.length === 0) return;

    // Group by background image
    let currentImage: string | null = null;
    let currentBatch: IVMobject[] = [];

    const flushBatch = (): void => {
      if (currentBatch.length === 0) return;
      if (currentImage) {
        this.displayMultipleBackgroundColoredVmobjects(currentBatch);
      } else {
        this.displayMultipleNonBackgroundColoredVmobjects(currentBatch);
      }
    };

    for (const vm of vmobjects) {
      const image = ("getBackgroundImage" in vm)
        ? (vm as unknown as { getBackgroundImage(): string | null }).getBackgroundImage()
        : null;
      if (image !== currentImage) {
        flushBatch();
        currentImage = image;
        currentBatch = [vm];
      } else {
        currentBatch.push(vm);
      }
    }
    flushBatch();
  }

  displayMultipleNonBackgroundColoredVmobjects(vmobjects: IVMobject[]): void {
    const ctx = this._ctx;
    for (const vmobject of vmobjects) {
      this.displayVectorized(vmobject, ctx);
    }
  }

  displayVectorized(vmobject: IVMobject, ctx: CanvasContext2D): this {
    this.setCanvasContextPath(ctx, vmobject);
    this.applyStroke(ctx, vmobject, true);
    this.applyFill(ctx, vmobject);
    this.applyStroke(ctx, vmobject, false);
    return this;
  }

  setCanvasContextPath(ctx: CanvasContext2D, vmobject: IVMobject): this {
    const rawPoints = vmobject.points;
    if (!rawPoints || (rawPoints.shape[0] === 0)) {
      return this;
    }

    const points = this.transformPointsPreDisplay(vmobject, rawPoints);
    if (points.shape[0] === 0) return this;

    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // The full implementation requires gen_subpaths_from_points_2d and
    // gen_cubic_bezier_tuples_from_points from VMobject, which build
    // Canvas2D paths from cubic bezier control points.
    ctx.beginPath();

    const nPoints = points.shape[0];
    if (nPoints >= 1) {
      const startX = points.get([0, 0]) as number;
      const startY = points.get([0, 1]) as number;
      ctx.moveTo(startX, startY);

      // Walk through points in groups of 4 (anchor, handle1, handle2, anchor)
      for (let i = 1; i + 2 < nPoints; i += 3) {
        const h1x = points.get([i, 0]) as number;
        const h1y = points.get([i, 1]) as number;
        const h2x = points.get([i + 1, 0]) as number;
        const h2y = points.get([i + 1, 1]) as number;
        const ax = points.get([i + 2, 0]) as number;
        const ay = points.get([i + 2, 1]) as number;
        ctx.bezierCurveTo(h1x, h1y, h2x, h2y, ax, ay);
      }
    }

    return this;
  }

  setCanvasContextColor(
    ctx: CanvasContext2D,
    rgbas: number[][],
    vmobject: IVMobject,
  ): this {
    if (rgbas.length === 0) return this;

    if (rgbas.length === 1) {
      const [r, g, b, a] = rgbas[0];
      ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
      ctx.strokeStyle = ctx.fillStyle;
    } else {
      // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
      // Gradient support requires get_gradient_start_and_end_points from VMobject
      const [r, g, b, a] = rgbas[0];
      ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
      ctx.strokeStyle = ctx.fillStyle;
    }
    return this;
  }

  applyFill(ctx: CanvasContext2D, vmobject: IVMobject): this {
    const fillRgbas = this.getFillRgbas(vmobject);
    if (fillRgbas.length === 0) return this;
    this.setCanvasContextColor(ctx, fillRgbas, vmobject);
    ctx.fill();
    return this;
  }

  applyStroke(
    ctx: CanvasContext2D,
    vmobject: IVMobject,
    background: boolean = false,
  ): this {
    const width = this.getStrokeWidth(vmobject, background);
    if (width === 0) return this;

    const strokeRgbas = this.getStrokeRgbas(vmobject, background);
    if (strokeRgbas.length === 0) return this;

    this.setCanvasContextColor(ctx, strokeRgbas, vmobject);
    ctx.lineWidth = width * this.cairoLineWidthMultiple;

    // Apply line join/cap if available on vmobject
    if ("jointType" in vmobject) {
      const jt = (vmobject as unknown as { jointType: number }).jointType;
      if (jt !== LineJointType.AUTO) {
        const join = LINE_JOIN_MAP[jt];
        if (join) ctx.lineJoin = join;
      }
    }
    if ("capStyle" in vmobject) {
      const cs = (vmobject as unknown as { capStyle: number }).capStyle;
      if (cs !== CapStyleType.AUTO) {
        const cap = CAP_STYLE_MAP[cs];
        if (cap) ctx.lineCap = cap;
      }
    }

    ctx.stroke();
    return this;
  }

  getStrokeRgbas(vmobject: IVMobject, background: boolean = false): number[][] {
    if ("getStrokeRgbas" in vmobject) {
      return (vmobject as unknown as { getStrokeRgbas(bg: boolean): number[][] }).getStrokeRgbas(background);
    }
    const { r, g, b } = vmobject.strokeColor;
    return [[r, g, b, vmobject.strokeOpacity]];
  }

  getFillRgbas(vmobject: IVMobject): number[][] {
    if ("getFillRgbas" in vmobject) {
      return (vmobject as unknown as { getFillRgbas(): number[][] }).getFillRgbas();
    }
    const { r, g, b } = vmobject.fillColor;
    return [[r, g, b, vmobject.fillOpacity]];
  }

  private getStrokeWidth(vmobject: IVMobject, background: boolean): number {
    if ("getStrokeWidth" in vmobject) {
      return (vmobject as unknown as { getStrokeWidth(bg: boolean): number }).getStrokeWidth(background);
    }
    return vmobject.strokeWidth;
  }

  // ── Background colored VMobject display ──────────────────────

  getBackgroundColoredVmobjectDisplayer(): BackgroundColoredVMobjectDisplayer {
    if (this.backgroundColoredVmobjectDisplayer === null) {
      this.backgroundColoredVmobjectDisplayer = new BackgroundColoredVMobjectDisplayer(this);
    }
    return this.backgroundColoredVmobjectDisplayer;
  }

  displayMultipleBackgroundColoredVmobjects(cvmobjects: IVMobject[]): this {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // Background-colored VMobject display requires pixel array compositing
    const displayer = this.getBackgroundColoredVmobjectDisplayer();
    displayer.display(...cvmobjects);
    return this;
  }

  // ── Point cloud display ──────────────────────────────────────

  displayMultiplePointCloudMobjects(pmobjects: IMobject[]): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // PMobject rendering requires direct pixel manipulation
    for (const _pmobject of pmobjects) {
      // Each PMobject would need its points, rgbas, and stroke_width
      // to render individual pixels on the canvas
    }
  }

  displayPointCloud(
    _pmobject: IMobject,
    _points: NDArray,
    _rgbas: number[][],
    _thickness: number,
  ): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
  }

  // ── Image mobject display ────────────────────────────────────

  displayMultipleImageMobjects(imageMobjects: IMobject[]): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    for (const _imageMobject of imageMobjects) {
      // Image mobject display requires perspective transforms
    }
  }

  displayImageMobject(_imageMobject: IMobject): void {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
  }

  // ── Pixel array compositing ──────────────────────────────────

  overlayRgbaArray(pixelArray: PixelArray, newArray: PixelArray): void {
    // Alpha-composite newArray on top of pixelArray
    const src = newArray.data;
    const dst = pixelArray.data;
    const len = Math.min(src.length, dst.length);
    for (let i = 0; i < len; i += 4) {
      const srcA = src[i + 3] / 255;
      const dstA = dst[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA === 0) continue;
      dst[i] = Math.round((src[i] * srcA + dst[i] * dstA * (1 - srcA)) / outA);
      dst[i + 1] = Math.round((src[i + 1] * srcA + dst[i + 1] * dstA * (1 - srcA)) / outA);
      dst[i + 2] = Math.round((src[i + 2] * srcA + dst[i + 2] * dstA * (1 - srcA)) / outA);
      dst[i + 3] = Math.round(outA * 255);
    }
  }

  // ── Point transforms & coordinate conversion ────────────────

  adjustOutOfRangePoints(points: NDArray): NDArray {
    const nPoints = points.shape[0];
    if (nPoints === 0) return points;

    const result = points.copy();
    for (let i = 0; i < nPoints; i++) {
      const x = result.get([i, 0]) as number;
      const y = result.get([i, 1]) as number;
      const z = result.get([i, 2]) as number;
      const norm = Math.sqrt(x * x + y * y + z * z);
      if (norm > this.maxAllowableNorm) {
        const scale = this.maxAllowableNorm / norm;
        result.set([i, 0], x * scale);
        result.set([i, 1], y * scale);
        result.set([i, 2], z * scale);
      }
    }
    return result;
  }

  transformPointsPreDisplay(_mobject: IMobject, points: NDArray): NDArray {
    // Subclasses (like ThreeDCamera) may want to adjust points further
    const nPoints = points.shape[0];
    if (nPoints === 0) return points;

    // Check for non-finite values
    for (let i = 0; i < nPoints; i++) {
      const x = points.get([i, 0]) as number;
      const y = points.get([i, 1]) as number;
      const z = points.get([i, 2]) as number;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return np.zeros([1, 3]);
      }
    }
    return points;
  }

  pointsToSubpixelCoords(_mobject: IMobject, points: NDArray): NDArray {
    const transformed = this.transformPointsPreDisplay(_mobject, points);
    const nPoints = transformed.shape[0];
    const result = np.zeros([nPoints, 2]);

    const fcx = this.frameCenter.item(0) as number;
    const fcy = this.frameCenter.item(1) as number;
    const widthMult = this.pixelWidth / this.frameWidth;
    const widthAdd = this.pixelWidth / 2;
    const heightMult = -(this.pixelHeight / this.frameHeight); // flip y
    const heightAdd = this.pixelHeight / 2;

    for (let i = 0; i < nPoints; i++) {
      const x = (transformed.get([i, 0]) as number) - fcx;
      const y = (transformed.get([i, 1]) as number) - fcy;
      result.set([i, 0], x * widthMult + widthAdd);
      result.set([i, 1], y * heightMult + heightAdd);
    }
    return result;
  }

  pointsToPixelCoords(
    mobjectOrPoints: IMobject | NDArray,
    points?: NDArray,
  ): NDArray | [number, number][] {
    // Overload: can be called as (mobject, points) or just (points)
    let actualMobject: IMobject | null;
    let actualPoints: NDArray;
    if (points === undefined) {
      actualPoints = mobjectOrPoints as NDArray;
      actualMobject = null;
    } else {
      actualMobject = mobjectOrPoints as IMobject;
      actualPoints = points;
    }
    const subpixel = this.pointsToSubpixelCoords(
      actualMobject as unknown as IMobject,
      actualPoints,
    );
    const nPoints = subpixel.shape[0];
    const result = np.zeros([nPoints, 2]);
    for (let i = 0; i < nPoints; i++) {
      result.set([i, 0], Math.floor(subpixel.get([i, 0]) as number));
      result.set([i, 1], Math.floor(subpixel.get([i, 1]) as number));
    }
    return result;
  }

  onScreenPixels(pixelCoords: NDArray): boolean[] {
    const n = pixelCoords.shape[0];
    const result: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const x = pixelCoords.get([i, 0]) as number;
      const y = pixelCoords.get([i, 1]) as number;
      result.push(
        x >= 0 && x < this.pixelWidth && y >= 0 && y < this.pixelHeight,
      );
    }
    return result;
  }

  adjustedThickness(thickness: number): number {
    const bigSum = config.pixelHeight + config.pixelWidth;
    const thisSum = this.pixelHeight + this.pixelWidth;
    const factor = bigSum / thisSum;
    return 1 + (thickness - 1) * factor;
  }

  getThickeningNudges(thickness: number): Array<[number, number]> {
    const t = Math.floor(thickness);
    const start = -Math.floor(t / 2) + 1;
    const end = Math.floor(t / 2) + 1;
    const nudges: Array<[number, number]> = [];
    for (let i = start; i < end; i++) {
      for (let j = start; j < end; j++) {
        nudges.push([i, j]);
      }
    }
    return nudges;
  }

  thickenedCoordinates(pixelCoords: NDArray, thickness: number): NDArray {
    const nudges = this.getThickeningNudges(thickness);
    const nCoords = pixelCoords.shape[0];
    const totalCoords = nCoords * nudges.length;
    const result = np.zeros([totalCoords, 2]);
    let idx = 0;
    for (const [di, dj] of nudges) {
      for (let i = 0; i < nCoords; i++) {
        result.set([idx, 0], (pixelCoords.get([i, 0]) as number) + di);
        result.set([idx, 1], (pixelCoords.get([i, 1]) as number) + dj);
        idx++;
      }
    }
    return result;
  }

  getCoordsOfAllPixels(): NDArray {
    const fw = this.frameWidth;
    const fh = this.frameHeight;
    const pw = this.pixelWidth;
    const ph = this.pixelHeight;

    const result = np.zeros([ph, pw, 2]);
    for (let row = 0; row < ph; row++) {
      for (let col = 0; col < pw; col++) {
        const x = (col / pw) * fw - fw / 2;
        const y = -((row / ph) * fh - fh / 2);
        result.set([row, col, 0], x);
        result.set([row, col, 1], y);
      }
    }
    return result;
  }

  // ── Coordinate conversion helpers (preserved from stub) ─────

  worldToPixel(worldPoint: Point3D): [number, number] {
    const cx = this.frameCenter.item(0) as number;
    const cy = this.frameCenter.item(1) as number;
    const wx = worldPoint.item(0) as number;
    const wy = worldPoint.item(1) as number;

    const frameLeft = cx - this.frameWidth / 2;
    const frameTop = cy + this.frameHeight / 2;

    const px = ((wx - frameLeft) / this.frameWidth) * this.pixelWidth;
    const py = ((frameTop - wy) / this.frameHeight) * this.pixelHeight;

    return [px, py];
  }

  pixelToWorld(pixelX: number, pixelY: number): Point3D {
    const cx = this.frameCenter.item(0) as number;
    const cy = this.frameCenter.item(1) as number;

    const frameLeft = cx - this.frameWidth / 2;
    const frameTop = cy + this.frameHeight / 2;

    const wx = frameLeft + (pixelX / this.pixelWidth) * this.frameWidth;
    const wy = frameTop - (pixelY / this.pixelHeight) * this.frameHeight;

    return np.array([wx, wy, 0]);
  }

  // ── Frame boundary helpers ──────────────────────────────────

  getPixelsPerUnit(): number {
    return this.pixelWidth / this.frameWidth;
  }

  getFrameLeft(): number {
    return (this.frameCenter.item(0) as number) - this.frameWidth / 2;
  }

  getFrameRight(): number {
    return (this.frameCenter.item(0) as number) + this.frameWidth / 2;
  }

  getFrameTop(): number {
    return (this.frameCenter.item(1) as number) + this.frameHeight / 2;
  }

  getFrameBottom(): number {
    return (this.frameCenter.item(1) as number) - this.frameHeight / 2;
  }

  getAspectRatio(): number {
    return this.pixelWidth / this.pixelHeight;
  }

  // ── Buffer export ───────────────────────────────────────────

  toBuffer(format: "image/png" | "image/jpeg" = "image/png"): Buffer | string {
    // Node: returns a Buffer via @napi-rs/canvas toBuffer
    if (typeof (this._canvas as any).toBuffer === "function") {
      return (this._canvas as any).toBuffer(format);
    }
    // Browser: returns a data URL string
    return (this._canvas as any).toDataURL(format);
  }

  // ── Resize ──────────────────────────────────────────────────

  resize(pixelWidth: number, pixelHeight: number): void {
    this.pixelWidth = pixelWidth;
    this.pixelHeight = pixelHeight;
    this._canvas = createCanvas(pixelWidth, pixelHeight);
    this._ctx = getContext2D(this._canvas) as CanvasContext2D & Record<string, any>;
  }
}

// ─── BackgroundColoredVMobjectDisplayer ───────────────────────

export class BackgroundColoredVMobjectDisplayer {
  camera: Camera;
  fileNameToPixelArrayMap: Map<string, PixelArray>;
  pixelArray: PixelArray;

  constructor(camera: Camera) {
    this.camera = camera;
    this.fileNameToPixelArrayMap = new Map();
    this.pixelArray = copyPixelArray(camera.pixelArray);
    this.resetPixelArray();
  }

  resetPixelArray(): void {
    this.pixelArray.data.fill(0);
  }

  resizeBackgroundArray(
    backgroundArray: PixelArray,
    newWidth: number,
    newHeight: number,
  ): PixelArray {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // Requires image resizing via sharp
    return createPixelArray(newWidth, newHeight, backgroundArray.channels);
  }

  resizeBackgroundArrayToMatch(
    backgroundArray: PixelArray,
    pixelArray: PixelArray,
  ): PixelArray {
    return this.resizeBackgroundArray(
      backgroundArray,
      pixelArray.width,
      pixelArray.height,
    );
  }

  getBackgroundArray(image: string): PixelArray {
    const imageKey = String(image);

    const cached = this.fileNameToPixelArrayMap.get(imageKey);
    if (cached) return cached;

    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // Loading background images requires async sharp operations
    const backArray = createPixelArray(
      this.pixelArray.width,
      this.pixelArray.height,
      this.pixelArray.channels,
    );

    if (
      backArray.width !== this.pixelArray.width ||
      backArray.height !== this.pixelArray.height
    ) {
      const resized = this.resizeBackgroundArrayToMatch(backArray, this.pixelArray);
      this.fileNameToPixelArrayMap.set(imageKey, resized);
      return resized;
    }

    this.fileNameToPixelArrayMap.set(imageKey, backArray);
    return backArray;
  }

  display(...cvmobjects: IVMobject[]): PixelArray | null {
    // TODO: Port from Cairo/OpenGL — needs manual rendering implementation
    // Full implementation requires pixel array compositing with background images
    let currArray: PixelArray | null = null;

    let currentImage: string | null = null;
    let currentBatch: IVMobject[] = [];

    const processBatch = (): void => {
      if (currentBatch.length === 0 || currentImage === null) return;
      const backgroundArray = this.getBackgroundArray(currentImage);
      this.camera.displayMultipleNonBackgroundColoredVmobjects(currentBatch);
      // Composite: new_array = background * pixel / 255
      const newArray = createPixelArray(
        this.pixelArray.width,
        this.pixelArray.height,
        this.pixelArray.channels,
      );
      for (let i = 0; i < newArray.data.length; i++) {
        newArray.data[i] = Math.round(
          (backgroundArray.data[i] * this.pixelArray.data[i]) / 255,
        );
      }
      if (currArray === null) {
        currArray = newArray;
      } else {
        // Take max of current and new
        for (let i = 0; i < currArray.data.length; i++) {
          currArray.data[i] = Math.max(currArray.data[i], newArray.data[i]);
        }
      }
      this.resetPixelArray();
    };

    for (const vm of cvmobjects) {
      const image = ("getBackgroundImage" in vm)
        ? (vm as unknown as { getBackgroundImage(): string | null }).getBackgroundImage()
        : null;
      if (image !== currentImage) {
        processBatch();
        currentImage = image;
        currentBatch = [vm];
      } else {
        currentBatch.push(vm);
      }
    }
    processBatch();

    return currArray;
  }
}
