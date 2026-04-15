/**
 * Pixel-diff python.png vs ts.png using pixelmatch.
 *
 * Run:
 *     npx tsx scripts/parity/diff.ts
 *
 * Writes scripts/parity/out/diff.png highlighting differing pixels and
 * prints a summary. Exits 0 when diff ratio < THRESHOLD_RATIO, else 1.
 *
 * With node-canvas on both sides (pycairo in Python, node-canvas/libcairo
 * here) the rasterizer matches — expect tiny diff counts (single-digit
 * pixels from rounding) or zero. Large diffs indicate a real engine
 * divergence worth investigating.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "out");

const THRESHOLD_PER_PIXEL = 0.1; // antialias tolerance per pixel (0–1)
const THRESHOLD_RATIO = 0.001;   // 0.1% of pixels may differ before we fail

function load(path: string): PNG {
  return PNG.sync.read(readFileSync(path));
}

const pythonPath = resolve(OUT_DIR, "python.png");
const tsPath = resolve(OUT_DIR, "ts.png");

const python = load(pythonPath);
const ts = load(tsPath);

if (python.width !== ts.width || python.height !== ts.height) {
  console.error(
    `Size mismatch: python=${python.width}×${python.height} ts=${ts.width}×${ts.height}`,
  );
  process.exit(2);
}

const { width, height } = python;
const diff = new PNG({ width, height });

const diffPixels = pixelmatch(
  python.data,
  ts.data,
  diff.data,
  width,
  height,
  { threshold: THRESHOLD_PER_PIXEL, includeAA: true },
);

const diffPath = resolve(OUT_DIR, "diff.png");
writeFileSync(diffPath, PNG.sync.write(diff));

const totalPixels = width * height;
const ratio = diffPixels / totalPixels;
const pct = (ratio * 100).toFixed(4);

console.log(`Python : ${pythonPath}`);
console.log(`TS     : ${tsPath}`);
console.log(`Diff   : ${diffPath}`);
console.log(`Pixels : ${diffPixels} / ${totalPixels} differ (${pct}%)`);
console.log(`Threshold: ${(THRESHOLD_RATIO * 100).toFixed(4)}%`);

if (ratio > THRESHOLD_RATIO) {
  console.error(`FAIL: diff ratio ${pct}% exceeds threshold`);
  process.exit(1);
}
console.log("PASS");
