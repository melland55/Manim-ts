/**
 * manim-ts Browser Demo
 *
 * A standalone browser demo that renders Manim-style mobjects using Canvas2D.
 * This does NOT import from src/ (which depends on Node-only packages like
 * @napi-rs/canvas, sharp, fs, etc.). Instead, it re-implements the minimal
 * Manim rendering math (cubic bezier VMobjects, coordinate transforms) using
 * the same algorithms as the main codebase.
 *
 * The coordinate system matches Manim:
 *   - Origin at center of canvas
 *   - Y-axis points UP (canvas Y is flipped)
 *   - Frame width ~14.2, frame height ~8 (16:9 at 1280x720)
 */

// ─── Manim Color Palette (matches src/core/color/index.ts) ─────

interface ManimColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function hexColor(hex: string, a = 1.0): ManimColor {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a,
  };
}

function colorToCSS(c: ManimColor): string {
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
}

function interpolateColor(a: ManimColor, b: ManimColor, t: number): ManimColor {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

// Manim named colors
const BLACK = hexColor("#000000");
const WHITE = hexColor("#FFFFFF");
const BLUE_C = hexColor("#58C4DD");
const BLUE_D = hexColor("#29ABCA");
const BLUE = BLUE_C;
const GREEN_C = hexColor("#83C167");
const GREEN = GREEN_C;
const YELLOW_C = hexColor("#F7D96F");
const YELLOW = YELLOW_C;
const RED_C = hexColor("#FC6255");
const RED = RED_C;
const TEAL_C = hexColor("#5CD0B3");
const TEAL = TEAL_C;
const GOLD_C = hexColor("#F0AC5F");
const GOLD = GOLD_C;
const PURPLE_C = hexColor("#9A72AC");
const PURPLE = PURPLE_C;
const MAROON_C = hexColor("#C55F73");
const MAROON = MAROON_C;
const ORANGE = hexColor("#FF862F");
const PINK = hexColor("#D147BD");
const GRAY_B = hexColor("#BBBBBB");
const DARK_GRAY = hexColor("#444444");

// ─── Math Helpers ───────────────────────────────────────────────

const TAU = 2 * Math.PI;
const PI = Math.PI;

type Point3 = [number, number, number];

function p3(x: number, y: number, z = 0): Point3 {
  return [x, y, z];
}

function addP3(a: Point3, b: Point3): Point3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaleP3(p: Point3, s: number): Point3 {
  return [p[0] * s, p[1] * s, p[2] * s];
}

function lerpP3(a: Point3, b: Point3, t: number): Point3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// ─── Rate Functions (from src/core/math) ────────────────────────

function smooth(t: number): number {
  // Attempt to attempt to attempt to match manim's smooth()
  // s(t) = 3t^2 - 2t^3 (Hermite interpolation)
  const s = 3 * t * t - 2 * t * t * t;
  return s;
}

function doubleSmooth(t: number): number {
  if (t < 0.5) return 0.5 * smooth(2 * t);
  return 0.5 * smooth(2 * t - 1) + 0.5;
}

function linear(t: number): number {
  return t;
}

function thereAndBack(t: number): number {
  return t < 0.5 ? 2 * t : 2 * (1 - t);
}

function rushInto(t: number): number {
  return 2 * smooth(t / 2);
}

function rushFrom(t: number): number {
  return 2 * smooth(t / 2 + 0.5) - 1;
}

// ─── VMobject: Cubic Bezier Point Storage ───────────────────────
// Manim stores VMobject paths as arrays of Point3D where every group of 4
// consecutive points is [anchor, handle1, handle2, anchor].
// Cubic bezier curves: B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3

interface VMobject {
  points: Point3[];
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  strokeWidth: number;
  center: Point3;
}

function createVMobject(overrides: Partial<VMobject> = {}): VMobject {
  return {
    points: [],
    fillColor: BLUE,
    fillOpacity: 0.0,
    strokeColor: WHITE,
    strokeOpacity: 1.0,
    strokeWidth: 4,
    center: p3(0, 0),
    ...overrides,
  };
}

/** Generate points for a circle using 8 cubic bezier arcs (Manim uses 8 by default). */
function circlePoints(radius: number, center: Point3 = p3(0, 0), nArcs = 8): Point3[] {
  const points: Point3[] = [];
  const angleStep = TAU / nArcs;
  // Kappa for cubic bezier circle approximation
  const kappa = (4 / 3) * Math.tan(angleStep / 4);

  for (let i = 0; i < nArcs; i++) {
    const theta0 = i * angleStep;
    const theta1 = (i + 1) * angleStep;

    const cos0 = Math.cos(theta0), sin0 = Math.sin(theta0);
    const cos1 = Math.cos(theta1), sin1 = Math.sin(theta1);

    const p0: Point3 = [center[0] + radius * cos0, center[1] + radius * sin0, 0];
    const p3End: Point3 = [center[0] + radius * cos1, center[1] + radius * sin1, 0];

    // Tangent direction at p0
    const h1: Point3 = [
      p0[0] + radius * kappa * (-sin0),
      p0[1] + radius * kappa * cos0,
      0,
    ];
    // Tangent direction at p3 (backwards)
    const h2: Point3 = [
      p3End[0] - radius * kappa * (-sin1),
      p3End[1] - radius * kappa * cos1,
      0,
    ];

    // First arc includes anchor; subsequent arcs share the end anchor
    if (i === 0) points.push(p0);
    points.push(h1, h2, p3End);
  }
  return points;
}

/** Generate points for a regular polygon (N sides). */
function regularPolygonPoints(n: number, radius: number, center: Point3 = p3(0, 0)): Point3[] {
  const points: Point3[] = [];
  const startAngle = PI / 2; // Start at top like Manim

  for (let i = 0; i < n; i++) {
    const theta0 = startAngle + (i * TAU) / n;
    const theta1 = startAngle + ((i + 1) * TAU) / n;

    const p0: Point3 = [center[0] + radius * Math.cos(theta0), center[1] + radius * Math.sin(theta0), 0];
    const p1: Point3 = [center[0] + radius * Math.cos(theta1), center[1] + radius * Math.sin(theta1), 0];

    // Use straight lines (handles at 1/3 and 2/3 along the line)
    const h1 = lerpP3(p0, p1, 1 / 3);
    const h2 = lerpP3(p0, p1, 2 / 3);

    if (i === 0) points.push(p0);
    points.push(h1, h2, p1);
  }
  return points;
}

/** Generate points for a square. */
function squarePoints(sideLength: number, center: Point3 = p3(0, 0)): Point3[] {
  const r = sideLength / 2;
  return regularPolygonPoints(4, r * Math.sqrt(2), center);
}

/** Generate points for a star polygon. */
function starPoints(
  outerRadius: number,
  innerRadius: number,
  numPoints: number,
  center: Point3 = p3(0, 0),
): Point3[] {
  const points: Point3[] = [];
  const totalVerts = numPoints * 2;
  const startAngle = PI / 2;

  const vertices: Point3[] = [];
  for (let i = 0; i < totalVerts; i++) {
    const angle = startAngle + (i * TAU) / totalVerts;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    vertices.push([center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle), 0]);
  }

  for (let i = 0; i < totalVerts; i++) {
    const p0 = vertices[i];
    const p1 = vertices[(i + 1) % totalVerts];
    const h1 = lerpP3(p0, p1, 1 / 3);
    const h2 = lerpP3(p0, p1, 2 / 3);
    if (i === 0) points.push(p0);
    points.push(h1, h2, p1);
  }
  return points;
}

/** Generate arc points (portion of a circle). */
function arcPoints(
  radius: number,
  startAngle: number,
  angle: number,
  center: Point3 = p3(0, 0),
  nArcs = 8,
): Point3[] {
  const points: Point3[] = [];
  const step = angle / nArcs;
  const kappa = (4 / 3) * Math.tan(step / 4);

  for (let i = 0; i < nArcs; i++) {
    const theta0 = startAngle + i * step;
    const theta1 = startAngle + (i + 1) * step;

    const cos0 = Math.cos(theta0), sin0 = Math.sin(theta0);
    const cos1 = Math.cos(theta1), sin1 = Math.sin(theta1);

    const p0: Point3 = [center[0] + radius * cos0, center[1] + radius * sin0, 0];
    const p3End: Point3 = [center[0] + radius * cos1, center[1] + radius * sin1, 0];

    const h1: Point3 = [
      p0[0] + radius * kappa * (-sin0),
      p0[1] + radius * kappa * cos0,
      0,
    ];
    const h2: Point3 = [
      p3End[0] - radius * kappa * (-sin1),
      p3End[1] - radius * kappa * cos1,
      0,
    ];

    if (i === 0) points.push(p0);
    points.push(h1, h2, p3End);
  }
  return points;
}

// ─── Canvas Rendering (matches Camera.setCanvasContextPath + fill/stroke) ────

interface FrameConfig {
  pixelWidth: number;
  pixelHeight: number;
  frameWidth: number;
  frameHeight: number;
}

const DEFAULT_CONFIG: FrameConfig = {
  pixelWidth: 1280,
  pixelHeight: 720,
  frameWidth: 14.222222222222221, // Manim default for 1280x720 with frameHeight=8
  frameHeight: 8,
};

function setupTransform(ctx: CanvasRenderingContext2D, cfg: FrameConfig): void {
  const { pixelWidth: pw, pixelHeight: ph, frameWidth: fw, frameHeight: fh } = cfg;
  ctx.setTransform(
    pw / fw,      // horizontal scale
    0,
    0,
    -(ph / fh),   // vertical scale (flipped — Y up)
    pw / 2,       // translate X to center
    ph / 2,       // translate Y to center
  );
}

function drawPath(ctx: CanvasRenderingContext2D, points: Point3[]): void {
  if (points.length === 0) return;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  // Walk through in groups of 3: handle1, handle2, anchor
  for (let i = 1; i + 2 <= points.length; i += 3) {
    ctx.bezierCurveTo(
      points[i][0], points[i][1],
      points[i + 1][0], points[i + 1][1],
      points[i + 2][0], points[i + 2][1],
    );
  }
}

function renderVMobject(ctx: CanvasRenderingContext2D, mob: VMobject, cfg: FrameConfig): void {
  if (mob.points.length === 0) return;

  ctx.save();
  setupTransform(ctx, cfg);
  drawPath(ctx, mob.points);

  // Fill
  if (mob.fillOpacity > 0) {
    const fc = { ...mob.fillColor, a: mob.fillOpacity };
    ctx.fillStyle = colorToCSS(fc);
    ctx.fill();
  }

  // Stroke
  if (mob.strokeOpacity > 0 && mob.strokeWidth > 0) {
    const sc = { ...mob.strokeColor, a: mob.strokeOpacity };
    ctx.strokeStyle = colorToCSS(sc);
    // Stroke width in frame coordinates — scale from pixel width
    ctx.lineWidth = mob.strokeWidth * 0.01;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  ctx.restore();
}

function clearCanvas(
  ctx: CanvasRenderingContext2D,
  bg: ManimColor,
  pw: number,
  ph: number,
): void {
  ctx.resetTransform();
  ctx.fillStyle = colorToCSS(bg);
  ctx.fillRect(0, 0, pw, ph);
}

// ─── Animations ─────────────────────────────────────────────────

type EasingFunc = (t: number) => number;

/** Partial draw: show only the first `alpha` fraction of the bezier path points. */
function partialPoints(allPoints: Point3[], alpha: number): Point3[] {
  if (alpha >= 1) return allPoints;
  if (alpha <= 0) return [];

  // Number of cubic bezier segments = (points.length - 1) / 3
  const nSegs = (allPoints.length - 1) / 3;
  const targetSegs = alpha * nSegs;
  const fullSegs = Math.floor(targetSegs);
  const partial = targetSegs - fullSegs;

  const result: Point3[] = [];
  // Copy full segments
  for (let i = 0; i <= fullSegs * 3 && i < allPoints.length; i++) {
    result.push(allPoints[i]);
  }

  // Partial last segment: split the cubic bezier at parameter t=partial
  if (partial > 0 && fullSegs * 3 + 3 < allPoints.length) {
    const baseIdx = fullSegs * 3;
    const p0 = allPoints[baseIdx];
    const p1 = allPoints[baseIdx + 1];
    const p2 = allPoints[baseIdx + 2];
    const p3Final = allPoints[baseIdx + 3];

    // De Casteljau split at t = partial
    const q0 = lerpP3(p0, p1, partial);
    const q1 = lerpP3(p1, p2, partial);
    const q2 = lerpP3(p2, p3Final, partial);

    const r0 = lerpP3(q0, q1, partial);
    const r1 = lerpP3(q1, q2, partial);

    const s0 = lerpP3(r0, r1, partial);

    // The left half of the split: p0, q0, r0, s0
    // p0 is already in result
    result.push(q0, r0, s0);
  }

  return result;
}

/** Scale points from center by factor (for GrowFromCenter). */
function scalePointsFromCenter(points: Point3[], center: Point3, factor: number): Point3[] {
  return points.map((p) => {
    return [
      center[0] + (p[0] - center[0]) * factor,
      center[1] + (p[1] - center[1]) * factor,
      center[2] + (p[2] - center[2]) * factor,
    ] as Point3;
  });
}

interface AnimationState {
  type: "create" | "growFromCenter" | "fadeIn" | "drawBorderThenFill";
  mobject: VMobject;
  fullPoints: Point3[];
  startTime: number;
  duration: number;
  easing: EasingFunc;
  done: boolean;
}

function tickAnimation(anim: AnimationState, now: number): void {
  const elapsed = now - anim.startTime;
  const rawT = Math.min(1, elapsed / anim.duration);
  const t = anim.easing(rawT);

  const mob = anim.mobject;

  switch (anim.type) {
    case "create":
      // Progressively reveal the bezier path
      mob.points = partialPoints(anim.fullPoints, t);
      break;

    case "growFromCenter": {
      // Scale from 0 to full size
      const center = mob.center;
      mob.points = scalePointsFromCenter(anim.fullPoints, center, t);
      break;
    }

    case "fadeIn":
      // Fade in opacity
      mob.points = anim.fullPoints;
      mob.strokeOpacity = t;
      mob.fillOpacity = t * (mob.fillOpacity > 0 ? 1 : 0);
      break;

    case "drawBorderThenFill": {
      // Phase 1 (0-0.5): draw border
      // Phase 2 (0.5-1): fill in
      mob.points = anim.fullPoints;
      if (t < 0.5) {
        const borderT = t / 0.5;
        mob.points = partialPoints(anim.fullPoints, borderT);
        mob.fillOpacity = 0;
      } else {
        const fillT = (t - 0.5) / 0.5;
        mob.fillOpacity = fillT;
      }
      break;
    }
  }

  if (rawT >= 1) {
    anim.done = true;
    mob.points = anim.fullPoints;
  }
}

// ─── Scene Manager ──────────────────────────────────────────────

class DemoScene {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  config: FrameConfig;
  backgroundColor: ManimColor;

  mobjects: VMobject[] = [];
  animations: AnimationState[] = [];
  animationQueue: (() => AnimationState)[] = [];
  running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.config = {
      ...DEFAULT_CONFIG,
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
    };
    this.backgroundColor = hexColor("#1C1C1C");
    this.clear();
  }

  clear(): void {
    this.mobjects = [];
    this.animations = [];
    this.animationQueue = [];
    this.running = false;
    clearCanvas(this.ctx, this.backgroundColor, this.config.pixelWidth, this.config.pixelHeight);
  }

  addMobject(mob: VMobject): void {
    this.mobjects.push(mob);
  }

  removeMobject(mob: VMobject): void {
    this.mobjects = this.mobjects.filter((m) => m !== mob);
  }

  queueAnimation(
    type: AnimationState["type"],
    mob: VMobject,
    duration = 1.0,
    easing: EasingFunc = smooth,
  ): void {
    const fullPoints = [...mob.points];
    this.animationQueue.push(() => {
      // On start, clear points so the animation can reveal them
      if (type === "create" || type === "drawBorderThenFill") {
        mob.points = [];
      } else if (type === "growFromCenter") {
        mob.points = scalePointsFromCenter(fullPoints, mob.center, 0);
      } else if (type === "fadeIn") {
        mob.strokeOpacity = 0;
        mob.fillOpacity = 0;
      }

      if (!this.mobjects.includes(mob)) {
        this.addMobject(mob);
      }

      return {
        type,
        mobject: mob,
        fullPoints,
        startTime: performance.now() / 1000,
        duration,
        easing,
        done: false,
      };
    });
  }

  play(): void {
    if (this.running) return;
    this.running = true;
    this._startNextAnimation();
    this._loop();
  }

  private _startNextAnimation(): void {
    if (this.animationQueue.length === 0) return;
    const factory = this.animationQueue.shift()!;
    const anim = factory();
    this.animations.push(anim);
  }

  private _loop = (): void => {
    if (!this.running) return;

    const now = performance.now() / 1000;

    // Tick active animations
    for (const anim of this.animations) {
      if (!anim.done) {
        tickAnimation(anim, now);
      }
    }

    // Check if current animation is done, start next
    const activeAnims = this.animations.filter((a) => !a.done);
    if (activeAnims.length === 0 && this.animationQueue.length > 0) {
      this._startNextAnimation();
    } else if (activeAnims.length === 0 && this.animationQueue.length === 0) {
      // All done, render one last frame and stop
      this._render();
      this.running = false;
      return;
    }

    this._render();
    requestAnimationFrame(this._loop);
  };

  private _render(): void {
    const { ctx, config } = this;
    clearCanvas(ctx, this.backgroundColor, config.pixelWidth, config.pixelHeight);

    for (const mob of this.mobjects) {
      renderVMobject(ctx, mob, config);
    }
  }
}

// ─── Preset Mobjects ────────────────────────────────────────────

function makeCircle(
  radius = 1,
  center: Point3 = p3(0, 0),
  color: ManimColor = BLUE,
  fill = false,
): VMobject {
  return createVMobject({
    points: circlePoints(radius, center),
    strokeColor: color,
    strokeOpacity: 1,
    strokeWidth: 4,
    fillColor: color,
    fillOpacity: fill ? 0.5 : 0,
    center,
  });
}

function makeSquare(
  sideLength = 2,
  center: Point3 = p3(0, 0),
  color: ManimColor = YELLOW,
  fill = false,
): VMobject {
  return createVMobject({
    points: squarePoints(sideLength, center),
    strokeColor: color,
    strokeOpacity: 1,
    strokeWidth: 4,
    fillColor: color,
    fillOpacity: fill ? 0.5 : 0,
    center,
  });
}

function makeStar(
  outerRadius = 1.5,
  innerRadius = 0.6,
  numPoints = 5,
  center: Point3 = p3(0, 0),
  color: ManimColor = GOLD,
  fill = false,
): VMobject {
  return createVMobject({
    points: starPoints(outerRadius, innerRadius, numPoints, center),
    strokeColor: color,
    strokeOpacity: 1,
    strokeWidth: 4,
    fillColor: color,
    fillOpacity: fill ? 0.5 : 0,
    center,
  });
}

function makeArc(
  radius = 1,
  startAngle = 0,
  angle = PI,
  center: Point3 = p3(0, 0),
  color: ManimColor = TEAL,
): VMobject {
  return createVMobject({
    points: arcPoints(radius, startAngle, angle, center),
    strokeColor: color,
    strokeOpacity: 1,
    strokeWidth: 4,
    fillColor: color,
    fillOpacity: 0,
    center,
  });
}

function makeTriangle(
  radius = 1.2,
  center: Point3 = p3(0, 0),
  color: ManimColor = GREEN,
  fill = false,
): VMobject {
  return createVMobject({
    points: regularPolygonPoints(3, radius, center),
    strokeColor: color,
    strokeOpacity: 1,
    strokeWidth: 4,
    fillColor: color,
    fillOpacity: fill ? 0.5 : 0,
    center,
  });
}

function makeHexagon(
  radius = 1,
  center: Point3 = p3(0, 0),
  color: ManimColor = PURPLE,
  fill = false,
): VMobject {
  return createVMobject({
    points: regularPolygonPoints(6, radius, center),
    strokeColor: color,
    strokeOpacity: 1,
    strokeWidth: 4,
    fillColor: color,
    fillOpacity: fill ? 0.5 : 0,
    center,
  });
}

// ─── Wire Up UI ─────────────────────────────────────────────────

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const scene = new DemoScene(canvas);

document.getElementById("btn-circle")!.addEventListener("click", () => {
  scene.clear();
  const circle = makeCircle(1.5, p3(0, 0), BLUE, true);
  scene.queueAnimation("create", circle, 1.5, smooth);
  scene.play();
});

document.getElementById("btn-square")!.addEventListener("click", () => {
  scene.clear();
  const square = makeSquare(2.5, p3(0, 0), YELLOW, true);
  scene.queueAnimation("drawBorderThenFill", square, 2.0, smooth);
  scene.play();
});

document.getElementById("btn-star")!.addEventListener("click", () => {
  scene.clear();
  const star = makeStar(2, 0.8, 5, p3(0, 0), GOLD, true);
  scene.queueAnimation("growFromCenter", star, 1.5, smooth);
  scene.play();
});

document.getElementById("btn-all")!.addEventListener("click", () => {
  scene.clear();

  // Create a nice arrangement of shapes
  const circle = makeCircle(1, p3(-4, 1.5), BLUE, true);
  const square = makeSquare(1.8, p3(0, 1.5), YELLOW, true);
  const triangle = makeTriangle(1, p3(4, 1.5), GREEN, true);

  const hex = makeHexagon(1, p3(-4, -1.5), PURPLE, true);
  const star = makeStar(1.3, 0.5, 5, p3(0, -1.5), GOLD, true);
  const arc = makeArc(1.2, 0, PI * 1.5, p3(4, -1.5), TEAL);

  scene.queueAnimation("create", circle, 1.0, smooth);
  scene.queueAnimation("drawBorderThenFill", square, 1.0, smooth);
  scene.queueAnimation("growFromCenter", triangle, 1.0, smooth);
  scene.queueAnimation("fadeIn", hex, 1.0, smooth);
  scene.queueAnimation("create", star, 1.0, smooth);
  scene.queueAnimation("create", arc, 1.0, smooth);

  scene.play();
});

document.getElementById("btn-reset")!.addEventListener("click", () => {
  scene.clear();
});

// Show an initial animation on load
window.addEventListener("load", () => {
  const circle = makeCircle(2, p3(0, 0), BLUE, true);
  scene.queueAnimation("create", circle, 2.0, smooth);
  scene.play();
});
