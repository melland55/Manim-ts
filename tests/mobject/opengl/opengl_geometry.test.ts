import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import {
  np,
  ORIGIN,
  UP,
  DOWN,
  LEFT,
  RIGHT,
  PI,
  TAU,
  DEGREES,
} from "../../../src/core/math/index.js";
import {
  OpenGLArc,
  OpenGLCircle,
  OpenGLDot,
  OpenGLEllipse,
  OpenGLLine,
  OpenGLPolygon,
  OpenGLRegularPolygon,
  OpenGLTriangle,
  OpenGLArrowTip,
  OpenGLRectangle,
  OpenGLSquare,
  OpenGLElbow,
  OpenGLCubicBezier,
  OpenGLSector,
  OpenGLAnnulus,
} from "../../../src/mobject/opengl/opengl_geometry/index.js";

describe("OpenGLArc", () => {
  it("constructs with default quarter circle", () => {
    const arc = new OpenGLArc();
    expect(arc.startAngle).toBe(0);
    expect(arc.arcAngle).toBe(TAU / 4);
    expect(arc.radius).toBe(1.0);
    expect(arc.nComponents).toBe(8);
    // Should have 3 * nComponents = 24 points
    expect(arc.points.shape[0]).toBe(24);
    expect(arc.points.shape[1]).toBe(3);
  });

  it("creates quadratic bezier points with correct count", () => {
    const pts = OpenGLArc.createQuadraticBezierPoints(PI, 0, 4);
    // 3 * nComponents = 12 points
    expect(pts.shape[0]).toBe(12);
    expect(pts.shape[1]).toBe(3);
  });

  it("get start and stop angles", () => {
    const arc = new OpenGLArc({ startAngle: 0, angle: PI / 2 });
    const startAngle = arc.getStartAngle();
    const stopAngle = arc.getStopAngle();
    expect(startAngle).toBeCloseTo(0, 2);
    expect(stopAngle).toBeCloseTo(PI / 2, 2);
  });
});

describe("OpenGLCircle", () => {
  it("constructs as full arc (TAU)", () => {
    const circle = new OpenGLCircle();
    // Full circle: 24 points (8 components * 3)
    expect(circle.points.shape[0]).toBe(24);
  });

  it("has correct radius", () => {
    const circle = new OpenGLCircle({ radius: 2 });
    // The start point should be at distance 2 from center
    const start = circle.getStart();
    const center = circle.getArcCenter();
    const dist = np.linalg.norm(start.subtract(center)) as number;
    expect(dist).toBeCloseTo(2, 1);
  });
});

describe("OpenGLDot", () => {
  it("constructs at origin by default", () => {
    const dot = new OpenGLDot();
    const center = dot.getCenter();
    expect(center.get([0])).toBeCloseTo(0, 3);
    expect(center.get([1])).toBeCloseTo(0, 3);
    expect(center.get([2])).toBeCloseTo(0, 3);
  });

  it("constructs at specified point", () => {
    const pt = np.array([1, 2, 0]);
    const dot = new OpenGLDot({ point: pt });
    const center = dot.getCenter();
    expect(center.get([0]) as number).toBeCloseTo(1, 1);
    expect(center.get([1]) as number).toBeCloseTo(2, 1);
  });
});

describe("OpenGLLine", () => {
  it("constructs from LEFT to RIGHT by default", () => {
    const line = new OpenGLLine();
    expect(line.points.shape[0]).toBeGreaterThan(0);
  });

  it("getVector returns end - start", () => {
    const start = np.array([0, 0, 0]);
    const end = np.array([3, 4, 0]);
    const line = new OpenGLLine(start, end);
    const vec = line.getVector();
    expect(vec.get([0]) as number).toBeCloseTo(3, 1);
    expect(vec.get([1]) as number).toBeCloseTo(4, 1);
  });

  it("getAngle returns correct angle", () => {
    const line = new OpenGLLine(ORIGIN, UP);
    const angle = line.getAngle();
    expect(angle).toBeCloseTo(PI / 2, 2);
  });

  it("getSlope returns tan(angle)", () => {
    const line = new OpenGLLine(
      np.array([0, 0, 0]),
      np.array([1, 1, 0]),
    );
    const slope = line.getSlope();
    expect(slope).toBeCloseTo(1, 2);
  });
});

describe("OpenGLPolygon", () => {
  it("creates triangle from 3 vertices", () => {
    const poly = new OpenGLPolygon([
      np.array([0, 0, 0]),
      np.array([1, 0, 0]),
      np.array([0.5, 1, 0]),
    ]);
    expect(poly.points.shape[0]).toBeGreaterThan(0);
  });

  it("getVertices returns start anchors", () => {
    const v1 = np.array([0, 0, 0]);
    const v2 = np.array([1, 0, 0]);
    const v3 = np.array([0, 1, 0]);
    const poly = new OpenGLPolygon([v1, v2, v3]);
    const verts = poly.getVertices();
    expect(verts.shape[0]).toBeGreaterThanOrEqual(3);
  });
});

describe("OpenGLRegularPolygon", () => {
  it("hexagon has 6 sides by default", () => {
    const hex = new OpenGLRegularPolygon();
    const verts = hex.getVertices();
    expect(verts.shape[0]).toBe(6);
  });

  it("triangle has 3 sides", () => {
    const tri = new OpenGLTriangle();
    const verts = tri.getVertices();
    expect(verts.shape[0]).toBe(3);
  });
});

describe("OpenGLRectangle", () => {
  it("constructs with default dimensions", () => {
    const rect = new OpenGLRectangle();
    const w = rect.getWidth();
    const h = rect.getHeight();
    expect(w).toBeCloseTo(4, 1);
    expect(h).toBeCloseTo(2, 1);
  });
});

describe("OpenGLSquare", () => {
  it("constructs with equal width and height", () => {
    const sq = new OpenGLSquare();
    const w = sq.getWidth();
    const h = sq.getHeight();
    expect(w).toBeCloseTo(h, 2);
    expect(w).toBeCloseTo(2, 1);
  });

  it("constructs with custom side length", () => {
    const sq = new OpenGLSquare({ sideLength: 3 });
    expect(sq.sideLength).toBe(3);
    expect(sq.getWidth()).toBeCloseTo(3, 1);
  });
});

describe("OpenGLArrowTip", () => {
  it("has tip point and base", () => {
    const tip = new OpenGLArrowTip();
    const tipPt = tip.getTipPoint();
    const base = tip.getBase();
    expect(tipPt.shape[0]).toBe(3);
    expect(base.shape[0]).toBe(3);
    // Tip and base should be different points
    const dist = np.linalg.norm(tipPt.subtract(base)) as number;
    expect(dist).toBeGreaterThan(0);
  });

  it("getAngle returns a finite number", () => {
    const tip = new OpenGLArrowTip();
    const angle = tip.getAngle();
    expect(isFinite(angle)).toBe(true);
  });
});

describe("OpenGLElbow", () => {
  it("constructs with default width", () => {
    const elbow = new OpenGLElbow();
    expect(elbow.points.shape[0]).toBeGreaterThan(0);
  });
});

describe("OpenGLCubicBezier", () => {
  it("creates a cubic bezier curve from 4 control points", () => {
    const cb = new OpenGLCubicBezier(
      np.array([0, 0, 0]),
      np.array([1, 1, 0]),
      np.array([2, 1, 0]),
      np.array([3, 0, 0]),
    );
    expect(cb.points.shape[0]).toBeGreaterThan(0);
  });
});
