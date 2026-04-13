import { describe, it, expect } from "vitest";
import "./helpers/point-matchers.js";
import { np } from "../src/core/math/index.js";
import {
  // Messages
  SCENE_NOT_FOUND_MESSAGE,
  INVALID_NUMBER_MESSAGE,
  NO_SCENE_MESSAGE,
  // Font style
  NORMAL, ITALIC, OBLIQUE, BOLD, THIN, ULTRABOLD, HEAVY,
  // Resampling
  RESAMPLING_ALGORITHMS,
  // Directions
  ORIGIN, UP, DOWN, LEFT, RIGHT, IN, OUT,
  X_AXIS, Y_AXIS, Z_AXIS,
  UL, UR, DL, DR,
  // Math constants
  PI, TAU, DEGREES,
  // Geometry numerics
  DEFAULT_DOT_RADIUS, DEFAULT_STROKE_WIDTH, DEFAULT_FONT_SIZE,
  SMALL_BUFF, MED_SMALL_BUFF, MED_LARGE_BUFF, LARGE_BUFF,
  DEFAULT_MOBJECT_TO_EDGE_BUFFER, DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,
  DEFAULT_WAIT_TIME, DEFAULT_POINTWISE_FUNCTION_RUN_TIME,
  DEFAULT_POINT_DENSITY_2D, DEFAULT_POINT_DENSITY_1D,
  SCALE_FACTOR_PER_FONT_POINT, START_X, START_Y,
  // Video quality
  QUALITIES, DEFAULT_QUALITY,
  // CLI
  EPILOG, SHIFT_VALUE, CTRL_VALUE,
  // Enums
  RendererType, LineJointType, CapStyleType,
} from "../src/constants/index.js";

describe("Message constants", () => {
  it("exports string message constants", () => {
    expect(typeof SCENE_NOT_FOUND_MESSAGE).toBe("string");
    expect(typeof INVALID_NUMBER_MESSAGE).toBe("string");
    expect(typeof NO_SCENE_MESSAGE).toBe("string");
    expect(INVALID_NUMBER_MESSAGE).toBe(
      "Invalid scene numbers have been specified. Aborting."
    );
  });
});

describe("Font style constants", () => {
  it("exports all pango style strings", () => {
    expect(NORMAL).toBe("NORMAL");
    expect(ITALIC).toBe("ITALIC");
    expect(OBLIQUE).toBe("OBLIQUE");
    expect(BOLD).toBe("BOLD");
    expect(THIN).toBe("THIN");
    expect(ULTRABOLD).toBe("ULTRABOLD");
    expect(HEAVY).toBe("HEAVY");
  });
});

describe("RESAMPLING_ALGORITHMS", () => {
  it("maps aliases to canonical names", () => {
    expect(RESAMPLING_ALGORITHMS["nearest"]).toBe("nearest");
    expect(RESAMPLING_ALGORITHMS["none"]).toBe("nearest");
    expect(RESAMPLING_ALGORITHMS["bilinear"]).toBe("bilinear");
    expect(RESAMPLING_ALGORITHMS["linear"]).toBe("bilinear");
    expect(RESAMPLING_ALGORITHMS["bicubic"]).toBe("bicubic");
    expect(RESAMPLING_ALGORITHMS["cubic"]).toBe("bicubic");
  });
});

describe("Direction vector constants", () => {
  it("ORIGIN is [0, 0, 0]", () => {
    expect(ORIGIN).toBeCloseToPoint(np.array([0, 0, 0]));
  });

  it("UP is [0, 1, 0]", () => {
    expect(UP).toBeCloseToPoint(np.array([0, 1, 0]));
  });

  it("DOWN is [0, -1, 0]", () => {
    expect(DOWN).toBeCloseToPoint(np.array([0, -1, 0]));
  });

  it("LEFT is [-1, 0, 0]", () => {
    expect(LEFT).toBeCloseToPoint(np.array([-1, 0, 0]));
  });

  it("RIGHT is [1, 0, 0]", () => {
    expect(RIGHT).toBeCloseToPoint(np.array([1, 0, 0]));
  });

  it("IN is [0, 0, -1]", () => {
    expect(IN).toBeCloseToPoint(np.array([0, 0, -1]));
  });

  it("OUT is [0, 0, 1]", () => {
    expect(OUT).toBeCloseToPoint(np.array([0, 0, 1]));
  });

  it("axis constants match cardinal directions", () => {
    expect(X_AXIS).toBeCloseToPoint(np.array([1, 0, 0]));
    expect(Y_AXIS).toBeCloseToPoint(np.array([0, 1, 0]));
    expect(Z_AXIS).toBeCloseToPoint(np.array([0, 0, 1]));
  });

  it("diagonal constants are correct", () => {
    expect(UL).toBeCloseToPoint(np.array([-1, 1, 0]));
    expect(UR).toBeCloseToPoint(np.array([1, 1, 0]));
    expect(DL).toBeCloseToPoint(np.array([-1, -1, 0]));
    expect(DR).toBeCloseToPoint(np.array([1, -1, 0]));
  });
});

describe("Math constants", () => {
  it("PI matches Math.PI", () => {
    expect(PI).toBeCloseTo(Math.PI);
  });

  it("TAU is 2 * PI", () => {
    expect(TAU).toBeCloseTo(2 * Math.PI);
  });

  it("DEGREES converts correctly (1 degree in radians)", () => {
    expect(DEGREES * 360).toBeCloseTo(TAU);
    expect(DEGREES).toBeCloseTo(Math.PI / 180);
  });
});

describe("Default numeric constants", () => {
  it("buffer constants have correct ordering", () => {
    expect(SMALL_BUFF).toBeLessThan(MED_SMALL_BUFF);
    expect(MED_SMALL_BUFF).toBeLessThan(MED_LARGE_BUFF);
    expect(MED_LARGE_BUFF).toBeLessThan(LARGE_BUFF);
  });

  it("buffer aliases", () => {
    expect(DEFAULT_MOBJECT_TO_EDGE_BUFFER).toBe(MED_LARGE_BUFF);
    expect(DEFAULT_MOBJECT_TO_MOBJECT_BUFFER).toBe(MED_SMALL_BUFF);
  });

  it("geometry values are positive", () => {
    expect(DEFAULT_DOT_RADIUS).toBeGreaterThan(0);
    expect(DEFAULT_STROKE_WIDTH).toBeGreaterThan(0);
    expect(DEFAULT_FONT_SIZE).toBeGreaterThan(0);
    expect(START_X).toBeGreaterThan(0);
    expect(START_Y).toBeGreaterThan(0);
  });

  it("density and time constants are positive", () => {
    expect(DEFAULT_POINT_DENSITY_2D).toBeGreaterThan(0);
    expect(DEFAULT_POINT_DENSITY_1D).toBeGreaterThan(0);
    expect(DEFAULT_WAIT_TIME).toBeGreaterThan(0);
    expect(DEFAULT_POINTWISE_FUNCTION_RUN_TIME).toBeGreaterThan(0);
  });

  it("SCALE_FACTOR_PER_FONT_POINT equals 1/960", () => {
    expect(SCALE_FACTOR_PER_FONT_POINT).toBeCloseTo(1 / 960);
  });
});

describe("QUALITIES", () => {
  it("contains all required quality levels", () => {
    const expected = [
      "fourk_quality",
      "production_quality",
      "high_quality",
      "medium_quality",
      "low_quality",
      "example_quality",
    ];
    for (const key of expected) {
      expect(QUALITIES).toHaveProperty(key);
    }
  });

  it("each quality has required fields", () => {
    for (const [, q] of Object.entries(QUALITIES)) {
      expect(typeof q.pixelHeight).toBe("number");
      expect(typeof q.pixelWidth).toBe("number");
      expect(typeof q.frameRate).toBe("number");
      // flag is string | null
      expect(q.flag === null || typeof q.flag === "string").toBe(true);
    }
  });

  it("DEFAULT_QUALITY is high_quality", () => {
    expect(DEFAULT_QUALITY).toBe("high_quality");
    expect(QUALITIES[DEFAULT_QUALITY]).toBeDefined();
    expect(QUALITIES[DEFAULT_QUALITY].pixelHeight).toBe(1080);
    expect(QUALITIES[DEFAULT_QUALITY].pixelWidth).toBe(1920);
  });

  it("example_quality has null flag", () => {
    expect(QUALITIES["example_quality"].flag).toBeNull();
  });
});

describe("CLI constants", () => {
  it("EPILOG is the correct string", () => {
    expect(EPILOG).toBe("Made with <3 by Manim Community developers.");
  });

  it("key code constants are numbers", () => {
    expect(SHIFT_VALUE).toBe(65505);
    expect(CTRL_VALUE).toBe(65507);
  });
});

describe("RendererType enum", () => {
  it("has CAIRO and OPENGL values", () => {
    expect(RendererType.CAIRO).toBe("cairo");
    expect(RendererType.OPENGL).toBe("opengl");
  });
});

describe("LineJointType enum", () => {
  it("has all four joint types with correct numeric values", () => {
    expect(LineJointType.AUTO).toBe(0);
    expect(LineJointType.ROUND).toBe(1);
    expect(LineJointType.BEVEL).toBe(2);
    expect(LineJointType.MITER).toBe(3);
  });
});

describe("CapStyleType enum", () => {
  it("has all four cap style types with correct numeric values", () => {
    expect(CapStyleType.AUTO).toBe(0);
    expect(CapStyleType.ROUND).toBe(1);
    expect(CapStyleType.BUTT).toBe(2);
    expect(CapStyleType.SQUARE).toBe(3);
  });
});
