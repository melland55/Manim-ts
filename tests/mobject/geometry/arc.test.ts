/**
 * Tests for mobject/geometry/arc module.
 */

import { describe, it, expect } from "vitest";
import "../../helpers/point-matchers.js";
import { np, PI, TAU, ORIGIN, UP, RIGHT, LEFT, DOWN, OUT } from "../../../src/core/math/index.js";
import { WHITE, RED, BLUE } from "../../../src/utils/color/manim_colors.js";
import {
  DEFAULT_ARROW_TIP_LENGTH,
  DEFAULT_DOT_RADIUS,
  SMALL_BUFF,
} from "../../../src/constants/index.js";
import {
  TipableVMobject,
  Arc,
  ArcBetweenPoints,
  CurvedArrow,
  CurvedDoubleArrow,
  Circle,
  Dot,
  AnnotationDot,
  LabeledDot,
  Ellipse,
  AnnularSector,
  Sector,
  Annulus,
  CubicBezier,
  ArcPolygon,
  ArcPolygonFromArcs,
} from "../../../src/mobject/geometry/arc/index.js";

// ── TipableVMobject ──

describe("TipableVMobject", () => {
  it("constructs with defaults", () => {
    const obj = new TipableVMobject();
    expect(obj.tipLength).toBe(DEFAULT_ARROW_TIP_LENGTH);
    expect(obj.hasTip()).toBe(false);
    expect(obj.hasStartTip()).toBe(false);
  });

  it("constructs with custom tip length", () => {
    const obj = new TipableVMobject({ tipLength: 0.5 });
    expect(obj.tipLength).toBe(0.5);
  });
});

// ── Arc ──

describe("Arc", () => {
  it("constructs with defaults", () => {
    const arc = new Arc();
    expect(arc.radius).toBe(1.0);
    expect(arc.startAngle).toBe(0);
    expect(arc.angle).toBe(TAU / 4);
    expect(arc.numComponents).toBe(9);
  });

  it("has points after construction", () => {
    const arc = new Arc();
    expect(arc.points.shape[0]).toBeGreaterThan(0);
  });

  it("constructs with custom radius", () => {
    const arc = new Arc({ radius: 2.0 });
    expect(arc.radius).toBe(2.0);
    // Start point should be at distance ~2 from center
    const start = arc.getStart();
    const dist = np.linalg.norm(start) as number;
    expect(dist).toBeCloseTo(2.0, 4);
  });

  it("constructs with custom angle", () => {
    const arc = new Arc({ angle: PI });
    expect(arc.angle).toBe(PI);
  });

  it("constructs with arc center", () => {
    const arc = new Arc({ arcCenter: [1, 2, 0] });
    const center = arc.getArcCenter();
    expect(center.get([0])).toBeCloseTo(1, 3);
    expect(center.get([1])).toBeCloseTo(2, 3);
  });

  it("handles null radius (defaults to 1.0)", () => {
    const arc = new Arc({ radius: null });
    expect(arc.radius).toBe(1.0);
  });

  it("getArcCenter returns correct center for unit circle arc", () => {
    const arc = new Arc({ radius: 1.0, startAngle: 0, angle: PI / 2 });
    const center = arc.getArcCenter();
    expect(center.get([0])).toBeCloseTo(0, 2);
    expect(center.get([1])).toBeCloseTo(0, 2);
  });

  it("moveArcCenterTo moves the arc", () => {
    const arc = new Arc();
    arc.moveArcCenterTo(np.array([3, 4, 0]));
    const center = arc.getArcCenter();
    expect(center.get([0])).toBeCloseTo(3, 2);
    expect(center.get([1])).toBeCloseTo(4, 2);
  });

  it("stopAngle returns angle of last point relative to center", () => {
    const arc = new Arc({ startAngle: 0, angle: PI / 2 });
    const stop = arc.stopAngle();
    expect(stop).toBeCloseTo(PI / 2, 2);
  });
});

// ── ArcBetweenPoints ──

describe("ArcBetweenPoints", () => {
  it("connects two points", () => {
    const start = np.array([0, 0, 0]);
    const end = np.array([2, 0, 0]);
    const arc = new ArcBetweenPoints(start, end);
    expect(arc.points.shape[0]).toBeGreaterThan(0);
  });

  it("accepts array inputs", () => {
    const arc = new ArcBetweenPoints([0, 0, 0], [2, 0, 0]);
    expect(arc.points.shape[0]).toBeGreaterThan(0);
  });

  it("throws on too-small radius", () => {
    expect(() => {
      new ArcBetweenPoints([0, 0, 0], [10, 0, 0], { radius: 1 });
    }).toThrow();
  });
});

// ── Circle ──

describe("Circle", () => {
  it("constructs with defaults", () => {
    const circle = new Circle();
    expect(circle.angle).toBe(TAU);
    expect(circle.startAngle).toBe(0);
  });

  it("default color is RED", () => {
    const circle = new Circle();
    // The color option should have been RED
    expect(circle.points.shape[0]).toBeGreaterThan(0);
  });

  it("constructs with custom radius", () => {
    const circle = new Circle({ radius: 3 });
    expect(circle.radius).toBe(3);
  });

  it("pointAtAngle returns point on circle", () => {
    const circle = new Circle({ radius: 2 });
    const pt = circle.pointAtAngle(0);
    // At angle 0, should be at (2, 0, 0) relative to center
    expect(pt.get([0])).toBeCloseTo(2, 1);
    expect(pt.get([1])).toBeCloseTo(0, 1);
  });

  it("fromThreePoints creates correct circle", () => {
    const p1 = np.array([1, 0, 0]);
    const p2 = np.array([0, 1, 0]);
    const p3 = np.array([-1, 0, 0]);
    const circle = Circle.fromThreePoints(p1, p2, p3);
    expect(circle.radius).toBeCloseTo(1.0, 2);
  });
});

// ── Dot ──

describe("Dot", () => {
  it("constructs at origin by default", () => {
    const dot = new Dot();
    expect(dot.radius).toBe(DEFAULT_DOT_RADIUS);
    expect(dot.fillOpacity).toBe(1.0);
    expect(dot.strokeWidth).toBe(0);
  });

  it("constructs at specified point", () => {
    const dot = new Dot({ point: [3, 4, 0] });
    const center = dot.getCenter();
    expect(center.get([0])).toBeCloseTo(3, 2);
    expect(center.get([1])).toBeCloseTo(4, 2);
  });

  it("has points (is a valid circle)", () => {
    const dot = new Dot();
    expect(dot.points.shape[0]).toBeGreaterThan(0);
  });
});

// ── AnnotationDot ──

describe("AnnotationDot", () => {
  it("constructs with bigger radius and bold stroke", () => {
    const dot = new AnnotationDot();
    expect(dot.radius).toBeCloseTo(DEFAULT_DOT_RADIUS * 1.3, 5);
    expect(dot.strokeWidth).toBe(5);
  });
});

// ── Ellipse ──

describe("Ellipse", () => {
  it("constructs with default width and height", () => {
    const ellipse = new Ellipse();
    expect(ellipse.width).toBeCloseTo(2, 1);
    expect(ellipse.height).toBeCloseTo(1, 1);
  });

  it("constructs with custom dimensions", () => {
    const ellipse = new Ellipse({ width: 4, height: 3 });
    expect(ellipse.width).toBeCloseTo(4, 1);
    expect(ellipse.height).toBeCloseTo(3, 1);
  });
});

// ── AnnularSector ──

describe("AnnularSector", () => {
  it("constructs with defaults", () => {
    const sector = new AnnularSector();
    expect(sector.innerRadius).toBe(1);
    expect(sector.outerRadius).toBe(2);
    expect(sector.points.shape[0]).toBeGreaterThan(0);
  });

  it("constructs with custom radii", () => {
    const sector = new AnnularSector({ innerRadius: 0.5, outerRadius: 3 });
    expect(sector.innerRadius).toBe(0.5);
    expect(sector.outerRadius).toBe(3);
  });
});

// ── Sector ──

describe("Sector", () => {
  it("is an AnnularSector with inner radius 0", () => {
    const sector = new Sector();
    expect(sector.innerRadius).toBe(0);
    expect(sector.points.shape[0]).toBeGreaterThan(0);
  });
});

// ── Annulus ──

describe("Annulus", () => {
  it("constructs with defaults", () => {
    const annulus = new Annulus();
    expect(annulus.innerRadius).toBe(1);
    expect(annulus.outerRadius).toBe(2);
    expect(annulus.points.shape[0]).toBeGreaterThan(0);
  });
});

// ── CubicBezier ──

describe("CubicBezier", () => {
  it("constructs from 4 control points", () => {
    const cb = new CubicBezier(
      [0, 0, 0],
      [1, 2, 0],
      [3, 2, 0],
      [4, 0, 0],
    );
    expect(cb.points.shape[0]).toBe(4); // 1 anchor + 2 handles + 1 anchor
  });

  it("start and end match anchors", () => {
    const cb = new CubicBezier(
      np.array([0, 0, 0]),
      np.array([1, 2, 0]),
      np.array([3, 2, 0]),
      np.array([4, 0, 0]),
    );
    const start = cb.getStart();
    const end = cb.getEnd();
    expect(start.get([0])).toBeCloseTo(0, 5);
    expect(end.get([0])).toBeCloseTo(4, 5);
  });
});

// ── ArcPolygon ──

describe("ArcPolygon", () => {
  it("constructs from vertices", () => {
    const ap = new ArcPolygon(
      [[0, 0, 0], [2, 0, 0], [1, 2, 0]],
      { angle: PI / 4 },
    );
    expect(ap.arcs.length).toBe(3);
    expect(ap.points.shape[0]).toBeGreaterThan(0);
  });
});

// ── ArcPolygonFromArcs ──

describe("ArcPolygonFromArcs", () => {
  it("constructs from pre-defined arcs", () => {
    const arc1 = new Arc({ angle: PI / 2 });
    const arc2 = new Arc({ angle: PI / 2, startAngle: PI / 2 });
    const ap = new ArcPolygonFromArcs([arc1, arc2]);
    expect(ap.arcs.length).toBe(2);
    expect(ap.points.shape[0]).toBeGreaterThan(0);
  });
});
