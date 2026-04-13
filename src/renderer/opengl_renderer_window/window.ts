/**
 * TypeScript port of manim/renderer/opengl_renderer_window.py
 *
 * The Python original extends PygletWindow from moderngl_window, which manages
 * an OS-level OpenGL window via Pyglet. In the TypeScript port, Window is a
 * standalone class that owns the canvas/context and wires up DOM or Node.js
 * input events, delegating to the renderer and scene exactly as the Python
 * version does.
 *
 * OpenGL context creation and buffer-swapping are marked TODO — those require
 * a WebGL2 or headless-gl implementation.
 */

import type { Point3D } from "../../core/types.js";

/** Monitor geometry — mirrors screeninfo.Monitor fields used by Manim. */
export interface MonitorInfo {
  /** Left edge of the monitor in desktop coordinates. */
  x: number;
  /** Top edge of the monitor in desktop coordinates. */
  y: number;
  width: number;
  height: number;
}

/** Scene interface for the event callbacks the Window dispatches to. */
export interface IWindowScene {
  onMouseMotion(point: Point3D, dPoint: Point3D): void;
  onMouseScroll(point: Point3D, offset: Point3D): void;
  onKeyPress(symbol: number, modifiers: number): void;
  onKeyRelease(symbol: number, modifiers: number): void;
  onMouseDrag(
    point: Point3D,
    dPoint: Point3D,
    buttons: number,
    modifiers: number,
  ): void;
  onMousePress(point: Point3D, button: string, modifiers: number): void;
}

/**
 * Minimal interface for the OpenGLRenderer dependency.
 * Defined here to break the circular dependency between window ↔ renderer.
 */
export interface IOpenGLRenderer {
  pressedKeys: Set<number>;
  scene: IWindowScene;
  pixelCoordsToSpaceCoords(x: number, y: number, relative?: boolean): Point3D;
}

/** Window-specific configuration (extends the base ManimConfig fields used here). */
export interface WindowOptions {
  /** Monitor index to display the window on. Default: 0. */
  windowMonitor?: number;
  /** Whether the window starts fullscreen. Default: false. */
  fullscreen?: boolean;
  /** Logical frame height in Manim units. Default: 8.0. */
  frameHeight?: number;
  /** Logical frame width in Manim units. Default: 14.222. */
  frameWidth?: number;
  /**
   * Desired window position. Accepts:
   *   - "UR" / "OO" / "DL" etc. (Y-axis char then X-axis char, each L/U/O/R/D)
   *   - "LEFT" | "RIGHT" | "UP" | "DOWN" | "ORIGIN"
   *   - "y,x" integer coordinates
   * Default: "OO" (centered).
   */
  windowPosition?: string;
}

const INVALID_WINDOW_SIZE_MSG =
  "window_size must be specified either as 'default', a string of the form " +
  "'width,height', or a tuple of 2 ints of the form (width, height).";

const MOUSE_BUTTON_MAP: Record<number, string> = {
  1: "LEFT",
  2: "MOUSE",
  4: "RIGHT",
};

// Manim version string shown in the window title.
const MANIM_VERSION = "0.18.1";

/**
 * Interactive rendering window — TypeScript port of Python's Window(PygletWindow).
 *
 * Owns window geometry and routes OS input events (mouse / keyboard) to the
 * renderer's scene using the same method names as the Python version.
 */
export class Window {
  /** Window is not fullscreen by default. */
  static readonly fullscreen = false;
  /** Window can be resized. */
  static readonly resizable = true;
  /** Minimum OpenGL version required. */
  static readonly glVersion: [number, number] = [3, 3];
  /** Vertical sync enabled. */
  static readonly vsync = true;
  /** Cursor visible by default. */
  static readonly cursor = true;

  readonly title: string;
  readonly size: [number, number];
  readonly renderer: IOpenGLRenderer;

  /** Current window position in desktop coordinates [x, y]. */
  position: [number, number];

  private readonly windowPosition: string;

  // TODO: Port from OpenGL — needs manual rendering implementation
  // Store the WebGL2 context / headless-gl context here once implemented.

  constructor(
    renderer: IOpenGLRenderer,
    windowSize: string | [number, number] = "default",
    options: WindowOptions = {},
  ) {
    const {
      windowMonitor = 0,
      fullscreen = false,
      frameHeight = 8.0,
      frameWidth = 14.222,
      windowPosition = "OO",
    } = options;

    this.renderer = renderer;
    this.windowPosition = windowPosition;

    const monitor = Window.getMonitor(windowMonitor);
    const size = Window.computeSize(windowSize, monitor, {
      fullscreen,
      frameHeight,
      frameWidth,
    });

    this.title = `Manim Community v${MANIM_VERSION}`;
    this.size = size;

    // TODO: Port from OpenGL — needs manual rendering implementation
    // super().__init__(size=size) → create WebGL2 context on a canvas
    // mglw.activate_context(window=self) → bind context
    // self.timer.start() → start animation timer
    // self.swap_buffers() → present first frame

    this.position = this.findInitialPosition(size, monitor);
  }

  // ─── Static helpers ─────────────────────────────────────────────────────────

  /**
   * Returns the geometry of the monitor at `index`.
   * Falls back to screen dimensions via the browser's `window.screen`, or
   * to a 1920×1080 default in headless (Node.js) environments.
   */
  static getMonitor(index: number): MonitorInfo {
    if (typeof screen !== "undefined") {
      // Browser environment — single logical screen exposed by the API.
      // Multi-monitor enumeration is not available without the Screen Capture API.
      return {
        x: typeof screenX !== "undefined" ? screenX : 0,
        y: typeof screenY !== "undefined" ? screenY : 0,
        width: screen.width,
        height: screen.height,
      };
    }
    // Node.js / headless fallback.
    void index;
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }

  /**
   * Resolves the window size from the caller-supplied value.
   * Mirrors the Python constructor's size-parsing block exactly.
   */
  static computeSize(
    windowSize: string | [number, number],
    monitor: MonitorInfo,
    cfg: { fullscreen: boolean; frameHeight: number; frameWidth: number },
  ): [number, number] {
    if (Array.isArray(windowSize)) {
      if (windowSize.length !== 2) {
        throw new Error(INVALID_WINDOW_SIZE_MSG);
      }
      return [windowSize[0], windowSize[1]];
    }

    if (windowSize === "default") {
      let windowWidth = monitor.width;
      if (!cfg.fullscreen) {
        windowWidth = Math.floor(windowWidth / 2);
      }
      // by default window_height = frame_height / frame_width * window_width
      const windowHeight = Math.floor(
        (windowWidth * cfg.frameHeight) / cfg.frameWidth,
      );
      return [windowWidth, windowHeight];
    }

    // "width,height" string form
    const parts = windowSize.split(",");
    if (parts.length === 2) {
      const w = parseInt(parts[0], 10);
      const h = parseInt(parts[1], 10);
      if (isNaN(w) || isNaN(h)) {
        throw new Error(INVALID_WINDOW_SIZE_MSG);
      }
      return [w, h];
    }

    throw new Error(INVALID_WINDOW_SIZE_MSG);
  }

  // ─── Event handlers — delegate to scene ─────────────────────────────────────

  onMouseMotion(x: number, y: number, dx: number, dy: number): void {
    const point = this.renderer.pixelCoordsToSpaceCoords(x, y);
    const dPoint = this.renderer.pixelCoordsToSpaceCoords(dx, dy, true);
    this.renderer.scene.onMouseMotion(point, dPoint);
  }

  onMouseScroll(
    x: number,
    y: number,
    xOffset: number,
    yOffset: number,
  ): void {
    const point = this.renderer.pixelCoordsToSpaceCoords(x, y);
    const offset = this.renderer.pixelCoordsToSpaceCoords(xOffset, yOffset, true);
    this.renderer.scene.onMouseScroll(point, offset);
  }

  onKeyPress(symbol: number, modifiers: number): boolean {
    this.renderer.pressedKeys.add(symbol);
    // Return value mirrors PygletWindow.on_key_press — true means handled.
    const eventHandled = true;
    this.renderer.scene.onKeyPress(symbol, modifiers);
    return eventHandled;
  }

  onKeyRelease(symbol: number, modifiers: number): void {
    this.renderer.pressedKeys.delete(symbol);
    this.renderer.scene.onKeyRelease(symbol, modifiers);
  }

  onMouseDrag(
    x: number,
    y: number,
    dx: number,
    dy: number,
    buttons: number,
    modifiers: number,
  ): void {
    const point = this.renderer.pixelCoordsToSpaceCoords(x, y);
    const dPoint = this.renderer.pixelCoordsToSpaceCoords(dx, dy, true);
    this.renderer.scene.onMouseDrag(point, dPoint, buttons, modifiers);
  }

  onMousePress(x: number, y: number, button: number, modifiers: number): void {
    const point = this.renderer.pixelCoordsToSpaceCoords(x, y);
    const buttonName = MOUSE_BUTTON_MAP[button] ?? "UNKNOWN";
    this.renderer.scene.onMousePress(point, buttonName, modifiers);
  }

  // ─── Positioning ────────────────────────────────────────────────────────────

  /**
   * Computes the initial top-left desktop position for the window.
   *
   * Position strings (mirrors Python config.window_position):
   *   "UR" "OO" "DL" etc.  — two-char code: first char = vertical (U/O/D),
   *                           second char = horizontal (L/O/R)
   *   "LEFT" "RIGHT" "UP" "DOWN" "ORIGIN" — convenience aliases
   *   "y,x"                              — explicit integer coords
   *
   * Returns [x, y] in desktop coordinates.
   */
  findInitialPosition(
    size: [number, number],
    monitor: MonitorInfo,
    customPosition?: string,
  ): [number, number] {
    let pos = customPosition ?? this.windowPosition;
    const [windowWidth, windowHeight] = size;

    if (pos.length === 1) {
      throw new Error(
        "window_position must specify both Y and X positions (Y/X -> UR). " +
          "Also accepts LEFT/RIGHT/ORIGIN/UP/DOWN.",
      );
    }

    // Expand convenience aliases → two-char code
    if (pos === "LEFT" || pos === "RIGHT") {
      pos = "O" + pos[0];
    } else if (pos === "UP" || pos === "DOWN") {
      pos = pos[0] + "O";
    } else if (pos === "ORIGIN") {
      pos = "OO";
    } else if (pos.includes(",")) {
      const [posY, posX] = pos.split(",").map(Number);
      return [posX, posY];
    }

    // Map L/U → 0 (start), O → 1 (center), R/D → 2 (end)
    const charToN: Record<string, number> = { L: 0, U: 0, O: 1, R: 2, D: 2 };
    const widthDiff = monitor.width - windowWidth;
    const heightDiff = monitor.height - windowHeight;

    return [
      monitor.x + Math.floor((charToN[pos[1]] * widthDiff) / 2),
      -monitor.y + Math.floor((charToN[pos[0]] * heightDiff) / 2),
    ];
  }
}
