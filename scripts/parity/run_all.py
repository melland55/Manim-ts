#!/usr/bin/env python3
"""
Run every Scene in scenes.py through Python Manim, copy each rendered PNG
to scripts/parity/out/<ClassName>-python.png.

Usage:
    .venv/Scripts/python.exe scripts/parity/run_all.py              # all scenes
    .venv/Scripts/python.exe scripts/parity/run_all.py SingleCircle # one scene
"""

from __future__ import annotations

import inspect
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCENES_FILE = HERE / "scenes.py"
OUT_DIR = HERE / "out"
OUT_DIR.mkdir(exist_ok=True)

# Import scenes module to enumerate Scene subclasses.
sys.path.insert(0, str(HERE))
import scenes as _scenes_mod  # noqa: E402

from manim import Scene  # noqa: E402


def discover() -> list[str]:
    names = []
    for name, obj in inspect.getmembers(_scenes_mod, inspect.isclass):
        if obj is Scene:
            continue
        if issubclass(obj, Scene) and obj.__module__ == _scenes_mod.__name__:
            names.append(name)
    return sorted(names)


def render_scene(name: str) -> bool:
    cmd = [
        sys.executable,
        "-m",
        "manim",
        "-s",
        "-ql",
        "--disable_caching",
        "--media_dir",
        str(HERE / "media"),
        str(SCENES_FILE),
        name,
    ]
    print(f"[python] {name}")
    result = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  FAIL: manim exited {result.returncode}")
        if result.stderr:
            print(result.stderr.strip().splitlines()[-5:])
        return False

    images_dir = HERE / "media" / "images" / SCENES_FILE.stem
    pngs = sorted(images_dir.glob(f"{name}*.png"))
    if not pngs:
        print(f"  FAIL: no PNG under {images_dir}")
        return False

    src = pngs[-1]
    dst = OUT_DIR / f"{name}-python.png"
    shutil.copyfile(src, dst)
    print(f"  wrote {dst.name}")
    return True


def main() -> int:
    targets = sys.argv[1:] if len(sys.argv) > 1 else discover()
    if not targets:
        print("No scenes discovered in scenes.py")
        return 1

    print(f"Rendering {len(targets)} scene(s) via Python Manim")
    failures: list[str] = []
    for name in targets:
        if not render_scene(name):
            failures.append(name)

    total = len(targets)
    passed = total - len(failures)
    print()
    print(f"Python rendering: {passed}/{total} succeeded")
    if failures:
        print("Failed:", ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
