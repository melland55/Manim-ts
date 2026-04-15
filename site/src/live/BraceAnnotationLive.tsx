import { LiveScene } from "./LiveScene";
import { Dot } from "../../../src/mobject/geometry/arc/arc.js";
import { Line } from "../../../src/mobject/geometry/line/line.js";
import { Brace } from "../../../src/mobject/svg/brace.js";
import { Text } from "../../../src/mobject/text/text_browser.js";
import { BrowserMathTex } from "../../../src/mobject/text/mathtex_browser.js";
import { np, DOWN } from "../../../src/core/math/index.js";
import { ORANGE, WHITE } from "../../../src/utils/color/manim_colors.js";
import type { Scene } from "../../../src/scene/scene/scene.js";
import type { IMobject } from "../../../src/core/types.js";
import type { Mobject } from "../../../src/mobject/mobject/mobject.js";

async function build(scene: Scene): Promise<void> {
  const dot = new Dot({ point: np.array([-2, -1, 0]) });
  const dot2 = new Dot({ point: np.array([2, 1, 0]) });
  const line = new Line(dot.getCenter(), dot2.getCenter()).setColor(ORANGE);

  const lineMob = line as unknown as Mobject;
  const b1 = new Brace(lineMob, DOWN);
  const b1text = new Text("Horizontal distance", { color: WHITE }).scale(0.6);
  b1text.nextTo(b1.getTip(), DOWN, { buff: 0.1 });

  // Line's perpendicular unit vector (rotated 90°).
  const dx = 4, dy = 2;
  const len = Math.hypot(dx, dy);
  const perp = np.array([-dy / len, dx / len, 0]);
  const b2 = new Brace(lineMob, perp);
  const b2tex = new BrowserMathTex(["x-x_1"]);
  b2tex.nextTo(b2.getTip(), perp, { buff: 0.1 });

  const mobs: IMobject[] = [
    line as unknown as IMobject,
    dot as unknown as IMobject,
    dot2 as unknown as IMobject,
    b1 as unknown as IMobject,
    b2 as unknown as IMobject,
    b1text as unknown as IMobject,
    b2tex as unknown as IMobject,
  ];
  scene.add(...mobs);
}

export function BraceAnnotationLive() {
  return <LiveScene build={build} background="#000000" />;
}
