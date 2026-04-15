import type { ExampleDef, ExampleSection } from "./registry";

const IMG = (n: string): ExampleDef["reference"] => ({
  kind: "image",
  src: `${import.meta.env.BASE_URL}manim-community/${n}-1.png`,
});
const VID = (n: string): ExampleDef["reference"] => ({
  kind: "video",
  src: `${import.meta.env.BASE_URL}manim-community/${n}-1.mp4`,
});

export const animations: ExampleSection = {
  id: "animations",
  title: "Animations",
  examples: [
    {
      id: "PointMovingOnShapes",
      className: "PointMovingOnShapes",
      description: "Point following a shape via MoveAlongPath.",
      reference: VID("PointMovingOnShapes"),
      pythonSource: `from manim import *

class PointMovingOnShapes(Scene):
    def construct(self):
        circle = Circle(radius=1, color=BLUE)
        dot = Dot()
        dot2 = dot.copy().shift(RIGHT)
        self.add(dot)

        line = Line([3, 0, 0], [5, 0, 0])
        self.add(line)

        self.play(GrowFromCenter(circle))
        self.play(Transform(dot, dot2))
        self.play(MoveAlongPath(dot, circle), run_time=2, rate_func=linear)
        self.play(Rotating(dot, about_point=[2, 0, 0]), run_time=1.5)
        self.wait()`,
      manimTsSource: `// manim-ts port of PointMovingOnShapes — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
    {
      id: "MovingAround",
      className: "MovingAround",
      description: "Combined shift, scale, rotate animations on a square.",
      reference: VID("MovingAround"),
      pythonSource: `from manim import *

class MovingAround(Scene):
    def construct(self):
        square = Square(color=BLUE, fill_opacity=1)

        self.play(square.animate.shift(LEFT))
        self.play(square.animate.set_fill(ORANGE))
        self.play(square.animate.scale(0.3))
        self.play(square.animate.rotate(0.4))`,
      manimTsSource: `// manim-ts port of MovingAround — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
    {
      id: "MovingAngle",
      className: "MovingAngle",
      description: "Angle mobject tracking a rotating line.",
      reference: VID("MovingAngle"),
      pythonSource: `from manim import *

class MovingAngle(Scene):
    def construct(self):
        rotation_center = LEFT

        theta_tracker = ValueTracker(110)
        line1 = Line(LEFT, RIGHT)
        line_moving = Line(LEFT, RIGHT)
        line_ref = line_moving.copy()
        line_moving.rotate(
            theta_tracker.get_value() * DEGREES, about_point=rotation_center
        )
        a = Angle(line1, line_moving, radius=0.5, other_angle=False)
        tex = MathTex(r"\\theta").move_to(
            Angle(
                line1, line_moving, radius=0.5 + 3 * SMALL_BUFF, other_angle=False
            ).point_from_proportion(0.5)
        )

        self.add(line1, line_moving, a, tex)
        self.wait()

        line_moving.add_updater(
            lambda x: x.become(line_ref.copy()).rotate(
                theta_tracker.get_value() * DEGREES, about_point=rotation_center
            )
        )

        a.add_updater(
            lambda x: x.become(Angle(line1, line_moving, radius=0.5, other_angle=False))
        )
        tex.add_updater(
            lambda x: x.move_to(
                Angle(
                    line1, line_moving, radius=0.5 + 3 * SMALL_BUFF, other_angle=False
                ).point_from_proportion(0.5)
            )
        )

        self.play(theta_tracker.animate.set_value(40))
        self.play(theta_tracker.animate.increment_value(140))
        self.play(tex.animate.set_color(RED), run_time=0.5)
        self.play(theta_tracker.animate.set_value(350))`,
      manimTsSource: `// manim-ts port of MovingAngle — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
    {
      id: "MovingDots",
      className: "MovingDots",
      description: "Dots animated toward moving target positions.",
      reference: VID("MovingDots"),
      pythonSource: `from manim import *

class MovingDots(Scene):
    def construct(self):
        d1,d2=Dot(color=BLUE),Dot(color=GREEN)
        dg=VGroup(d1,d2).arrange(RIGHT,buff=1)
        l1=Line(d1.get_center(),d2.get_center()).set_color(RED)
        x=ValueTracker(0)
        y=ValueTracker(0)
        d1.add_updater(lambda z: z.set_x(x.get_value()))
        d2.add_updater(lambda z: z.set_y(y.get_value()))
        l1.add_updater(lambda z: z.become(Line(d1.get_center(),d2.get_center())))
        self.add(d1,d2,l1)
        self.play(x.animate.set_value(5))
        self.play(y.animate.set_value(4))
        self.wait()`,
      manimTsSource: `// manim-ts port of MovingDots — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
    {
      id: "MovingGroupToDestination",
      className: "MovingGroupToDestination",
      description: "Group translated to a destination in one animation.",
      reference: VID("MovingGroupToDestination"),
      pythonSource: `from manim import *

class MovingGroupToDestination(Scene):
    def construct(self):
        group = VGroup(Dot(LEFT), Dot(ORIGIN), Dot(RIGHT, color=RED), Dot(2 * RIGHT)).scale(1.4)
        dest = Dot([4, 3, 0], color=YELLOW)
        self.add(group, dest)
        self.play(group.animate.shift(dest.get_center() - group[2].get_center()))
        self.wait(0.5)`,
      manimTsSource: `// manim-ts port of MovingGroupToDestination — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
    {
      id: "MovingFrameBox",
      className: "MovingFrameBox",
      description: "SurroundingRectangle jumping between formula terms.",
      reference: VID("MovingFrameBox"),
      pythonSource: `from manim import *

class MovingFrameBox(Scene):
    def construct(self):
        text=MathTex(
            "\\\\frac{d}{dx}f(x)g(x)=","f(x)\\\\frac{d}{dx}g(x)","+",
            "g(x)\\\\frac{d}{dx}f(x)"
        )
        self.play(Write(text))
        framebox1 = SurroundingRectangle(text[1], buff = .1)
        framebox2 = SurroundingRectangle(text[3], buff = .1)
        self.play(
            Create(framebox1),
        )
        self.wait()
        self.play(
            ReplacementTransform(framebox1,framebox2),
        )
        self.wait()`,
      manimTsSource: `// manim-ts port of MovingFrameBox — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
    {
      id: "RotationUpdater",
      className: "RotationUpdater",
      description: "Live updater rotating a mobject each frame.",
      reference: VID("RotationUpdater"),
      pythonSource: `from manim import *

class RotationUpdater(Scene):
    def construct(self):
        def updater_forth(mobj, dt):
            mobj.rotate_about_origin(dt)
        def updater_back(mobj, dt):
            mobj.rotate_about_origin(-dt)
        line_reference = Line(ORIGIN, LEFT).set_color(WHITE)
        line_moving = Line(ORIGIN, LEFT).set_color(YELLOW)
        line_moving.add_updater(updater_forth)
        self.add(line_reference, line_moving)
        self.wait(2)
        line_moving.remove_updater(updater_forth)
        line_moving.add_updater(updater_back)
        self.wait(2)
        line_moving.remove_updater(updater_back)
        self.wait(0.5)`,
      manimTsSource: `// manim-ts port of RotationUpdater — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
    {
      id: "PointWithTrace",
      className: "PointWithTrace",
      description: "Traced path following a moving dot.",
      reference: VID("PointWithTrace"),
      pythonSource: `from manim import *

class PointWithTrace(Scene):
    def construct(self):
        path = VMobject()
        dot = Dot()
        path.set_points_as_corners([dot.get_center(), dot.get_center()])
        def update_path(path):
            previous_path = path.copy()
            previous_path.add_points_as_corners([dot.get_center()])
            path.become(previous_path)
        path.add_updater(update_path)
        self.add(path, dot)
        self.play(Rotating(dot, angle=PI, about_point=RIGHT, run_time=2))
        self.wait()
        self.play(dot.animate.shift(UP))
        self.play(dot.animate.shift(LEFT))
        self.wait()`,
      manimTsSource: `// manim-ts port of PointWithTrace — coming soon.
// See the Python reference (right) for the intended behavior.`,
    },
  ],
};
