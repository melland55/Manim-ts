/**
 * Canvas factory — environment-agnostic canvas creation.
 *
 * In Node.js, uses `canvas` (node-canvas, libcairo + Pango bindings) so the
 * rasterizer matches Python Manim's pycairo byte-for-byte. This enables
 * strict pixel-diffing against Python Manim golden images.
 * In the browser, uses the built-in HTMLCanvasElement (Skia via Chromium).
 *
 * Both return a standard Canvas2D interface, so all rendering code
 * works identically in either environment.
 */

/** Minimal canvas interface satisfied by both HTMLCanvasElement and @napi-rs/canvas. */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasContext2D | null;
  toDataURL?(type?: string, quality?: number): string;
}

/** Minimal 2D context interface — the subset of CanvasRenderingContext2D we actually use. */
export interface CanvasContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  globalAlpha: number;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  fill(fillRule?: CanvasFillRule): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  rotate(angle: number): void;
  drawImage(image: any, dx: number, dy: number, dw?: number, dh?: number): void;
  getImageData?(sx: number, sy: number, sw: number, sh: number): { data: Uint8ClampedArray; width: number; height: number };
  putImageData?(imageData: any, dx: number, dy: number): void;
}

/** Whether we're running in a browser environment. */
export const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

/** Cached reference to node-canvas createCanvas (loaded lazily in Node). */
let _nodeCreateCanvas: ((w: number, h: number) => any) | null = null;

/**
 * Create a canvas of the given dimensions.
 *
 * - Browser: creates an HTMLCanvasElement
 * - Node.js: uses `canvas` (node-canvas, libcairo)
 */
export function createCanvas(width: number, height: number): CanvasLike {
  if (isBrowser) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c as unknown as CanvasLike;
  }

  // Node.js — lazy-load node-canvas (libcairo binding)
  if (!_nodeCreateCanvas) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodeCanvas = require("canvas");
      _nodeCreateCanvas = nodeCanvas.createCanvas;
    } catch {
      throw new Error(
        "No canvas implementation available. " +
        "Install `canvas` (node-canvas) for Node.js, or run in a browser."
      );
    }
  }

  return _nodeCreateCanvas!(width, height) as unknown as CanvasLike;
}

/**
 * Get the 2D context from a canvas.
 * Throws if the context cannot be created.
 */
export function getContext2D(canvas: CanvasLike): CanvasContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2d context from canvas");
  return ctx;
}
