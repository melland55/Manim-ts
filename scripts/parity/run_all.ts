/**
 * Iterate every entry in scenes.ts, render via CairoBackend at 854x480,
 * write scripts/parity/out/<Name>-ts.png.
 *
 * Usage:
 *     npx tsx scripts/parity/run_all.ts                  # all scenes
 *     npx tsx scripts/parity/run_all.ts SingleCircle     # one scene
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas } from "canvas";

import { BLACK } from "../../src/utils/color/manim_colors.js";
import { CairoBackend } from "../../src/renderer/cairo/cairo_backend.js";

import { SCENES } from "./scenes.js";

// -ql: 854×480, frame 14.222×8
const PIXEL_WIDTH = 854;
const PIXEL_HEIGHT = 480;
const FRAME_WIDTH = 14.222;
const FRAME_HEIGHT = 8;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "out");
mkdirSync(OUT_DIR, { recursive: true });

function renderScene(name: string): boolean {
  const factory = SCENES[name];
  if (!factory) {
    console.error(`  UNKNOWN scene: ${name}`);
    return false;
  }

  const { mobjects, backgroundColor } = factory();
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
      backgroundColor: backgroundColor ?? BLACK,
    },
  });

  try {
    for (const m of mobjects) {
      backend.addMobject(m as never);
    }
    backend.sync();
    backend.render();
  } catch (err) {
    console.error(`  FAIL [${name}]: ${(err as Error).message}`);
    return false;
  }

  const buf = (canvas as unknown as { toBuffer: (mime: string) => Buffer }).toBuffer("image/png");
  const outPath = resolve(OUT_DIR, `${name}-ts.png`);
  writeFileSync(outPath, buf);
  console.log(`[ts] ${name} -> ${outPath.split(/[\\/]/).pop()}`);
  return true;
}

function main(): number {
  const argv = process.argv.slice(2);
  const targets = argv.length > 0 ? argv : Object.keys(SCENES);

  console.log(`Rendering ${targets.length} scene(s) via CairoBackend`);
  const failures: string[] = [];
  for (const name of targets) {
    if (!renderScene(name)) failures.push(name);
  }

  const passed = targets.length - failures.length;
  console.log();
  console.log(`TS rendering: ${passed}/${targets.length} succeeded`);
  if (failures.length > 0) {
    console.log(`Failed: ${failures.join(", ")}`);
    return 1;
  }
  return 0;
}

process.exit(main());
