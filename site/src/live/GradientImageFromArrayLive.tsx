import { LiveScene } from "./LiveScene";
import { ImageMobject } from "../../../src/mobject/types/image_mobject/image_mobject.js";
import { SurroundingRectangle } from "../../../src/mobject/geometry/shape_matchers/shape_matchers.js";
import { np } from "../../../src/core/math/index.js";
import { GREEN } from "../../../src/utils/color/manim_colors.js";
import type { Scene } from "../../../src/scene/scene/scene.js";
import type { IMobject } from "../../../src/core/types.js";

async function build(scene: Scene): Promise<void> {
  const n = 256;
  const arr: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) row.push(Math.floor((i * 256) / n));
    arr.push(row);
  }
  const image = new ImageMobject(np.array(arr));
  image.scale(2);
  const rect = new SurroundingRectangle(image as unknown as IMobject, { color: GREEN });
  scene.add(image, rect);
}

export function GradientImageFromArrayLive() {
  return <LiveScene build={build} background="#000000" />;
}
