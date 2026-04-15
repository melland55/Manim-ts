"""
Reference scene rendered by Python Manim. Saves the last frame as PNG.

Run:
    cd scripts/parity
    manim -s -ql --disable_caching python_scene.py ParityScene

Output: media/images/python_scene/ParityScene_ManimCE_v0.x.x.png
We copy it to scripts/parity/out/python.png (see run_parity.py).
"""

from manim import Scene, Circle, BLUE, BLACK, config


class ParityScene(Scene):
    def construct(self):
        self.camera.background_color = BLACK
        circle = Circle(radius=1.5, color=BLUE, fill_opacity=0.5)
        self.add(circle)
