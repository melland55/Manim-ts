# Python Manim to Manim-ts API Mapping

Complete mapping of every public class, function, and constant from Python Manim to its TypeScript equivalent.

**Naming convention:** Python `snake_case` becomes TypeScript `camelCase` for functions/methods. Class names are preserved exactly.

---

## Animation

### manim.animation.animation

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Animation` | `Animation` | `animation/animation` |
| `Wait` | `Wait` | `animation/animation` |
| `Add` | `Add` | `animation/animation` |
| `prepare_animation()` | `prepareAnimation()` | `animation/animation` |
| `override_animation()` | `overrideAnimation()` | `animation/animation` |

### manim.animation.composition

| Python | TypeScript | Import |
|--------|-----------|--------|
| `AnimationGroup` | `AnimationGroup` | `animation/composition` |
| `Succession` | `Succession` | `animation/composition` |
| `LaggedStart` | `LaggedStart` | `animation/composition` |
| `LaggedStartMap` | `LaggedStartMap` | `animation/composition` |

### manim.animation.creation

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ShowPartial` | `ShowPartial` | `animation/creation` |
| `Create` | `Create` | `animation/creation` |
| `Uncreate` | `Uncreate` | `animation/creation` |
| `DrawBorderThenFill` | `DrawBorderThenFill` | `animation/creation` |
| `Write` | `Write` | `animation/creation` |
| `Unwrite` | `Unwrite` | `animation/creation` |
| `SpiralIn` | `SpiralIn` | `animation/creation` |
| `ShowIncreasingSubsets` | `ShowIncreasingSubsets` | `animation/creation` |
| `ShowSubmobjectsOneByOne` | `ShowSubmobjectsOneByOne` | `animation/creation` |
| `AddTextLetterByLetter` | `AddTextLetterByLetter` | `animation/creation` |
| `RemoveTextLetterByLetter` | `RemoveTextLetterByLetter` | `animation/creation` |
| `AddTextWordByWord` | `AddTextWordByWord` | `animation/creation` |
| `TypeWithCursor` | `TypeWithCursor` | `animation/creation` |
| `UntypeWithCursor` | `UntypeWithCursor` | `animation/creation` |

### manim.animation.fading

| Python | TypeScript | Import |
|--------|-----------|--------|
| `FadeIn` | `FadeIn` | `animation/fading` |
| `FadeOut` | `FadeOut` | `animation/fading` |

### manim.animation.growing

| Python | TypeScript | Import |
|--------|-----------|--------|
| `GrowFromPoint` | `GrowFromPoint` | `animation/growing` |
| `GrowFromCenter` | `GrowFromCenter` | `animation/growing` |
| `GrowFromEdge` | `GrowFromEdge` | `animation/growing` |
| `GrowArrow` | `GrowArrow` | `animation/growing` |
| `SpinInFromNothing` | `SpinInFromNothing` | `animation/growing` |

### manim.animation.indication

| Python | TypeScript | Import |
|--------|-----------|--------|
| `FocusOn` | `FocusOn` | `animation/indication` |
| `Indicate` | `Indicate` | `animation/indication` |
| `Flash` | `Flash` | `animation/indication` |
| `ShowPassingFlash` | `ShowPassingFlash` | `animation/indication` |
| `ShowPassingFlashWithThinningStrokeWidth` | `ShowPassingFlashWithThinningStrokeWidth` | `animation/indication` |
| `ApplyWave` | `ApplyWave` | `animation/indication` |
| `Wiggle` | `Wiggle` | `animation/indication` |
| `Circumscribe` | `Circumscribe` | `animation/indication` |
| `Blink` | `Blink` | `animation/indication` |

### manim.animation.movement

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Homotopy` | `Homotopy` | `animation/movement` |
| `SmoothedVectorizedHomotopy` | `SmoothedVectorizedHomotopy` | `animation/movement` |
| `ComplexHomotopy` | `ComplexHomotopy` | `animation/movement` |
| `PhaseFlow` | `PhaseFlow` | `animation/movement` |
| `MoveAlongPath` | `MoveAlongPath` | `animation/movement` |

### manim.animation.numbers

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ChangingDecimal` | `ChangingDecimal` | `animation/numbers` |
| `ChangeDecimalToValue` | `ChangeDecimalToValue` | `animation/numbers` |

### manim.animation.rotation

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Rotating` | `Rotating` | `animation/rotation` |
| `Rotate` | `Rotate` | `animation/rotation` |

### manim.animation.specialized

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Broadcast` | `Broadcast` | `animation/specialized` |

### manim.animation.speedmodifier

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ChangeSpeed` | `ChangeSpeed` | `animation/speedmodifier` |

### manim.animation.transform

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Transform` | `Transform` | `animation/transform` |
| `ReplacementTransform` | `ReplacementTransform` | `animation/transform` |
| `TransformFromCopy` | `TransformFromCopy` | `animation/transform` |
| `ClockwiseTransform` | `ClockwiseTransform` | `animation/transform` |
| `CounterclockwiseTransform` | `CounterclockwiseTransform` | `animation/transform` |
| `MoveToTarget` | `MoveToTarget` | `animation/transform` |
| `_MethodAnimation` | `_MethodAnimation` | `animation/transform` |
| `ApplyMethod` | `ApplyMethod` | `animation/transform` |
| `ApplyPointwiseFunction` | `ApplyPointwiseFunction` | `animation/transform` |
| `ApplyPointwiseFunctionToCenter` | `ApplyPointwiseFunctionToCenter` | `animation/transform` |
| `FadeToColor` | `FadeToColor` | `animation/transform` |
| `ScaleInPlace` | `ScaleInPlace` | `animation/transform` |
| `ShrinkToCenter` | `ShrinkToCenter` | `animation/transform` |
| `Restore` | `Restore` | `animation/transform` |
| `ApplyFunction` | `ApplyFunction` | `animation/transform` |
| `ApplyMatrix` | `ApplyMatrix` | `animation/transform` |
| `ApplyComplexFunction` | `ApplyComplexFunction` | `animation/transform` |
| `CyclicReplace` | `CyclicReplace` | `animation/transform` |
| `Swap` | `Swap` | `animation/transform` |
| `TransformAnimations` | `TransformAnimations` | `animation/transform` |
| `FadeTransform` | `FadeTransform` | `animation/transform` |
| `FadeTransformPieces` | `FadeTransformPieces` | `animation/transform` |

### manim.animation.transform_matching_parts

| Python | TypeScript | Import |
|--------|-----------|--------|
| `TransformMatchingAbstractBase` | `TransformMatchingAbstractBase` | `animation/transform_matching_parts` |
| `TransformMatchingShapes` | `TransformMatchingShapes` | `animation/transform_matching_parts` |
| `TransformMatchingTex` | `TransformMatchingTex` | `animation/transform_matching_parts` |

### manim.animation.changing

| Python | TypeScript | Import |
|--------|-----------|--------|
| `AnimatedBoundary` | `AnimatedBoundary` | `animation/changing` |
| `TracedPath` | `TracedPath` | `animation/changing` |

### manim.animation.updaters

| Python | TypeScript | Import |
|--------|-----------|--------|
| `UpdateFromFunc` | `UpdateFromFunc` | `animation/updaters` |
| `UpdateFromAlphaFunc` | `UpdateFromAlphaFunc` | `animation/updaters` |
| `MaintainPositionRelativeTo` | `MaintainPositionRelativeTo` | `animation/updaters` |
| `always_redraw()` | `alwaysRedraw()` | `animation/updaters` |
| `always_shift()` | `alwaysShift()` | `animation/updaters` |
| `always_rotate()` | `alwaysRotate()` | `animation/updaters` |
| `turn_animation_into_updater()` | `turnAnimationIntoUpdater()` | `animation/updaters` |
| `cycle_animation()` | `cycleAnimation()` | `animation/updaters` |
| `assert_is_mobject_method()` | `assertIsMobjectMethod()` | `animation/updaters` |
| `always()` | `always()` | `animation/updaters` |
| `f_always()` | `fAlways()` | `animation/updaters` |

---

## Mobject

### manim.mobject.mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Mobject` | `Mobject` | `mobject/mobject` |
| `Group` | `Group` | `mobject/mobject` |
| `_AnimationBuilder` | `AnimationBuilder` | `mobject/mobject` |
| `_UpdaterBuilder` | `UpdaterBuilder` | `mobject/mobject` |

### manim.mobject.types.vectorized_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `VMobject` | `VMobject` | `mobject/types` |
| `VGroup` | `VGroup` | `mobject/types` |
| `VDict` | `VDict` | `mobject/types` |
| `VectorizedPoint` | `VectorizedPoint` | `mobject/types` |
| `CurvesAsSubmobjects` | `CurvesAsSubmobjects` | `mobject/types` |
| `DashedVMobject` | `DashedVMobject` | `mobject/types` |

### manim.mobject.types.point_cloud_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `PMobject` | `PMobject` | `mobject/types` |
| `Mobject1D` | `Mobject1D` | `mobject/types` |
| `Mobject2D` | `Mobject2D` | `mobject/types` |
| `PGroup` | `PGroup` | `mobject/types` |
| `PointCloudDot` | `PointCloudDot` | `mobject/types` |
| `Point` | `Point` | `mobject/types` |

### manim.mobject.types.image_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `AbstractImageMobject` | `AbstractImageMobject` | `mobject/types` |
| `ImageMobject` | `ImageMobject` | `mobject/types` |
| `ImageMobjectFromCamera` | `ImageMobjectFromCamera` | `mobject/types` |

### manim.mobject.geometry.arc

| Python | TypeScript | Import |
|--------|-----------|--------|
| `TipableVMobject` | `TipableVMobject` | `mobject/geometry` |
| `Arc` | `Arc` | `mobject/geometry` |
| `ArcBetweenPoints` | `ArcBetweenPoints` | `mobject/geometry` |
| `TangentialArc` | `TangentialArc` | `mobject/geometry` |
| `CurvedArrow` | `CurvedArrow` | `mobject/geometry` |
| `CurvedDoubleArrow` | `CurvedDoubleArrow` | `mobject/geometry` |
| `Circle` | `Circle` | `mobject/geometry` |
| `Dot` | `Dot` | `mobject/geometry` |
| `AnnotationDot` | `AnnotationDot` | `mobject/geometry` |
| `LabeledDot` | `LabeledDot` | `mobject/geometry` |
| `Ellipse` | `Ellipse` | `mobject/geometry` |
| `AnnularSector` | `AnnularSector` | `mobject/geometry` |
| `Sector` | `Sector` | `mobject/geometry` |
| `Annulus` | `Annulus` | `mobject/geometry` |
| `CubicBezier` | `CubicBezier` | `mobject/geometry` |
| `ArcPolygon` | `ArcPolygon` | `mobject/geometry` |
| `ArcPolygonFromArcs` | `ArcPolygonFromArcs` | `mobject/geometry` |

### manim.mobject.geometry.line

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Line` | `Line` | `mobject/geometry` |
| `DashedLine` | `DashedLine` | `mobject/geometry` |
| `TangentLine` | `TangentLine` | `mobject/geometry` |
| `Elbow` | `Elbow` | `mobject/geometry` |
| `Arrow` | `Arrow` | `mobject/geometry` |
| `Vector` | `Vector` | `mobject/geometry` |
| `DoubleArrow` | `DoubleArrow` | `mobject/geometry` |
| `Angle` | `Angle` | `mobject/geometry` |
| `RightAngle` | `RightAngle` | `mobject/geometry` |

### manim.mobject.geometry.polygram

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Polygram` | `Polygram` | `mobject/geometry` |
| `Polygon` | `Polygon` | `mobject/geometry` |
| `RegularPolygram` | `RegularPolygram` | `mobject/geometry` |
| `RegularPolygon` | `RegularPolygon` | `mobject/geometry` |
| `Star` | `Star` | `mobject/geometry` |
| `Triangle` | `Triangle` | `mobject/geometry` |
| `Rectangle` | `Rectangle` | `mobject/geometry` |
| `Square` | `Square` | `mobject/geometry` |
| `RoundedRectangle` | `RoundedRectangle` | `mobject/geometry` |
| `Cutout` | `Cutout` | `mobject/geometry` |

### manim.mobject.geometry.tips

| Python | TypeScript | Import |
|--------|-----------|--------|
| `StealthTip` | `StealthTip` | `mobject/geometry` |
| `ArrowTriangleTip` | `ArrowTriangleTip` | `mobject/geometry` |
| `ArrowTriangleFilledTip` | `ArrowTriangleFilledTip` | `mobject/geometry` |
| `ArrowCircleTip` | `ArrowCircleTip` | `mobject/geometry` |
| `ArrowCircleFilledTip` | `ArrowCircleFilledTip` | `mobject/geometry` |
| `ArrowSquareTip` | `ArrowSquareTip` | `mobject/geometry` |
| `ArrowSquareFilledTip` | `ArrowSquareFilledTip` | `mobject/geometry` |

### manim.mobject.geometry.labeled

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Label` | `Label` | `mobject/geometry` |
| `LabeledLine` | `LabeledLine` | `mobject/geometry` |
| `LabeledArrow` | `LabeledArrow` | `mobject/geometry` |
| `LabeledPolygram` | `LabeledPolygram` | `mobject/geometry` |

### manim.mobject.geometry.shape_matchers

| Python | TypeScript | Import |
|--------|-----------|--------|
| `SurroundingRectangle` | `SurroundingRectangle` | `mobject/geometry` |
| `BackgroundRectangle` | `BackgroundRectangle` | `mobject/geometry` |
| `Cross` | `Cross` | `mobject/geometry` |
| `Underline` | `Underline` | `mobject/geometry` |

### manim.mobject.geometry.boolean_ops

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Union` | `Union` | `mobject/geometry` |
| `Difference` | `Difference` | `mobject/geometry` |
| `Intersection` | `Intersection` | `mobject/geometry` |
| `Exclusion` | `Exclusion` | `mobject/geometry` |

### manim.mobject.svg.svg_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `SVGMobject` | `SVGMobject` | `mobject/svg` |
| `VMobjectFromSVGPath` | `VMobjectFromSVGPath` | `mobject/svg` |

### manim.mobject.svg.brace

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Brace` | `Brace` | `mobject/svg` |
| `BraceLabel` | `BraceLabel` | `mobject/svg` |
| `BraceText` | `BraceText` | `mobject/svg` |
| `BraceBetweenPoints` | `BraceBetweenPoints` | `mobject/svg` |
| `ArcBrace` | `ArcBrace` | `mobject/svg` |

### manim.mobject.text.tex_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `SingleStringMathTex` | `SingleStringMathTex` | `mobject/text` |
| `MathTex` | `MathTex` | `mobject/text` |
| `Tex` | `Tex` | `mobject/text` |
| `BulletedList` | `BulletedList` | `mobject/text` |
| `Title` | `Title` | `mobject/text` |

### manim.mobject.text.text_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Text` | `Text` | `mobject/text` |
| `MarkupText` | `MarkupText` | `mobject/text` |
| `Paragraph` | `Paragraph` | `mobject/text` |
| `remove_invisible_chars()` | `removeInvisibleChars()` | `mobject/text` |

### manim.mobject.text.code_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Code` | `Code` | `mobject/text` |

### manim.mobject.text.numbers

| Python | TypeScript | Import |
|--------|-----------|--------|
| `DecimalNumber` | `DecimalNumber` | `mobject/text` |
| `Integer` | `Integer` | `mobject/text` |
| `Variable` | `Variable` | `mobject/text` |

### manim.mobject.graphing.coordinate_systems

| Python | TypeScript | Import |
|--------|-----------|--------|
| `CoordinateSystem` | `CoordinateSystem` | `mobject/graphing` |
| `Axes` | `Axes` | `mobject/graphing` |
| `ThreeDAxes` | `ThreeDAxes` | `mobject/graphing` |
| `NumberPlane` | `NumberPlane` | `mobject/graphing` |
| `PolarPlane` | `PolarPlane` | `mobject/graphing` |
| `ComplexPlane` | `ComplexPlane` | `mobject/graphing` |

### manim.mobject.graphing.functions

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ParametricFunction` | `ParametricFunction` | `mobject/graphing` |
| `FunctionGraph` | `FunctionGraph` | `mobject/graphing` |
| `ImplicitFunction` | `ImplicitFunction` | `mobject/graphing` |

### manim.mobject.graphing.number_line

| Python | TypeScript | Import |
|--------|-----------|--------|
| `NumberLine` | `NumberLine` | `mobject/graphing` |
| `UnitInterval` | `UnitInterval` | `mobject/graphing` |

### manim.mobject.graphing.probability

| Python | TypeScript | Import |
|--------|-----------|--------|
| `SampleSpace` | `SampleSpace` | `mobject/graphing` |
| `BarChart` | `BarChart` | `mobject/graphing` |

### manim.mobject.graphing.scale

| Python | TypeScript | Import |
|--------|-----------|--------|
| `_ScaleBase` | `_ScaleBase` | `mobject/graphing` |
| `LinearBase` | `LinearBase` | `mobject/graphing` |
| `LogBase` | `LogBase` | `mobject/graphing` |

### manim.mobject.three_d.three_dimensions

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ThreeDVMobject` | `ThreeDVMobject` | `mobject/three_d` |
| `Surface` | `Surface` | `mobject/three_d` |
| `ParametricSurface` | `ParametricSurface` | `mobject/three_d` |
| `Sphere` | `Sphere` | `mobject/three_d` |
| `Dot3D` | `Dot3D` | `mobject/three_d` |
| `Cube` | `Cube` | `mobject/three_d` |
| `Prism` | `Prism` | `mobject/three_d` |
| `Cone` | `Cone` | `mobject/three_d` |
| `Cylinder` | `Cylinder` | `mobject/three_d` |
| `Line3D` | `Line3D` | `mobject/three_d` |
| `Arrow3D` | `Arrow3D` | `mobject/three_d` |
| `Torus` | `Torus` | `mobject/three_d` |

### manim.mobject.three_d.polyhedra

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Polyhedron` | `Polyhedron` | `mobject/three_d` |
| `Tetrahedron` | `Tetrahedron` | `mobject/three_d` |
| `Octahedron` | `Octahedron` | `mobject/three_d` |
| `Icosahedron` | `Icosahedron` | `mobject/three_d` |
| `Dodecahedron` | `Dodecahedron` | `mobject/three_d` |

### manim.mobject.graph

| Python | TypeScript | Import |
|--------|-----------|--------|
| `GenericGraph` | `GenericGraph` | `mobject/graph` |
| `Graph` | `Graph` | `mobject/graph` |
| `DiGraph` | `DiGraph` | `mobject/graph` |

### manim.mobject.matrix

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Matrix` | `Matrix` | `mobject/matrix` |
| `DecimalMatrix` | `DecimalMatrix` | `mobject/matrix` |
| `IntegerMatrix` | `IntegerMatrix` | `mobject/matrix` |
| `MobjectMatrix` | `MobjectMatrix` | `mobject/matrix` |
| `matrix_to_tex_string()` | `matrixToTexString()` | `mobject/matrix` |
| `matrix_to_mobject()` | `matrixToMobject()` | `mobject/matrix` |
| `get_det_text()` | `getDetText()` | `mobject/matrix` |

### manim.mobject.table

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Table` | `Table` | `mobject/table` |
| `MathTable` | `MathTable` | `mobject/table` |
| `MobjectTable` | `MobjectTable` | `mobject/table` |
| `IntegerTable` | `IntegerTable` | `mobject/table` |
| `DecimalTable` | `DecimalTable` | `mobject/table` |

### manim.mobject.value_tracker

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ValueTracker` | `ValueTracker` | `mobject/value_tracker` |
| `ComplexValueTracker` | `ComplexValueTracker` | `mobject/value_tracker` |

### manim.mobject.vector_field

| Python | TypeScript | Import |
|--------|-----------|--------|
| `VectorField` | `VectorField` | `mobject/vector_field` |
| `ArrowVectorField` | `ArrowVectorField` | `mobject/vector_field` |
| `StreamLines` | `StreamLines` | `mobject/vector_field` |

### manim.mobject.frame

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ScreenRectangle` | `ScreenRectangle` | `mobject/frame` |
| `FullScreenRectangle` | `FullScreenRectangle` | `mobject/frame` |

### manim.mobject.logo

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ManimBanner` | `ManimBanner` | `mobject/logo` |

### manim.mobject.utils

| Python | TypeScript | Import |
|--------|-----------|--------|
| `get_vectorized_mobject_class()` | `getVectorizedMobjectClass()` | `mobject/utils` |
| `get_point_mobject_class()` | `getPointMobjectClass()` | `mobject/utils` |
| `get_mobject_class()` | `getMobjectClass()` | `mobject/utils` |

---

## Scene

### manim.scene.scene

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Scene` | `Scene` | `scene/scene` |

### manim.scene.moving_camera_scene

| Python | TypeScript | Import |
|--------|-----------|--------|
| `MovingCameraScene` | `MovingCameraScene` | `scene/moving_camera_scene` |

### manim.scene.three_d_scene

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ThreeDScene` | `ThreeDScene` | `scene/three_d_scene` |
| `SpecialThreeDScene` | `SpecialThreeDScene` | `scene/three_d_scene` |

### manim.scene.vector_space_scene

| Python | TypeScript | Import |
|--------|-----------|--------|
| `VectorScene` | `VectorScene` | `scene/vector_space_scene` |
| `LinearTransformationScene` | `LinearTransformationScene` | `scene/vector_space_scene` |

### manim.scene.zoomed_scene

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ZoomedScene` | `ZoomedScene` | `scene/zoomed_scene` |

### manim.scene.scene_file_writer

| Python | TypeScript | Import |
|--------|-----------|--------|
| `SceneFileWriter` | `SceneFileWriter` | `scene/scene_file_writer` |

### manim.scene.section

| Python | TypeScript | Import |
|--------|-----------|--------|
| `DefaultSectionType` | `DefaultSectionType` | `scene/section` |
| `Section` | `Section` | `scene/section` |

---

## Camera

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Camera` | `Camera` | `camera/camera` |
| `BackgroundColoredVMobjectDisplayer` | `BackgroundColoredVMobjectDisplayer` | `camera/camera` |
| `MovingCamera` | `MovingCamera` | `camera/moving_camera` |
| `ThreeDCamera` | `ThreeDCamera` | `camera/three_d_camera` |
| `MultiCamera` | `MultiCamera` | `camera/multi_camera` |
| `MappingCamera` | `MappingCamera` | `camera/mapping_camera` |
| `OldMultiCamera` | `OldMultiCamera` | `camera/mapping_camera` |
| `SplitScreenCamera` | `SplitScreenCamera` | `camera/mapping_camera` |

---

## Renderer

| Python | TypeScript | Import |
|--------|-----------|--------|
| `Renderer` | `Renderer` | `renderer/renderer` |
| `CairoRenderer` | `CairoRenderer` | `renderer/cairo_renderer` |
| `OpenGLRenderer` | `OpenGLRenderer` | `renderer/opengl_renderer` |
| `OpenGLCamera` | `OpenGLCamera` | `renderer/opengl_renderer` |
| `Window` | `Window` | `renderer/opengl_renderer_window` |
| `Object3D` | `Object3D` | `renderer/shader` |
| `Mesh` | `Mesh` | `renderer/shader` |
| `Shader` | `Shader` | `renderer/shader` |
| `FullScreenQuad` | `FullScreenQuad` | `renderer/shader` |
| `ShaderWrapper` | `ShaderWrapper` | `renderer/shader_wrapper` |

---

## OpenGL Mobjects

### manim.mobject.opengl.opengl_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `OpenGLMobject` | `OpenGLMobject` | `mobject/opengl` |
| `OpenGLGroup` | `OpenGLGroup` | `mobject/opengl` |
| `OpenGLPoint` | `OpenGLPoint` | `mobject/opengl` |

### manim.mobject.opengl.opengl_vectorized_mobject

| Python | TypeScript | Import |
|--------|-----------|--------|
| `OpenGLVMobject` | `OpenGLVMobject` | `mobject/opengl` |
| `OpenGLVGroup` | `OpenGLVGroup` | `mobject/opengl` |
| `OpenGLVectorizedPoint` | `OpenGLVectorizedPoint` | `mobject/opengl` |
| `OpenGLCurvesAsSubmobjects` | `OpenGLCurvesAsSubmobjects` | `mobject/opengl` |
| `OpenGLDashedVMobject` | `OpenGLDashedVMobject` | `mobject/opengl` |

### manim.mobject.opengl.opengl_compatibility

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ConvertToOpenGL` (metaclass) | `convertToOpenGL()` / `registerOpenGLEquivalent()` | `mobject/opengl` |

### manim.mobject.opengl.opengl_geometry

| Python | TypeScript | Import |
|--------|-----------|--------|
| `OpenGLTipableVMobject` | `OpenGLTipableVMobject` | `mobject/opengl` |
| `OpenGLArc` | `OpenGLArc` | `mobject/opengl` |
| `OpenGLArcBetweenPoints` | `OpenGLArcBetweenPoints` | `mobject/opengl` |
| `OpenGLCurvedArrow` | `OpenGLCurvedArrow` | `mobject/opengl` |
| `OpenGLCurvedDoubleArrow` | `OpenGLCurvedDoubleArrow` | `mobject/opengl` |
| `OpenGLCircle` | `OpenGLCircle` | `mobject/opengl` |
| `OpenGLDot` | `OpenGLDot` | `mobject/opengl` |
| `OpenGLEllipse` | `OpenGLEllipse` | `mobject/opengl` |
| `OpenGLAnnularSector` | `OpenGLAnnularSector` | `mobject/opengl` |
| `OpenGLSector` | `OpenGLSector` | `mobject/opengl` |
| `OpenGLAnnulus` | `OpenGLAnnulus` | `mobject/opengl` |
| `OpenGLLine` | `OpenGLLine` | `mobject/opengl` |
| `OpenGLDashedLine` | `OpenGLDashedLine` | `mobject/opengl` |
| `OpenGLTangentLine` | `OpenGLTangentLine` | `mobject/opengl` |
| `OpenGLElbow` | `OpenGLElbow` | `mobject/opengl` |
| `OpenGLArrow` | `OpenGLArrow` | `mobject/opengl` |
| `OpenGLVector` | `OpenGLVector` | `mobject/opengl` |
| `OpenGLDoubleArrow` | `OpenGLDoubleArrow` | `mobject/opengl` |
| `OpenGLCubicBezier` | `OpenGLCubicBezier` | `mobject/opengl` |
| `OpenGLPolygon` | `OpenGLPolygon` | `mobject/opengl` |
| `OpenGLRegularPolygon` | `OpenGLRegularPolygon` | `mobject/opengl` |
| `OpenGLTriangle` | `OpenGLTriangle` | `mobject/opengl` |
| `OpenGLArrowTip` | `OpenGLArrowTip` | `mobject/opengl` |
| `OpenGLRectangle` | `OpenGLRectangle` | `mobject/opengl` |
| `OpenGLSquare` | `OpenGLSquare` | `mobject/opengl` |
| `OpenGLRoundedRectangle` | `OpenGLRoundedRectangle` | `mobject/opengl` |

### manim.mobject.opengl extras

| Python | TypeScript | Import |
|--------|-----------|--------|
| `DotCloud` | `DotCloud` | `mobject/opengl` |
| `TrueDot` | `TrueDot` | `mobject/opengl` |
| `OpenGLSurface` | `OpenGLSurface` | `mobject/opengl` |
| `OpenGLSurfaceGroup` | `OpenGLSurfaceGroup` | `mobject/opengl` |
| `OpenGLTexturedSurface` | `OpenGLTexturedSurface` | `mobject/opengl` |
| `OpenGLSurfaceMesh` | `OpenGLSurfaceMesh` | `mobject/opengl` |
| `OpenGLPMobject` | `OpenGLPMobject` | `mobject/opengl` |
| `OpenGLPGroup` | `OpenGLPGroup` | `mobject/opengl` |
| `OpenGLPMPoint` | `OpenGLPMPoint` | `mobject/opengl` |
| `OpenGLImageMobject` | `OpenGLImageMobject` | `mobject/opengl` |

---

## Utils

### manim.utils.bezier

| Python | TypeScript | Import |
|--------|-----------|--------|
| `bezier()` | `bezier()` | `utils/bezier` |
| `partial_bezier_points()` | `partialBezierPoints()` | `utils/bezier` |
| `split_bezier()` | `splitBezier()` | `utils/bezier` |
| `subdivide_bezier()` | `subdivideBezier()` | `utils/bezier` |
| `bezier_remap()` | `bezierRemap()` | `utils/bezier` |
| `integer_interpolate()` | `integerInterpolate()` | `utils/bezier` |
| `interpolate()` | `interpolate()` | `utils/bezier` |
| `get_smooth_cubic_bezier_handle_points()` | `getSmoothCubicBezierHandlePoints()` | `utils/bezier` |
| `proportions_along_bezier_curve_for_point()` | `proportionsAlongBezierCurveForPoint()` | `utils/bezier` |
| `point_lies_on_bezier()` | `pointLiesOnBezier()` | `utils/bezier` |

### manim.utils.space_ops

| Python | TypeScript | Import |
|--------|-----------|--------|
| `quaternion_mult()` | `quaternionMult()` | `utils/space_ops` |
| `quaternion_from_angle_axis()` | `quaternionFromAngleAxis()` | `utils/space_ops` |
| `angle_axis_from_quaternion()` | `angleAxisFromQuaternion()` | `utils/space_ops` |
| `quaternion_conjugate()` | `quaternionConjugate()` | `utils/space_ops` |
| `rotate_vector()` | `rotateVector()` | `utils/space_ops` |
| `thick_diagonal()` | `thickDiagonal()` | `utils/space_ops` |
| `rotation_matrix()` | `rotationMatrix()` | `utils/space_ops` |
| `rotation_about_z()` | `rotationAboutZ()` | `utils/space_ops` |
| `z_to_vector()` | `zToVector()` | `utils/space_ops` |
| `angle_of_vector()` | `angleOfVector()` | `utils/space_ops` |
| `angle_between_vectors()` | `angleBetweenVectors()` | `utils/space_ops` |
| `normalize()` | `normalize()` | `utils/space_ops` |
| `normalize_along_axis()` | `normalizeAlongAxis()` | `utils/space_ops` |
| `get_unit_normal()` | `getUnitNormal()` | `utils/space_ops` |
| `compass_directions()` | `compassDirections()` | `utils/space_ops` |
| `regular_vertices()` | `regularVertices()` | `utils/space_ops` |
| `complex_to_R3()` | `complexToR3()` | `utils/space_ops` |
| `R3_to_complex()` | `r3ToComplex()` | `utils/space_ops` |
| `complex_func_to_R3_func()` | `complexFuncToR3Func()` | `utils/space_ops` |
| `center_of_mass()` | `centerOfMass()` | `utils/space_ops` |
| `midpoint()` | `midpoint()` | `utils/space_ops` |
| `line_intersection()` | `lineIntersection()` | `utils/space_ops` |
| `find_intersection()` | `findIntersection()` | `utils/space_ops` |
| `get_winding_number()` | `getWindingNumber()` | `utils/space_ops` |
| `shoelace_direction()` | `shoelaceDirection()` | `utils/space_ops` |
| `cross2d()` | `cross2d()` | `utils/space_ops` |
| `earclip_triangulation()` | `earclipTriangulation()` | `utils/space_ops` |
| `cartesian_to_spherical()` | `cartesianToSpherical()` | `utils/space_ops` |
| `spherical_to_cartesian()` | `sphericalToCartesian()` | `utils/space_ops` |
| `perpendicular_bisector()` | `perpendicularBisector()` | `utils/space_ops` |

### manim.utils.rate_functions

| Python | TypeScript | Import |
|--------|-----------|--------|
| `linear` | `linear` | `utils/rate_functions` |
| `smooth()` | `smooth()` | `utils/rate_functions` |
| `rush_into()` | `rushInto()` | `utils/rate_functions` |
| `rush_from()` | `rushFrom()` | `utils/rate_functions` |
| `slow_into` | `slowInto` | `utils/rate_functions` |
| `double_smooth` | `doubleSmooth` | `utils/rate_functions` |
| `there_and_back` | `thereAndBack` | `utils/rate_functions` |
| `there_and_back_with_pause()` | `thereAndBackWithPause()` | `utils/rate_functions` |
| `running_start()` | `runningStart()` | `utils/rate_functions` |
| `wiggle` | `wiggle` | `utils/rate_functions` |
| `squish_rate_func()` | `squishRateFunc()` | `utils/rate_functions` |
| `lingering` | `lingering` | `utils/rate_functions` |
| `exponential_decay()` | `exponentialDecay()` | `utils/rate_functions` |
| `ease_in_sine` | `easeInSine` | `utils/rate_functions` |
| `ease_out_sine` | `easeOutSine` | `utils/rate_functions` |
| `ease_in_out_sine` | `easeInOutSine` | `utils/rate_functions` |
| `ease_in_quad` | `easeInQuad` | `utils/rate_functions` |
| `ease_out_quad` | `easeOutQuad` | `utils/rate_functions` |
| `ease_in_out_quad` | `easeInOutQuad` | `utils/rate_functions` |
| `ease_in_cubic` | `easeInCubic` | `utils/rate_functions` |
| `ease_out_cubic` | `easeOutCubic` | `utils/rate_functions` |
| `ease_in_out_cubic` | `easeInOutCubic` | `utils/rate_functions` |
| `ease_in_quart` | `easeInQuart` | `utils/rate_functions` |
| `ease_out_quart` | `easeOutQuart` | `utils/rate_functions` |
| `ease_in_out_quart` | `easeInOutQuart` | `utils/rate_functions` |
| `ease_in_quint` | `easeInQuint` | `utils/rate_functions` |
| `ease_out_quint` | `easeOutQuint` | `utils/rate_functions` |
| `ease_in_out_quint` | `easeInOutQuint` | `utils/rate_functions` |
| `ease_in_expo` | `easeInExpo` | `utils/rate_functions` |
| `ease_out_expo` | `easeOutExpo` | `utils/rate_functions` |
| `ease_in_out_expo` | `easeInOutExpo` | `utils/rate_functions` |
| `ease_in_circ` | `easeInCirc` | `utils/rate_functions` |
| `ease_out_circ` | `easeOutCirc` | `utils/rate_functions` |
| `ease_in_out_circ` | `easeInOutCirc` | `utils/rate_functions` |
| `ease_in_back` | `easeInBack` | `utils/rate_functions` |
| `ease_out_back` | `easeOutBack` | `utils/rate_functions` |
| `ease_in_out_back` | `easeInOutBack` | `utils/rate_functions` |
| `ease_in_elastic` | `easeInElastic` | `utils/rate_functions` |
| `ease_out_elastic` | `easeOutElastic` | `utils/rate_functions` |
| `ease_in_out_elastic` | `easeInOutElastic` | `utils/rate_functions` |
| `ease_in_bounce` | `easeInBounce` | `utils/rate_functions` |
| `ease_out_bounce` | `easeOutBounce` | `utils/rate_functions` |
| `ease_in_out_bounce` | `easeInOutBounce` | `utils/rate_functions` |

### manim.utils.paths

| Python | TypeScript | Import |
|--------|-----------|--------|
| `straight_path()` | `straightPath()` | `utils/paths` |
| `path_along_arc()` | `pathAlongArc()` | `utils/paths` |
| `path_along_circles()` | `pathAlongCircles()` | `utils/paths` |
| `clockwise_path()` | `clockwisePath()` | `utils/paths` |
| `counterclockwise_path()` | `counterclockwisePath()` | `utils/paths` |
| `spiral_path()` | `spiralPath()` | `utils/paths` |

### manim.utils.iterables

| Python | TypeScript | Import |
|--------|-----------|--------|
| `remove_list_redundancies()` | `removeListRedundancies()` | `utils/iterables` |
| `list_update()` | `listUpdate()` | `utils/iterables` |
| `list_difference_update()` | `listDifferenceUpdate()` | `utils/iterables` |
| `adjacent_n_tuples()` | `adjacentNTuples()` | `utils/iterables` |
| `adjacent_pairs()` | `adjacentPairs()` | `utils/iterables` |
| `batch_by_property()` | `batchByProperty()` | `utils/iterables` |
| `tuplify()` | `tuplify()` | `utils/iterables` |
| `stretch_array_to_length()` | `stretchArrayToLength()` | `utils/iterables` |
| `make_even()` | `makeEven()` | `utils/iterables` |
| `hash_obj()` | `hashObj()` | `utils/iterables` |
| `resize_array()` | `resizeArray()` | `utils/iterables` |
| `resize_preserving_order()` | `resizePreservingOrder()` | `utils/iterables` |
| `resize_with_interpolation()` | `resizeWithInterpolation()` | `utils/iterables` |
| `uniq_chain()` | `uniqChain()` | `utils/iterables` |

### manim.utils.simple_functions

| Python | TypeScript | Import |
|--------|-----------|--------|
| `clip()` | `clip()` | `utils/simple_functions` |
| `binary_search()` | `binarySearch()` | `utils/simple_functions` |
| `choose()` | `choose()` | `utils/simple_functions` |
| `sigmoid()` | `sigmoid()` | `utils/simple_functions` |

### manim.utils.color

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ManimColor` | `ManimColor` | `utils/color` |
| `HSV` | `HSV` | `utils/color` |
| `RandomColorGenerator` | `RandomColorGenerator` | `utils/color` |
| `color_to_rgb()` | `colorToRgb()` | `utils/color` |
| `color_to_rgba()` | `colorToRgba()` | `utils/color` |
| `color_to_int_rgb()` | `colorToIntRgb()` | `utils/color` |
| `color_to_int_rgba()` | `colorToIntRgba()` | `utils/color` |
| `rgb_to_color()` | `rgbToColor()` | `utils/color` |
| `rgba_to_color()` | `rgbaToColor()` | `utils/color` |
| `rgb_to_hex()` | `rgbToHex()` | `utils/color` |
| `hex_to_rgb()` | `hexToRgb()` | `utils/color` |
| `invert_color()` | `invertColor()` | `utils/color` |
| `color_gradient()` | `colorGradient()` | `utils/color` |
| `interpolate_color()` | `interpolateColor()` | `utils/color` |
| `average_color()` | `averageColor()` | `utils/color` |
| `random_bright_color()` | `randomBrightColor()` | `utils/color` |
| `random_color()` | `randomColor()` | `utils/color` |
| `get_shaded_rgb()` | `getShadedRgb()` | `utils/color` |

### manim.utils.tex

| Python | TypeScript | Import |
|--------|-----------|--------|
| `TexTemplate` | `TexTemplate` | `utils/tex` |

### manim.utils.tex_templates

| Python | TypeScript | Import |
|--------|-----------|--------|
| `TexTemplateLibrary` | `TexTemplateLibrary` | `utils/tex_templates` |
| `TexFontTemplates` | `TexFontTemplates` | `utils/tex_templates` |

### manim.utils.tex_file_writing

| Python | TypeScript | Import |
|--------|-----------|--------|
| `tex_hash()` | `texHash()` | `utils/tex_file_writing` |
| `tex_to_svg_file()` | `texToSvgFile()` | `utils/tex_file_writing` |
| `generate_tex_file()` | `generateTexFile()` | `utils/tex_file_writing` |

### manim.utils.file_ops

| Python | TypeScript | Import |
|--------|-----------|--------|
| `open_file()` | `openFile()` | `utils/file_ops` |
| `guarantee_existence()` | `guaranteeExistence()` | `utils/file_ops` |
| `seek_full_path_for_file()` | `seekFullPathFromDefaults()` | `utils/file_ops` |
| `add_extension_if_not_present()` | `addExtensionIfNotPresent()` | `utils/file_ops` |
| `modify_atime()` | `modifyAtime()` | `utils/file_ops` |

### manim.utils.config_ops

| Python | TypeScript | Import |
|--------|-----------|--------|
| `DictAsObject` | `DictAsObject` | `utils/config_ops` |
| `_Data` | `DataDescriptor` | `utils/config_ops` |
| `_Uniforms` | `UniformsDescriptor` | `utils/config_ops` |

---

## Configuration

### manim._config

| Python | TypeScript | Import |
|--------|-----------|--------|
| `ManimConfig` | `ManimConfig` | `_config` |
| `ManimFrame` | `ManimFrame` | `_config` |
| `make_config_parser()` | `makeConfigParser()` | `_config` |
| `config_file_paths()` | `configFilePaths()` | `_config` |
| `JSONFormatter` | `JSONFormatter` | `_config/logger_utils` |

---

## Constants

### manim.constants

| Python | TypeScript | Import |
|--------|-----------|--------|
| `PI` | `PI` | `core/math` |
| `TAU` | `TAU` | `core/math` |
| `DEGREES` | `DEGREES` | `core/math` |
| `ORIGIN` | `ORIGIN` | `core/math` |
| `UP` | `UP` | `core/math` |
| `DOWN` | `DOWN` | `core/math` |
| `LEFT` | `LEFT` | `core/math` |
| `RIGHT` | `RIGHT` | `core/math` |
| `OUT` | `OUT` | `core/math` |
| `IN` | `IN` | `core/math` |
| `UL` | `UL` | `constants` |
| `UR` | `UR` | `constants` |
| `DL` | `DL` | `constants` |
| `DR` | `DR` | `constants` |
| `X_AXIS` | `X_AXIS` | `constants` |
| `Y_AXIS` | `Y_AXIS` | `constants` |
| `Z_AXIS` | `Z_AXIS` | `constants` |
| `RendererType` | `RendererType` | `constants` |
| `LineJointType` | `LineJointType` | `constants` |
| `CapStyleType` | `CapStyleType` | `constants` |
| `QUALITIES` | `QUALITIES` | `constants` |
| `DEFAULT_QUALITY` | `DEFAULT_QUALITY` | `constants` |
| `DEFAULT_STROKE_WIDTH` | `DEFAULT_STROKE_WIDTH` | `constants` |
| `DEFAULT_FONT_SIZE` | `DEFAULT_FONT_SIZE` | `constants` |
| `DEFAULT_DOT_RADIUS` | `DEFAULT_DOT_RADIUS` | `constants` |
| `DEFAULT_ARROW_TIP_LENGTH` | `DEFAULT_ARROW_TIP_LENGTH` | `constants` |
| `SMALL_BUFF` | `SMALL_BUFF` | `constants` |
| `MED_SMALL_BUFF` | `MED_SMALL_BUFF` | `constants` |
| `MED_LARGE_BUFF` | `MED_LARGE_BUFF` | `constants` |
| `LARGE_BUFF` | `LARGE_BUFF` | `constants` |

### Color Constants

| Python | TypeScript | Import |
|--------|-----------|--------|
| `WHITE` | `WHITE` | `core/color` |
| `BLACK` | `BLACK` | `core/color` |
| `RED` / `RED_A` through `RED_E` | `RED` / `RED_A` through `RED_E` | `core/color` |
| `BLUE` / `BLUE_A` through `BLUE_E` | `BLUE` / `BLUE_A` through `BLUE_E` | `core/color` |
| `GREEN` / `GREEN_A` through `GREEN_E` | `GREEN` / `GREEN_A` through `GREEN_E` | `core/color` |
| `YELLOW` / `YELLOW_A` through `YELLOW_E` | `YELLOW` / `YELLOW_A` through `YELLOW_E` | `core/color` |
| `GOLD` / `GOLD_A` through `GOLD_E` | `GOLD` / `GOLD_A` through `GOLD_E` | `core/color` |
| `PURPLE` / `PURPLE_A` through `PURPLE_E` | `PURPLE` / `PURPLE_A` through `PURPLE_E` | `core/color` |
| `TEAL` / `TEAL_A` through `TEAL_E` | `TEAL` / `TEAL_A` through `TEAL_E` | `core/color` |
| `MAROON` / `MAROON_A` through `MAROON_E` | `MAROON` / `MAROON_A` through `MAROON_E` | `core/color` |
| `GRAY_A` through `GRAY_E` | `GRAY_A` through `GRAY_E` | `core/color` |
| `PINK` | `PINK` | `core/color` |
| `ORANGE` | `ORANGE` | `core/color` |
| `LIGHT_BROWN` | `LIGHT_BROWN` | `core/color` |
| `DARK_BROWN` | `DARK_BROWN` | `core/color` |

---

## Syntax Differences Quick Reference

| Pattern | Python | TypeScript |
|---------|--------|-----------|
| Constructor | `Circle(color=BLUE)` | `new Circle({ color: BLUE })` |
| Play animation | `self.play(Create(c))` | `await this.play(new Create(c))` |
| Wait | `self.wait(1)` | `await this.wait(1)` |
| Vector scaling | `LEFT * 2` | `LEFT.scale(2)` |
| Animate property | `mob.animate.shift(UP)` | `mob.animate.shift(UP)` |
| kwargs | `**kwargs` | Typed options object |
| Property decorator | `@property` | `get` / `set` accessors |
| Default mutables | `def f(lst=[])` | Create new in method body |
| Type checking imports | `if TYPE_CHECKING:` | `import type { ... }` |
| Array math | `a + b` | `a.add(b)` |
| Array scaling | `a * 3` | `a.multiply(3)` |
| numpy | `import numpy as np` | `import { np } from "core/math"` |

---

## Additive (manim-ts only — not in Python Manim)

These APIs extend manim-ts beyond the Python-mirrored core. All are opt-in; default scene behavior is unchanged.

### Scene — interactive playback options

| Symbol | TypeScript | Import |
|--------|-----------|--------|
| `SceneOptions.playback` | `new Scene({ playback: true })` | `manim-ts` |
| `SceneOptions.interactive` | `new Scene({ interactive: true, canvas })` | `manim-ts` |
| `SceneOptions.canvas` | `new Scene({ canvas: HTMLCanvasElement })` | `manim-ts` |
| `scene.playback` | Getter returning `Timeline` (throws if disabled) | `manim-ts` |
| `scene.playbackEnabled` | `boolean` | `manim-ts` |
| `scene.pointerDispatcher` | `PointerDispatcher \| null` | `manim-ts` |
| `scene.canvas` | `HTMLCanvasElement \| null` | `manim-ts` |
| `scene.attachCanvas(canvas)` | Bind canvas after construction | `manim-ts` |
| `scene.mobjectAt(x, y)` | `IMobject \| null` — hit-test at scene coords | `manim-ts` |

### Timeline API

| Symbol | TypeScript | Import |
|--------|-----------|--------|
| `Timeline` | `class Timeline` | `manim-ts` |
| `timeline.seek(t)` | Jump to time `t` | — |
| `timeline.play() / pause() / resume() / stop() / toggle()` | Playback controls | — |
| `timeline.setSpeed(x) / setLoop(b)` | Rate and loop | — |
| `timeline.on(event, listener)` | Events: `tick`, `seek`, `play`, `pause`, `resume`, `stop`, `ended`, `record` | — |
| `timeline.duration / currentTime / state / speed` | Read-only accessors | — |
| `TimelineControls` | DOM widget (play/pause/scrubber/speed) | `manim-ts` |

### Mobject — pointer events

| Symbol | TypeScript | Import |
|--------|-----------|--------|
| `mobject.on(event, listener)` | Subscribe; returns unsubscribe fn | `manim-ts` |
| `mobject.off(event, listener)` | Unsubscribe | `manim-ts` |
| `mobject.emit(event, payload)` | Synthetic dispatch | `manim-ts` |
| Events | `click`, `pointerdown`, `pointerup`, `pointermove`, `pointerenter`, `pointerleave`, `hover`, `dragstart`, `drag`, `dragend` | — |

### Interaction utilities

| Symbol | TypeScript | Import |
|--------|-----------|--------|
| `PointerDispatcher` | Canvas → scene-coord → hit-test → event dispatch | `manim-ts` |
| `EventEmitter` | Lightweight typed emitter | `manim-ts` |
| `makeInteractive(mob)` | Return/attach a mobject's `EventEmitter` | `manim-ts` |
| `hitTestBBox(mobjects, x, y, options?)` | Bounding-box hit test | `manim-ts` |
| `getBoundingBox(mob)` | Axis-aligned bbox for a mobject | `manim-ts` |

### Framework wrappers

| Symbol | TypeScript | Import |
|--------|-----------|--------|
| `<ManimScene>` (React) | Drop-in component | `manim-ts/react` |
| `<ManimScene>` (Vue 3) | Drop-in component | `manim-ts/vue` |
