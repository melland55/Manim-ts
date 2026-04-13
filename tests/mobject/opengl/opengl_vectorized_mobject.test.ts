import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np, ORIGIN, UP, RIGHT, PI, DEGREES } from "../../../src/core/math/index.js";
import { DEFAULT_STROKE_WIDTH, LineJointType } from "../../../src/constants/constants.js";
import {
  OpenGLVMobject,
  OpenGLVGroup,
  OpenGLVectorizedPoint,
  OpenGLCurvesAsSubmobjects,
  OpenGLDashedVMobject,
} from "../../../src/mobject/opengl/opengl_vectorized_mobject.js";

describe("OpenGLVMobject", () => {
  it("constructs with defaults", () => {
    const vmob = new OpenGLVMobject();
    expect(vmob.fillOpacity).toBe(0.0);
    expect(vmob.strokeOpacity).toBe(1.0);
    expect(vmob.drawStrokeBehindFill).toBe(false);
    expect(vmob.nPointsPerCurve).toBe(3);
    expect(vmob.jointType).toBe(LineJointType.AUTO);
    expect(vmob.flatStroke).toBe(true);
    expect(vmob.triangulationLocked).toBe(false);
    expect(vmob.longLines).toBe(false);
    expect(vmob.toleranceForPointEquality).toBe(1e-8);
    expect(vmob.needsNewTriangulation).toBe(true);
    expect(vmob.getNumPoints()).toBe(0);
  });

  it("constructs with custom options", () => {
    const vmob = new OpenGLVMobject({
      fillOpacity: 0.5,
      strokeOpacity: 0.7,
      strokeWidth: 2,
      nPointsPerCurve: 3,
      flatStroke: false,
      toleranceForPointEquality: 1e-6,
    });
    expect(vmob.fillOpacity).toBe(0.5);
    expect(vmob.strokeOpacity).toBe(0.7);
    expect(vmob.flatStroke).toBe(false);
    expect(vmob.toleranceForPointEquality).toBe(1e-6);
  });

  it("setPoints and getNumPoints", () => {
    const vmob = new OpenGLVMobject();
    vmob.setPoints(np.array([[0, 0, 0], [1, 1, 0], [2, 0, 0]]));
    expect(vmob.getNumPoints()).toBe(3);
  });

  it("startNewPath and addLineTo", () => {
    const vmob = new OpenGLVMobject();
    vmob.startNewPath(np.array([0, 0, 0]));
    vmob.addLineTo(np.array([1, 0, 0]));
    // After startNewPath + addLineTo with nppc=3, we should have points
    expect(vmob.getNumPoints()).toBeGreaterThan(0);
  });

  it("setPointsAsCorners creates correct bezier structure", () => {
    const vmob = new OpenGLVMobject();
    const corners = np.array([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ]);
    vmob.setPointsAsCorners(corners);
    // Should have 2 curves (corners.length - 1) * nPointsPerCurve points
    expect(vmob.getNumPoints()).toBe(2 * 3);
    expect(vmob.getNumCurves()).toBe(2);
  });

  it("getBezierTuples returns correct count", () => {
    const vmob = new OpenGLVMobject();
    vmob.setPoints(np.array([
      [0, 0, 0], [0.5, 0.5, 0], [1, 0, 0],
      [1.5, -0.5, 0], [2, 0, 0], [2, 1, 0],
    ]));
    const tuples = vmob.getBezierTuples();
    expect(tuples).toHaveLength(2);
    expect(tuples[0].shape).toEqual([3, 3]);
  });

  it("getSubpaths identifies connected paths", () => {
    const vmob = new OpenGLVMobject();
    // A single continuous path
    vmob.setPoints(np.array([
      [0, 0, 0], [0.5, 0.5, 0], [1, 0, 0],
    ]));
    const subpaths = vmob.getSubpaths();
    expect(subpaths).toHaveLength(1);
  });

  it("reverseDirection reverses points", () => {
    const vmob = new OpenGLVMobject();
    vmob.setPoints(np.array([
      [0, 0, 0], [1, 1, 0], [2, 0, 0],
    ]));
    vmob.reverseDirection();
    // First point should now be what was the last
    const pts = vmob.points;
    expect(pts.get([0, 0])).toBeCloseTo(2);
    expect(pts.get([0, 1])).toBeCloseTo(0);
  });

  it("hasFill and hasStroke", () => {
    const vmob = new OpenGLVMobject({ fillOpacity: 0.5, strokeWidth: 4 });
    expect(vmob.hasFill()).toBe(true);
    expect(vmob.hasStroke()).toBe(true);

    const vmob2 = new OpenGLVMobject({ fillOpacity: 0, strokeWidth: 0 });
    expect(vmob2.hasFill()).toBe(false);
  });

  it("getArcLength computes nonzero for a path", () => {
    const vmob = new OpenGLVMobject();
    vmob.setPointsAsCorners(np.array([
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
    ]));
    const length = vmob.getArcLength();
    expect(length).toBeGreaterThan(0);
    // Approximate total should be ~2 (1 + 1)
    expect(length).toBeCloseTo(2, 0);
  });

  it("pointFromProportion returns endpoints at 0 and 1", () => {
    const vmob = new OpenGLVMobject();
    vmob.setPointsAsCorners(np.array([
      [0, 0, 0],
      [4, 0, 0],
    ]));
    const start = vmob.pointFromProportion(0);
    const end = vmob.pointFromProportion(1);
    expect(start.get([0])).toBeCloseTo(0, 1);
    expect(end.get([0])).toBeCloseTo(4, 1);
  });
});

describe("OpenGLVGroup", () => {
  it("constructs with vmobjects", () => {
    const v1 = new OpenGLVMobject();
    const v2 = new OpenGLVMobject();
    const group = new OpenGLVGroup(v1, v2);
    expect(group.submobjects).toHaveLength(2);
  });

  it("is iterable", () => {
    const v1 = new OpenGLVMobject();
    const v2 = new OpenGLVMobject();
    const group = new OpenGLVGroup(v1, v2);
    const items = [...group];
    expect(items).toHaveLength(2);
  });
});

describe("OpenGLVectorizedPoint", () => {
  it("constructs at ORIGIN by default", () => {
    const pt = new OpenGLVectorizedPoint();
    const loc = pt.getLocation();
    expect(loc.get([0])).toBeCloseTo(0);
    expect(loc.get([1])).toBeCloseTo(0);
    expect(loc.get([2])).toBeCloseTo(0);
  });

  it("constructs at specified location", () => {
    const pt = new OpenGLVectorizedPoint(np.array([3, 4, 5]));
    const loc = pt.getLocation();
    expect(loc.get([0])).toBeCloseTo(3);
    expect(loc.get([1])).toBeCloseTo(4);
    expect(loc.get([2])).toBeCloseTo(5);
  });

  it("reports artificial width and height", () => {
    const pt = new OpenGLVectorizedPoint(ORIGIN, {
      artificialWidth: 0.05,
      artificialHeight: 0.03,
    });
    expect(pt.getWidth()).toBe(0.05);
    expect(pt.getHeight()).toBe(0.03);
  });
});

describe("OpenGLCurvesAsSubmobjects", () => {
  it("splits bezier curves into submobjects", () => {
    const vmob = new OpenGLVMobject();
    vmob.setPoints(np.array([
      [0, 0, 0], [0.5, 1, 0], [1, 0, 0],
      [1.5, -1, 0], [2, 0, 0], [2, 1, 0],
    ]));
    const curves = new OpenGLCurvesAsSubmobjects(vmob);
    expect(curves.submobjects).toHaveLength(2);
  });
});

describe("Edge cases", () => {
  it("empty vmobject returns empty subpaths", () => {
    const vmob = new OpenGLVMobject();
    expect(vmob.getSubpaths()).toHaveLength(0);
    expect(vmob.getBezierTuples()).toHaveLength(0);
    expect(vmob.getNumCurves()).toBe(0);
  });

  it("getAreaVector for empty vmobject is zero", () => {
    const vmob = new OpenGLVMobject();
    const area = vmob.getAreaVector();
    expect(area.get([0])).toBe(0);
    expect(area.get([1])).toBe(0);
    expect(area.get([2])).toBe(0);
  });

  it("getTriangulation returns empty for empty vmobject", () => {
    const vmob = new OpenGLVMobject();
    const tri = vmob.getTriangulation();
    expect(tri).toHaveLength(0);
  });

  it("refreshTriangulation marks family as needing retriangulation", () => {
    const parent = new OpenGLVMobject();
    parent.needsNewTriangulation = false;
    parent.refreshTriangulation();
    expect(parent.needsNewTriangulation).toBe(true);
  });
});
