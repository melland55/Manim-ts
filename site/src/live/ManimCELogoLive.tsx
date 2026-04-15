import { LiveScene } from "./LiveScene";
import { Circle } from "../../../src/mobject/geometry/arc/arc.js";
import { Square, Triangle } from "../../../src/mobject/geometry/polygram/polygram.js";
import { VGroup } from "../../../src/mobject/types/vectorized_mobject.js";
import { MathTex } from "../../../src/mobject/text/mathtex_browser.js";
import { LEFT, UP, RIGHT, ORIGIN } from "../../../src/core/math/index.js";
import { ManimColor } from "../../../src/utils/color/core.js";
import type { Scene } from "../../../src/scene/scene/scene.js";

/**
 * Manual 1:1 port of the Python ManimCELogo example:
 *
 *   class ManimCELogo(Scene):
 *       def construct(self):
 *           self.camera.background_color = "#ece6e2"
 *           ds_m = MathTex(r"\\mathbb{M}", fill_color="#343434").scale(7)
 *           ds_m.shift(2.25 * LEFT + 1.5 * UP)
 *           circle = Circle(color="#87c2a5", fill_opacity=1).shift(LEFT)
 *           square = Square(color="#525893", fill_opacity=1).shift(UP)
 *           triangle = Triangle(color="#e07a5f", fill_opacity=1).shift(RIGHT)
 *           logo = VGroup(triangle, square, circle, ds_m)
 *           logo.move_to(ORIGIN)
 *           self.add(logo)
 */
async function build(scene: Scene): Promise<void> {
  const logoGreen = ManimColor.parse("#87c2a5");
  const logoBlue = ManimColor.parse("#525893");
  const logoRed = ManimColor.parse("#e07a5f");
  const logoBlack = ManimColor.parse("#343434");

  // NOTE: passing just `color` doesn't update fillColor in manim-ts (the
  // VMobject constructor defaults fillColor to BLUE and strokeColor to WHITE
  // independently). Python Manim's VMobject calls set_color(color) after
  // __init__ which updates both; we set fill+stroke explicitly for parity.
  const circle = new Circle({
    color: logoGreen,
    fillColor: logoGreen,
    strokeColor: logoGreen,
    fillOpacity: 1,
  }).shift(LEFT);
  const square = new Square({
    color: logoBlue,
    fillColor: logoBlue,
    strokeColor: logoBlue,
    fillOpacity: 1,
  }).shift(UP);
  const triangle = new Triangle({
    color: logoRed,
    fillColor: logoRed,
    strokeColor: logoRed,
    fillOpacity: 1,
  }).shift(RIGHT);

  // MathTex uses MathJax and may fail to build geometry synchronously; skip
  // silently rather than taking the whole scene down with it.
  let dsM: VGroup | null = null;
  try {
    const tex = new MathTex([String.raw`\mathbb{M}`], { fillColor: logoBlack });
    // MathTex's internal VMobject children default to BLUE fill — force the
    // requested color onto every glyph. Matches Python Manim's set_color path.
    tex.setFill(logoBlack, 1);
    tex.setStroke(logoBlack, 0, 0);
    tex.scale(7);
    tex.shift(LEFT.multiply(2.25).add(UP.multiply(1.5)));
    dsM = tex;
  } catch (err) {
    console.warn("[ManimCELogo] MathTex failed, rendering without it:", err);
  }

  const logo = dsM
    ? new VGroup(triangle, square, circle, dsM)
    : new VGroup(triangle, square, circle);
  logo.moveTo(ORIGIN);

  scene.add(logo);
}

export function ManimCELogoLive() {
  return <LiveScene build={build} background="#ece6e2" />;
}
