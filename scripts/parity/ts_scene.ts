/**
 * Equivalent scene rendered by manim-ts via CairoBackend (node-canvas / libcairo).
 * Saves the final frame to scripts/parity/out/ts.png.
 *
 * Run:
 *     npx tsx scripts/parity/ts_scene.ts
 *
 * Keep this scene in lockstep with scripts/parity/python_scene.py — same
 * geometry, same camera, same background — so pixel diffing is meaningful.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas } from "canvas";
import { Circle } from "../../src/mobject/geometry/index.js";
import { BLUE, BLACK } from "../../src/utils/color/manim_colors.js";
import { CairoBackend } from "../../src/renderer/cairo/cairo_backend.js";

// Match Python Manim -ql: 854×480, frame 14.222×8
const PIXEL_WIDTH = 854;
const PIXEL_HEIGHT = 480;
const FRAME_WIDTH = 14.222;
const FRAME_HEIGHT = 8;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "out");
mkdirSync(OUT_DIR, { recursive: true });

// node-canvas HTMLCanvasElement-compatible surface
const canvas = createCanvas(PIXEL_WIDTH, PIXEL_HEIGHT) as unknown as HTMLCanvasElement;

const backend = new CairoBackend({
  canvas,
  frameWidth: FRAME_WIDTH,
  frameHeight: FRAME_HEIGHT,
  config: {
    pixelWidth: PIXEL_WIDTH,
    pixelHeight: PIXEL_HEIGHT,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    backgroundColor: BLACK,
  },
});

const circle = new Circle({
  radius: 1.5,
  color: BLUE,
  fillOpacity: 0.5,
});

backend.addMobject(circle);
backend.sync();
backend.render();

const buf = (canvas as unknown as { toBuffer: (mime: string) => Buffer }).toBuffer("image/png");
const outPath = resolve(OUT_DIR, "ts.png");
writeFileSync(outPath, buf);
console.log(`Wrote ${outPath}`);
