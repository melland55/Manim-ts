# Parity harness

Renders the same set of scenes through Python Manim and manim-ts, then
pixel-diffs the results. Because both sides now use libcairo (pycairo in
Python, `canvas` / node-canvas here), byte-identical output is expected for
pure-geometry scenes.

## Prerequisites

- Python side: `scripts/parity/.venv/Scripts/python.exe` (3.12 with manim
  0.20.1 already installed). On Mac/Linux use `.venv/bin/python`.
- Node side: everything in this repo (`npm install`).

## Run the multi-scene suite

From the repo root:

```bash
# 1. Render every Python scene to out/<Name>-python.png
scripts/parity/.venv/Scripts/python.exe scripts/parity/run_all.py

# 2. Render every TS scene to out/<Name>-ts.png
npx tsx scripts/parity/run_all.ts

# 3. Diff every pair, write out/<Name>-diff.png on mismatch, print summary
npx tsx scripts/parity/diff_all.ts
```

`diff_all.ts` exits non-zero if any scene exceeds `PARITY_THRESHOLD` (default
0.001 = 0.1% of pixels). Override: `PARITY_THRESHOLD=0.005 npx tsx …`.

### Running a single scene

Both runners accept scene names as positional args:

```bash
scripts/parity/.venv/Scripts/python.exe scripts/parity/run_all.py SingleCircle
npx tsx scripts/parity/run_all.ts SingleCircle
npx tsx scripts/parity/diff_all.ts
```

## Legacy single-scene harness

The original `python_scene.py` / `ts_scene.ts` / `diff.ts` / `run_parity.py`
files render a single blue circle and are kept only for quick smoke checks.
They have been superseded by the multi-scene suite above.

## Adding a scene

1. Add a `Scene` subclass to `scenes.py`. Use only `self.add(...)` — no
   animations, no RNG without a seeded PRNG shared with TS.
2. Add a matching entry to `SCENES` in `scenes.ts`. The key must match the
   Python class name exactly — that's how `diff_all.ts` pairs them.
3. Re-run the three commands above.

## Caveats

- **Text / math:** Pango metrics drift across platforms. Text scenes are
  omitted on purpose — revisit once the glyph pipeline is stable.
- **3D mobjects:** skipped; the Cairo painter's algorithm is known imperfect.
- **Determinism:** `ManyMobjects` uses an in-file mulberry32 PRNG seeded on
  both sides (see `_mulberry32` in `scenes.py` and `mulberry32` in
  `scenes.ts`) so the same 50 (x, y, r) triples come out.
- **Scenes with missing TS features** may be tagged `_TODO` in the SCENES
  map; those are reported separately and not counted toward the fail gate.
- **Color space:** both pipelines blend in sRGB (three.js / WebGL blend in
  linear space — parity harness uses Cairo on both sides precisely to avoid
  that drift).
