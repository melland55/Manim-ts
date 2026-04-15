/**
 * Pixel-diff every paired (<Name>-python.png, <Name>-ts.png) in out/ via
 * pixelmatch. Writes <Name>-diff.png on mismatch, prints a summary table.
 *
 * Exits 1 if any scene exceeds the threshold (default 0.1% of pixels).
 * Override via env: PARITY_THRESHOLD=0.005 for 0.5%.
 *
 * Scenes whose name ends in "_TODO" are reported but excluded from the pass/fail
 * gate — they're acknowledged gaps in the TS port.
 *
 * Usage:
 *     npx tsx scripts/parity/diff_all.ts
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

import { SCENES } from "./scenes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = resolve(__dirname, "out");

const THRESHOLD_PER_PIXEL = 0.1;
const THRESHOLD_RATIO = parseFloat(process.env.PARITY_THRESHOLD ?? "0.001");

type Row = {
  name: string;
  isTodo: boolean;
  status: "PASS" | "FAIL" | "MISSING_PY" | "MISSING_TS" | "SIZE_MISMATCH";
  diffPixels: number;
  totalPixels: number;
  ratio: number;
};

function diffOne(name: string): Row {
  const isTodo = name.endsWith("_TODO");
  const pyPath = resolve(OUT_DIR, `${name}-python.png`);
  const tsPath = resolve(OUT_DIR, `${name}-ts.png`);

  if (!existsSync(pyPath)) {
    return { name, isTodo, status: "MISSING_PY", diffPixels: 0, totalPixels: 0, ratio: 0 };
  }
  if (!existsSync(tsPath)) {
    return { name, isTodo, status: "MISSING_TS", diffPixels: 0, totalPixels: 0, ratio: 0 };
  }

  const py = PNG.sync.read(readFileSync(pyPath));
  const ts = PNG.sync.read(readFileSync(tsPath));

  if (py.width !== ts.width || py.height !== ts.height) {
    return {
      name, isTodo, status: "SIZE_MISMATCH",
      diffPixels: 0, totalPixels: py.width * py.height, ratio: 1,
    };
  }

  const { width, height } = py;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(py.data, ts.data, diff.data, width, height, {
    threshold: THRESHOLD_PER_PIXEL,
    includeAA: true,
  });

  const totalPixels = width * height;
  const ratio = diffPixels / totalPixels;

  if (diffPixels > 0) {
    writeFileSync(resolve(OUT_DIR, `${name}-diff.png`), PNG.sync.write(diff));
  }

  const status: "PASS" | "FAIL" = ratio <= THRESHOLD_RATIO ? "PASS" : "FAIL";
  return { name, isTodo, status, diffPixels, totalPixels, ratio };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
function padL(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

function main(): number {
  const names = Object.keys(SCENES);
  const rows = names.map(diffOne);

  const nameCol = Math.max(22, ...rows.map((r) => r.name.length + 2));

  console.log();
  console.log(
    pad("Scene", nameCol) +
    pad("Status", 16) +
    padL("Diff px", 12) +
    padL("Ratio", 12),
  );
  console.log("-".repeat(nameCol + 40));

  let passes = 0;
  let fails = 0;
  let zeros = 0;
  let todos = 0;
  const failNames: string[] = [];

  for (const r of rows) {
    const ratioStr = r.status === "PASS" || r.status === "FAIL"
      ? `${(r.ratio * 100).toFixed(4)}%`
      : "-";
    const diffStr = r.status === "PASS" || r.status === "FAIL" || r.status === "SIZE_MISMATCH"
      ? String(r.diffPixels)
      : "-";
    const tag = r.isTodo ? " [TODO]" : "";
    console.log(
      pad(r.name + tag, nameCol) +
      pad(r.status, 16) +
      padL(diffStr, 12) +
      padL(ratioStr, 12),
    );

    if (r.isTodo) {
      todos++;
      continue;
    }
    if (r.status === "PASS") {
      passes++;
      if (r.diffPixels === 0) zeros++;
    } else {
      fails++;
      failNames.push(`${r.name} (${r.status})`);
    }
  }

  console.log();
  console.log(`Total:   ${rows.length}`);
  console.log(`Pass:    ${passes} (of which ${zeros} have 0 pixels differing)`);
  console.log(`Fail:    ${fails}`);
  console.log(`TODO:    ${todos} (not gated)`);
  console.log(`Threshold: ${(THRESHOLD_RATIO * 100).toFixed(4)}%`);
  if (failNames.length > 0) {
    console.log();
    console.log("Failing scenes:");
    for (const f of failNames) console.log("  " + f);
  }

  return fails > 0 ? 1 : 0;
}

process.exit(main());
