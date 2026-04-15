/**
 * CairoBackend — browser Canvas2D implementation of SceneBackend.
 *
 * Renders VMobjects via the W3C CanvasRenderingContext2D API (cubic Bezier
 * paths with fill/stroke). For 3D mobjects, projects points through
 * ThreeDCamera before drawing (matching ManimCE's Cairo 3D path).
 *
 * Browser-only — no Node-only imports.
 */

import type { IMobject, IVMobject, ICamera, IColor, ManimConfig } from "../../core/types.js";
import type { NDArray } from "numpy-ts";
import type { SceneBackend } from "../scene_backend.js";
import type { ThreeDCamera } from "../../camera/three_d_camera/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isVMobject(mob: IMobject): mob is IVMobject {
  const m = mob as unknown as Record<string, unknown>;
  return m.points !== undefined && m.fillColor !== undefined && m.strokeColor !== undefined;
}

interface IImageMobject extends IMobject {
  pixelArray: NDArray;
  points: NDArray;
  resamplingAlgorithm?: string;
}

function isImageMobject(mob: IMobject): mob is IImageMobject {
  const m = mob as unknown as Record<string, unknown>;
  return m.pixelArray !== undefined && m.points !== undefined && !isVMobject(mob);
}

function isThreeDCamera(camera: ICamera): camera is ThreeDCamera {
  const c = camera as unknown as Record<string, unknown>;
  return typeof c.projectPoints === "function";
}

function hasGetMobjectsToDisplay(
  camera: ICamera,
): camera is ICamera & {
  getMobjectsToDisplay: (
    mobjects: Iterable<IMobject>,
    includeSubmobjects?: boolean,
    excludedMobjects?: IMobject[],
  ) => IMobject[];
} {
  return typeof (camera as unknown as Record<string, unknown>).getMobjectsToDisplay === "function";
}

function colorToCss(c: IColor, opacityOverride?: number): string {
  const a = opacityOverride ?? c.a;
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

interface CameraTransform {
  frameLeft: number;
  frameTop: number;
  scaleX: number;
  scaleY: number;
}

function computeCameraTransform(camera: ICamera): CameraTransform {
  const center = camera.getFrameCenter();
  const cx = center.item(0) as number;
  const cy = center.item(1) as number;
  return {
    frameLeft: cx - camera.frameWidth / 2,
    frameTop: cy + camera.frameHeight / 2,
    scaleX: camera.pixelWidth / camera.frameWidth,
    scaleY: camera.pixelHeight / camera.frameHeight,
  };
}

function worldToPixel(
  t: CameraTransform,
  wx: number,
  wy: number,
): [number, number] {
  return [
    (wx - t.frameLeft) * t.scaleX,
    (t.frameTop - wy) * t.scaleY,
  ];
}

// ---------------------------------------------------------------------------
// CairoBackend
// ---------------------------------------------------------------------------

export interface CairoBackendOptions {
  canvas: HTMLCanvasElement;
  frameWidth?: number;
  frameHeight?: number;
  config?: Partial<ManimConfig>;
}

export class CairoBackend implements SceneBackend {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;
  private readonly _mobjects: Set<IMobject> = new Set();

  private _frameWidth: number;
  private _frameHeight: number;
  private _bgColor: IColor | null;
  private _camera: ICamera | null = null;
  private _dpr: number;

  constructor(options: CairoBackendOptions) {
    this._canvas = options.canvas;
    const ctx = options.canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context from canvas");
    this._ctx = ctx;

    this._frameWidth = options.frameWidth ?? options.config?.frameWidth ?? 14.222;
    this._frameHeight = options.frameHeight ?? options.config?.frameHeight ?? 8.0;
    this._bgColor = (options.config?.backgroundColor as IColor | undefined) ?? null;

    this._dpr = typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
    this._applyDpr();
  }

  // ── SceneBackend interface ────────────────────────────────────

  addMobject(m: IMobject): void {
    this._mobjects.add(m);
  }

  removeMobject(m: IMobject): void {
    this._mobjects.delete(m);
  }

  sync(): void {
    // No-op: Canvas2D is immediate-mode, nothing to sync.
  }

  render(): void {
    this._clear();
    const family = this._collectSortedFamily();
    const cam = this._camera;
    const t = this._buildTransform();

    for (const mob of family) {
      if (isVMobject(mob)) {
        this._renderVMobject(mob, t, cam);
      } else if (isImageMobject(mob)) {
        this._renderImageMobject(mob, t);
      }
    }
  }

  resize(width: number, height: number): void {
    this._canvas.width = Math.round(width * this._dpr);
    this._canvas.height = Math.round(height * this._dpr);
    this._canvas.style.width = `${width}px`;
    this._canvas.style.height = `${height}px`;
    this._applyDpr();
  }

  dispose(): void {
    this._mobjects.clear();
    this._camera = null;
  }

  // ── Extended API ──────────────────────────────────────────────

  setCamera(camera: ICamera): void {
    this._camera = camera;
    this._frameWidth = camera.frameWidth;
    this._frameHeight = camera.frameHeight;
  }

  setBackgroundColor(color: IColor): void {
    this._bgColor = color;
  }

  // ── Private ───────────────────────────────────────────────────

  private _applyDpr(): void {
    this._dpr = typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
  }

  private _clear(): void {
    const w = this._canvas.width / this._dpr;
    const h = this._canvas.height / this._dpr;

    if (this._bgColor) {
      this._ctx.fillStyle = colorToCss(this._bgColor);
      this._ctx.fillRect(0, 0, w, h);
    } else {
      this._ctx.clearRect(0, 0, w, h);
    }
  }

  private _collectSortedFamily(): IMobject[] {
    // Mirror Python Manim: each added mobject expands to its full family so
    // that submobjects (arrow tips, dashes, tick marks, etc.) paint without
    // the caller having to pre-flatten. Without this, things like
    // DashedLine (whose visible geometry lives entirely in submobjects)
    // render nothing.
    //
    // When a ThreeDCamera is active, defer to its getMobjectsToDisplay so
    // sub-surfaces are painted back-to-front by view-space z (1:1 with
    // Python Manim's Cairo + ThreeDCamera pipeline). Otherwise sort by
    // zIndex only.
    if (this._camera && hasGetMobjectsToDisplay(this._camera)) {
      return this._camera.getMobjectsToDisplay([...this._mobjects], false);
    }
    const family: IMobject[] = [];
    const seen = new Set<IMobject>();
    for (const m of this._mobjects) {
      const expanded = this._expandFamily(m);
      for (const mob of expanded) {
        if (!seen.has(mob)) {
          seen.add(mob);
          family.push(mob);
        }
      }
    }
    family.sort((a, b) => a.zIndex - b.zIndex);
    return family;
  }

  private _expandFamily(mob: IMobject): IMobject[] {
    const fn = (mob as unknown as { getFamily?: (recurse?: boolean) => IMobject[] }).getFamily;
    if (typeof fn === "function") {
      try {
        return fn.call(mob, true);
      } catch {
        return [mob];
      }
    }
    return [mob];
  }

  private _buildTransform(): CameraTransform {
    if (this._camera) {
      return computeCameraTransform(this._camera);
    }
    const cssW = this._canvas.width / this._dpr;
    const cssH = this._canvas.height / this._dpr;
    return {
      frameLeft: -this._frameWidth / 2,
      frameTop: this._frameHeight / 2,
      scaleX: cssW / this._frameWidth,
      scaleY: cssH / this._frameHeight,
    };
  }

  private _renderVMobject(
    mob: IVMobject,
    t: CameraTransform,
    camera: ICamera | null,
  ): void {
    let subpaths = mob.getSubpaths();
    if (subpaths.length === 0) return;

    if (camera && isThreeDCamera(camera)) {
      subpaths = subpaths.map((sp) => camera.projectPoints(sp));
    }

    const ctx = this._ctx;
    ctx.save();
    ctx.beginPath();

    for (const subpath of subpaths) {
      const nPoints = subpath.shape[0];
      if (nPoints < 4) continue;

      const [x0, y0] = worldToPixel(
        t,
        subpath.get([0, 0]) as number,
        subpath.get([0, 1]) as number,
      );
      ctx.moveTo(x0, y0);

      const segCount = Math.floor((nPoints - 1) / 3);
      for (let i = 0; i < segCount; i++) {
        const b = i * 3;
        const [cp1x, cp1y] = worldToPixel(
          t,
          subpath.get([b + 1, 0]) as number,
          subpath.get([b + 1, 1]) as number,
        );
        const [cp2x, cp2y] = worldToPixel(
          t,
          subpath.get([b + 2, 0]) as number,
          subpath.get([b + 2, 1]) as number,
        );
        const [ex, ey] = worldToPixel(
          t,
          subpath.get([b + 3, 0]) as number,
          subpath.get([b + 3, 1]) as number,
        );
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
      }
    }

    if (mob.fillOpacity > 0) {
      ctx.fillStyle = colorToCss(mob.fillColor, mob.fillOpacity);
      ctx.fill("evenodd");
    }

    if (mob.strokeOpacity > 0 && mob.strokeWidth > 0) {
      ctx.strokeStyle = colorToCss(mob.strokeColor, mob.strokeOpacity);
      // Match Python Manim's Cairo conversion: user-space line width =
      // stroke_width * CAIRO_LINE_WIDTH_MULTIPLE (0.01) in frame units,
      // then Cairo scales to device pixels via pixels_per_frame_unit.
      // Our ctx is already in CSS-pixel space, so we do the conversion
      // explicitly using t.scaleX (CSS px per frame unit).
      // Reference: manim/camera/camera.py CAIRO_LINE_WIDTH_MULTIPLE = 0.01.
      ctx.lineWidth = mob.strokeWidth * 0.01 * t.scaleX;
      // Match Python Manim's Cairo defaults: the camera only overrides
      // cap/join when the vmobject explicitly sets them (cap_style != AUTO
      // / joint_type != AUTO). Otherwise Cairo's native defaults — BUTT
      // caps and MITER joins — apply. Canvas2D's defaults are "butt" and
      // "miter" too, so we set them explicitly in case prior state leaked in.
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      ctx.stroke();
    }

    ctx.restore();
  }

  private _renderImageMobject(mob: IImageMobject, t: CameraTransform): void {
    const pix = mob.pixelArray;
    const shape = pix.shape as number[];
    if (shape.length !== 3 || shape[2] !== 4) return;
    const h = shape[0];
    const w = shape[1];

    // Build a source canvas from pixel data (RGBA, uint8).
    const src = document.createElement("canvas");
    src.width = w;
    src.height = h;
    const sctx = src.getContext("2d");
    if (!sctx) return;
    const imageData = sctx.createImageData(w, h);
    const flat = pix.flatten().toArray() as number[];
    for (let i = 0; i < flat.length; i++) imageData.data[i] = flat[i];
    sctx.putImageData(imageData, 0, 0);

    // Corners (world space): UL=points[0], UR=points[1], LR=points[3].
    const ul = [mob.points.get([0, 0]) as number, mob.points.get([0, 1]) as number];
    const ur = [mob.points.get([1, 0]) as number, mob.points.get([1, 1]) as number];
    const lr = [mob.points.get([3, 0]) as number, mob.points.get([3, 1]) as number];
    const [ulx, uly] = worldToPixel(t, ul[0], ul[1]);
    const [urx, ury] = worldToPixel(t, ur[0], ur[1]);
    const [lrx, lry] = worldToPixel(t, lr[0], lr[1]);

    // Affine map: source (0..w, 0..h) → image parallelogram (ul, ur, lr).
    // a = (ur-ul)/w, b = (lr-ur)/h
    const ax = (urx - ulx) / w;
    const ay = (ury - uly) / w;
    const bx = (lrx - urx) / h;
    const by = (lry - ury) / h;

    const ctx = this._ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = (mob.resamplingAlgorithm ?? "bicubic") !== "nearest";
    ctx.setTransform(
      this._dpr * ax,
      this._dpr * ay,
      this._dpr * bx,
      this._dpr * by,
      this._dpr * ulx,
      this._dpr * uly,
    );
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    // Restore DPR base transform for subsequent draws.
    this._applyDpr();
  }
}
