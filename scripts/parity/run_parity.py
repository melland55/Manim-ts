#!/usr/bin/env python3
"""
End-to-end parity harness:
    1. Render the reference Python Manim scene to PNG.
    2. Copy that PNG to scripts/parity/out/python.png.
    3. Print a follow-up command for the TS render + diff.

Assumes `manim` is importable (pip install manim). Works from anywhere —
all paths are resolved relative to this file.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCENE = HERE / "python_scene.py"
OUT_DIR = HERE / "out"
OUT_DIR.mkdir(exist_ok=True)


def main() -> int:
    # -s = save last frame as PNG; -ql = 854x480, 15fps; --disable_caching
    # so repeated runs don't short-circuit.
    cmd = [
        sys.executable,
        "-m",
        "manim",
        "-s",
        "-ql",
        "--disable_caching",
        "--media_dir",
        str(HERE / "media"),
        str(SCENE),
        "ParityScene",
    ]
    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd, cwd=HERE)
    if result.returncode != 0:
        print("manim render failed", file=sys.stderr)
        return result.returncode

    # Locate the produced PNG (manim names it after the scene class).
    images_dir = HERE / "media" / "images" / SCENE.stem
    if not images_dir.is_dir():
        print(f"expected images dir not found: {images_dir}", file=sys.stderr)
        return 1

    pngs = sorted(images_dir.glob("ParityScene*.png"))
    if not pngs:
        print(f"no PNG produced under {images_dir}", file=sys.stderr)
        return 1

    src = pngs[-1]  # newest
    dst = OUT_DIR / "python.png"
    shutil.copyfile(src, dst)
    print(f"Copied {src.name} -> {dst}")

    print()
    print("Next:")
    print("    npx tsx scripts/parity/ts_scene.ts")
    print("    npx tsx scripts/parity/diff.ts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
