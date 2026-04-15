import type { ExampleDef, ExampleSection } from "./registry";
import { ManimCELogoLive } from "../live/ManimCELogoLive";
import { VectorArrowLive } from "../live/VectorArrowLive";
import { GradientImageFromArrayLive } from "../live/GradientImageFromArrayLive";
import { BraceAnnotationLive } from "../live/BraceAnnotationLive";

const IMG = (n: string): ExampleDef["reference"] => ({
  kind: "image",
  src: `${import.meta.env.BASE_URL}manim-community/${n}-1.png`,
});
const VID = (n: string): ExampleDef["reference"] => ({
  kind: "video",
  src: `${import.meta.env.BASE_URL}manim-community/${n}-1.mp4`,
});

export const basicConcepts: ExampleSection = {
  id: "basic-concepts",
  title: "Basic Concepts",
  examples: [
    {
      id: "ManimCELogo",
      className: "ManimCELogo",
      description: "Reproduces the Manim Community logo from primitives.",
      reference: IMG("ManimCELogo"),
      pythonSource: `from manim import *

class ManimCELogo(Scene):
    def construct(self):
        self.camera.background_color = "#ece6e2"
        logo_green = "#87c2a5"
        logo_blue = "#525893"
        logo_red = "#e07a5f"
        logo_black = "#343434"
        ds_m = MathTex(r"\\mathbb{M}", fill_color=logo_black).scale(7)
        ds_m.shift(2.25 * LEFT + 1.5 * UP)
        circle = Circle(color=logo_green, fill_opacity=1).shift(LEFT)
        square = Square(color=logo_blue, fill_opacity=1).shift(UP)
        triangle = Triangle(color=logo_red, fill_opacity=1).shift(RIGHT)
        logo = VGroup(triangle, square, circle, ds_m)  # order matters
        logo.move_to(ORIGIN)
        self.add(logo)`,
      manimTsSource: `import { Circle } from "manim-ts/mobject/geometry/arc";
import { Square, Triangle } from "manim-ts/mobject/geometry/polygram";
import { VGroup } from "manim-ts/mobject/types";
import { MathTex } from "manim-ts/mobject/text";
import { ManimColor } from "manim-ts/utils/color";
import { LEFT, UP, RIGHT, ORIGIN } from "manim-ts/core/math";

class ManimCELogo extends ThreeScene {
  async construct() {
    this.camera.backgroundColor = "#ece6e2";
    const logoGreen = ManimColor.parse("#87c2a5");
    const logoBlue = ManimColor.parse("#525893");
    const logoRed = ManimColor.parse("#e07a5f");
    const logoBlack = ManimColor.parse("#343434");

    const dsM = new MathTex([String.raw\`\\mathbb{M}\`], { fillColor: logoBlack });
    dsM.setFill(logoBlack, 1).setStroke(logoBlack, 0, 0);
    dsM.scale(7);
    dsM.shift(LEFT.multiply(2.25).add(UP.multiply(1.5)));

    // Python \`color=X\` sets fill + stroke; manim-ts needs them passed separately.
    const circle = new Circle({ fillColor: logoGreen, strokeColor: logoGreen, fillOpacity: 1 }).shift(LEFT);
    const square = new Square({ fillColor: logoBlue, strokeColor: logoBlue, fillOpacity: 1 }).shift(UP);
    const triangle = new Triangle({ fillColor: logoRed, strokeColor: logoRed, fillOpacity: 1 }).shift(RIGHT);

    const logo = new VGroup(triangle, square, circle, dsM);
    logo.moveTo(ORIGIN);
    this.add(logo);
  }
}`,
      live: ManimCELogoLive,
    },
    {
      id: "BraceAnnotation",
      className: "BraceAnnotation",
      description: "Annotates a line segment with braces and labels.",
      reference: IMG("BraceAnnotation"),
      pythonSource: `from manim import *

class BraceAnnotation(Scene):
    def construct(self):
        dot = Dot([-2, -1, 0])
        dot2 = Dot([2, 1, 0])
        line = Line(dot.get_center(), dot2.get_center()).set_color(ORANGE)
        b1 = Brace(line)
        b1text = b1.get_text("Horizontal distance")
        b2 = Brace(line, direction=line.copy().rotate(PI / 2).get_unit_vector())
        b2text = b2.get_tex("x-x_1")
        self.add(line, dot, dot2, b1, b2, b1text, b2text)`,
      manimTsSource: `import { Dot } from "manim-ts/mobject/geometry/arc";
import { Line } from "manim-ts/mobject/geometry/line";
import { Brace } from "manim-ts/mobject/svg/brace";
import { Text, BrowserMathTex } from "manim-ts/mobject/text";
import { np, DOWN } from "manim-ts/core/math";
import { ORANGE, WHITE } from "manim-ts/utils/color";

class BraceAnnotation extends Scene {
  async construct() {
    const dot = new Dot({ point: np.array([-2, -1, 0]) });
    const dot2 = new Dot({ point: np.array([2, 1, 0]) });
    const line = new Line(dot.getCenter(), dot2.getCenter()).setColor(ORANGE);

    const b1 = new Brace(line, DOWN);
    const b1text = new Text("Horizontal distance", { color: WHITE }).scale(0.6);
    b1text.nextTo(b1.getTip(), DOWN, { buff: 0.1 });

    // Perpendicular unit vector to the line.
    const [dx, dy] = [4, 2];
    const len = Math.hypot(dx, dy);
    const perp = np.array([-dy / len, dx / len, 0]);
    const b2 = new Brace(line, perp);
    const b2tex = new BrowserMathTex(["x-x_1"]);
    b2tex.nextTo(b2.getTip(), perp, { buff: 0.1 });

    this.add(line, dot, dot2, b1, b2, b1text, b2tex);
  }
}`,
      live: BraceAnnotationLive,
    },
    {
      id: "VectorArrow",
      className: "VectorArrow",
      description: "Draws a labeled vector arrow over a number plane.",
      reference: IMG("VectorArrow"),
      pythonSource: `from manim import *

class VectorArrow(Scene):
    def construct(self):
        dot = Dot(ORIGIN)
        arrow = Arrow(ORIGIN, [2, 2, 0], buff=0)
        numberplane = NumberPlane()
        origin_text = Text('(0, 0)').next_to(dot, DOWN)
        tip_text = Text('(2, 2)').next_to(arrow.get_end(), RIGHT)
        self.add(numberplane, dot, arrow, origin_text, tip_text)`,
      manimTsSource: `import { Dot } from "manim-ts/mobject/geometry/arc";
import { Arrow } from "manim-ts/mobject/geometry/line";
import { NumberPlane } from "manim-ts/mobject/graphing/coordinate_systems";
import { MathTex } from "manim-ts/mobject/text";
import { ORIGIN, DOWN, RIGHT, np } from "manim-ts/core/math";

class VectorArrow extends Scene {
  async construct() {
    const numberplane = new NumberPlane();
    const dot = new Dot({ point: ORIGIN });
    const arrow = new Arrow(ORIGIN, np.array([2, 2, 0]), { buff: 0 });
    // Text isn't browser-safe yet (needs Pango/fs); MathTex works for labels.
    const originText = new MathTex([String.raw\`(0, 0)\`]).nextTo(dot, DOWN);
    const tipText = new MathTex([String.raw\`(2, 2)\`]).nextTo(arrow.getEnd(), RIGHT);
    this.add(numberplane, dot, arrow, originText, tipText);
  }
}`,
      live: VectorArrowLive,
    },
    {
      id: "GradientImageFromArray",
      className: "GradientImageFromArray",
      description: "Builds an image mobject from a numpy gradient array.",
      reference: IMG("GradientImageFromArray"),
      pythonSource: `from manim import *

class GradientImageFromArray(Scene):
    def construct(self):
        n = 256
        imageArray = np.uint8(
            [[i * 256 / n for i in range(0, n)] for _ in range(0, n)]
        )
        image = ImageMobject(imageArray).scale(2)
        image.background_rectangle = SurroundingRectangle(image, color=GREEN)
        self.add(image, image.background_rectangle)`,
      manimTsSource: `import { ImageMobject } from "manim-ts/mobject/types/image_mobject";
import { SurroundingRectangle } from "manim-ts/mobject/geometry/shape_matchers";
import { np } from "manim-ts/core/math";
import { GREEN } from "manim-ts/utils/color";

class GradientImageFromArray extends Scene {
  async construct() {
    const n = 256;
    const arr: number[][] = [];
    for (let r = 0; r < n; r++) {
      const row: number[] = [];
      for (let i = 0; i < n; i++) row.push(Math.floor((i * 256) / n));
      arr.push(row);
    }
    const image = new ImageMobject(np.array(arr)).scale(2);
    const rect = new SurroundingRectangle(image, { color: GREEN });
    this.add(image, rect);
  }
}`,
      live: GradientImageFromArrayLive,
    },
    {
      id: "BooleanOperations",
      className: "BooleanOperations",
      description: "Union, Intersection, Difference, Exclusion on VMobjects.",
      reference: VID("BooleanOperations"),
      pythonSource: `from manim import *

class BooleanOperations(Scene):
    def construct(self):
        ellipse1 = Ellipse(
            width=4.0, height=5.0, fill_opacity=0.5, color=BLUE, stroke_width=10
        ).move_to(LEFT)
        ellipse2 = ellipse1.copy().set_color(color=RED).move_to(RIGHT)
        bool_ops_text = MarkupText("<u>Boolean Operation</u>").next_to(ellipse1, UP * 3)
        ellipse_group = Group(bool_ops_text, ellipse1, ellipse2).move_to(LEFT * 3)
        self.play(FadeIn(ellipse_group))

        i = Intersection(ellipse1, ellipse2, color=GREEN, fill_opacity=0.5)
        self.play(i.animate.scale(0.25).move_to(RIGHT * 5 + UP * 2.5))
        intersection_text = Text("Intersection", font_size=23).next_to(i, UP)
        self.play(FadeIn(intersection_text))

        u = Union(ellipse1, ellipse2, color=ORANGE, fill_opacity=0.5)
        union_text = Text("Union", font_size=23)
        self.play(u.animate.scale(0.3).next_to(i, DOWN, buff=union_text.height * 3))
        union_text.next_to(u, UP)
        self.play(FadeIn(union_text))

        e = Exclusion(ellipse1, ellipse2, color=YELLOW, fill_opacity=0.5)
        exclusion_text = Text("Exclusion", font_size=23)
        self.play(e.animate.scale(0.3).next_to(u, DOWN, buff=exclusion_text.height * 3.5))
        exclusion_text.next_to(e, UP)
        self.play(FadeIn(exclusion_text))

        d = Difference(ellipse1, ellipse2, color=PINK, fill_opacity=0.5)
        difference_text = Text("Difference", font_size=23)
        self.play(d.animate.scale(0.3).next_to(u, LEFT, buff=difference_text.height * 3.5))
        difference_text.next_to(d, UP)
        self.play(FadeIn(difference_text))`,
      manimTsSource: `// manim-ts port of BooleanOperations — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
  ],
};
