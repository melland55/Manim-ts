/**
 * Renderer — converts a scene's mobject hierarchy into 2D canvas pixels.
 *
 * Replaces Python Manim's Cairo / OpenGL back-ends with the Canvas2D API.
 * In Node.js, initialise with initWithNodeCanvas() (@napi-rs/canvas).
 * In the browser, initialise with init() (HTMLCanvasElement / OffscreenCanvas).
 *
 * Implements IRenderer from src/core/types.ts.
 */

import type { CanvasLike } from "../core/canvas-factory.js";
import type {
  IRenderer,
  IScene,
  IColor,
  IMobject,
  ICamera,
  IVMobject,
} from "../core/types.js";

// ---------------------------------------------------------------------------
// Internal Canvas2D abstraction
// ---------------------------------------------------------------------------

/**
 * Minimal Canvas2D drawing interface.
 * Both the browser's CanvasRenderingContext2D and @napi-rs/canvas satisfy this
 * contract — we only use string-valued style assignments, so we narrow the
 * fillStyle/strokeStyle union to string.
 */
interface Canvas2D {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ): void;
  closePath(): void;
  fill(fillRule?: CanvasFillRule): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Runtime check that a mobject satisfies IVMobject (has bezier path data). */
function isVMobject(mob: IMobject): mob is IVMobject {
  return "points" in mob && "fillColor" in mob && "strokeColor" in mob;
}

/** Convert an IColor to a CSS rgba() string. */
function colorToCss(c: IColor): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
}

/**
 * Pre-computed camera transform for fast world→pixel conversion.
 * Avoids per-point NDArray allocations in the hot render loop.
 */
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

/** Convert world coords to pixel coords using pre-computed transform. */
function worldToPixelFast(
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
// Renderer
// ---------------------------------------------------------------------------

/**
 * Renderer class — the single entry-point for turning a scene graph into
 * rasterised pixels.
 *
 * Usage (Node.js):
 * ```typescript
 * import { createCanvas } from "canvas";
 * const canvas = createCanvas(1920, 1080);
 * const renderer = new Renderer();
 * renderer.initWithNodeCanvas(canvas);
 * renderer.render(scene);
 * ```
 *
 * Usage (browser):
 * ```typescript
 * const canvas = document.getElementById("canvas") as HTMLCanvasElement;
 * const renderer = new Renderer();
 * renderer.init(canvas);
 * renderer.render(scene);
 * ```
 *
 * @deprecated Use {@link ThreeRenderer} from `src/renderer/three/` instead.
 * This Canvas2D back-end is retained only for server-side video export via
 * `@napi-rs/canvas`; all interactive and browser rendering is now handled by
 * `ThreeRenderer` / `ThreeScene`.
 */
export class Renderer implements IRenderer {
  private _ctx: Canvas2D | null = null;
  private _width: number = 0;
  private _height: number = 0;

  // ── IRenderer interface ──────────────────────────────────────

  /**
   * Attach the renderer to a browser canvas (HTMLCanvasElement or
   * OffscreenCanvas).  In Node.js, prefer initWithNodeCanvas() instead.
   *
   * TODO: Port from Cairo/OpenGL — needs manual rendering implementation
   */
  init(canvas: HTMLCanvasElement | OffscreenCanvas): void {
    this._ctx = canvas.getContext("2d") as unknown as Canvas2D;
    this._width = canvas.width;
    this._height = canvas.height;
  }

  /**
   * Render the full scene: clear the background then render all mobjects
   * in depth-first family order, sorted ascending by zIndex.
   */
  render(scene: IScene): void {
    this.clear(scene.camera.backgroundColor);

    const mobs: IMobject[] = scene.mobjects.flatMap((m) =>
      m.getFamily(true)
    );
    mobs.sort((a, b) => a.zIndex - b.zIndex);

    for (const mob of mobs) {
      this.renderMobject(mob, scene.camera);
    }
  }

  /**
   * Fill the entire canvas with a solid background color.
   */
  clear(color: IColor): void {
    if (!this._ctx) return;
    this._ctx.save();
    this._ctx.fillStyle = colorToCss(color);
    this._ctx.fillRect(0, 0, this._width, this._height);
    this._ctx.restore();
  }

  /**
   * Render a single mobject onto the canvas.
   *
   * VMobjects are drawn as Bezier paths with fill and stroke.
   * Non-VMobjects (container groups etc.) have no visual geometry and are
   * silently skipped — their children are rendered by the render() loop.
   */
  renderMobject(mob: IMobject, camera: ICamera): void {
    if (!this._ctx) return;
    if (isVMobject(mob)) {
      this._renderVMobject(mob, camera);
    }
  }

  // ── Node.js canvas support ───────────────────────────────────

  /**
   * Attach the renderer to an @napi-rs/canvas Canvas instance.
   * Use this in Node.js instead of init().
   */
  initWithNodeCanvas(canvas: CanvasLike): void {
    this._ctx = canvas.getContext("2d") as unknown as Canvas2D;
    this._width = canvas.width;
    this._height = canvas.height;
  }

  // ── Accessors ────────────────────────────────────────────────

  /** True once the renderer has been attached to a canvas. */
  get isInitialized(): boolean {
    return this._ctx !== null;
  }

  /** Canvas pixel width (0 before initialisation). */
  get width(): number {
    return this._width;
  }

  /** Canvas pixel height (0 before initialisation). */
  get height(): number {
    return this._height;
  }

  // ── Private rendering helpers ────────────────────────────────

  /**
   * Render a VMobject as a set of Bezier subpaths using Canvas2D.
   *
   * Manim VMobject point layout (n = 3k+1 per subpath):
   *   anchor₀, ctrl1₀, ctrl2₀, anchor₁, ctrl1₁, ctrl2₁, anchor₂, …
   *
   * Each cubic segment occupies indices [3i … 3i+3].
   *
   * TODO: Port from Cairo/OpenGL — needs manual rendering implementation for
   * full visual fidelity (dash patterns, line joins, caps, gradients, etc.)
   */
  private _renderVMobject(mob: IVMobject, camera: ICamera): void {
    const ctx = this._ctx!;
    const subpaths = mob.getSubpaths();
    if (subpaths.length === 0) return;

    // Pre-compute the camera transform once per mobject (not per point)
    const t = computeCameraTransform(camera);

    ctx.save();
    ctx.beginPath();

    for (const subpath of subpaths) {
      const nPoints = subpath.shape[0];
      if (nPoints < 4) continue;

      // Read raw numbers directly — no temporary NDArray allocations
      const [x0, y0] = worldToPixelFast(
        t,
        subpath.get([0, 0]) as number,
        subpath.get([0, 1]) as number,
      );
      ctx.moveTo(x0, y0);

      const segCount = Math.floor((nPoints - 1) / 3);
      for (let i = 0; i < segCount; i++) {
        const b = i * 3;
        const [cp1x, cp1y] = worldToPixelFast(t, subpath.get([b + 1, 0]) as number, subpath.get([b + 1, 1]) as number);
        const [cp2x, cp2y] = worldToPixelFast(t, subpath.get([b + 2, 0]) as number, subpath.get([b + 2, 1]) as number);
        const [ex, ey] = worldToPixelFast(t, subpath.get([b + 3, 0]) as number, subpath.get([b + 3, 1]) as number);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
      }
      ctx.closePath();
    }

    if (mob.fillOpacity > 0) {
      const { r, g, b } = mob.fillColor;
      ctx.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${mob.fillOpacity})`;
      ctx.fill("evenodd");
    }

    if (mob.strokeOpacity > 0 && mob.strokeWidth > 0) {
      const { r, g, b } = mob.strokeColor;
      ctx.strokeStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${mob.strokeOpacity})`;
      // stroke_width in Manim is already in screen-space pixels (not world units)
      ctx.lineWidth = mob.strokeWidth;
      ctx.stroke();
    }

    ctx.restore();
  }
}
