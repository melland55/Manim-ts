import { LiveScene } from "./LiveScene";
import { Dot } from "../../../src/mobject/geometry/arc/arc.js";
import { Arrow } from "../../../src/mobject/geometry/line/line.js";
import { NumberPlane } from "../../../src/mobject/graphing/coordinate_systems/coordinate_systems.js";
import { Text } from "../../../src/mobject/text/text_browser.js";
import { ORIGIN, DOWN, RIGHT, np } from "../../../src/core/math/index.js";
import { WHITE } from "../../../src/utils/color/manim_colors.js";
import type { Scene } from "../../../src/scene/scene/scene.js";

/**
 * 1:1 port of the Python VectorArrow example, using the browser-safe Text
 * (opentype.js + bundled TTF) in place of Python Manim's Pango-based Text.
 */
async function build(scene: Scene): Promise<void> {
  const numberplane = new NumberPlane();

  const dot = new Dot({ point: ORIGIN });
  const tip = np.array([2, 2, 0]);
  const arrow = new Arrow(ORIGIN, tip, { buff: 0 });

  const originText = new Text("(0, 0)", { color: WHITE }).nextTo(dot, DOWN);
  const tipText = new Text("(2, 2)", { color: WHITE }).nextTo(arrow.getEnd(), RIGHT);

  scene.add(numberplane, dot, arrow, originText, tipText);
}

export function VectorArrowLive() {
  return <LiveScene build={build} background="#000000" />;
}
