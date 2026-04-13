import { describe, it, expect } from "vitest";
import {
  ManimColor,
  HSV,
  RGBA,
  colorToRgb,
  colorToRgba,
  colorToIntRgb,
  colorToIntRgba,
  rgbToColor,
  rgbaToColor,
  rgbToHex,
  hexToRgb,
  invertColor,
  colorGradient,
  interpolateColor,
  averageColor,
  randomColor,
  randomBrightColor,
  RandomColorGenerator,
  WHITE,
  BLACK,
  RED,
  BLUE,
  GREEN,
  YELLOW,
  PURE_RED,
  PURE_GREEN,
  PURE_BLUE,
  _allColorDict,
  AS2700,
  BS381,
  DVIPSNAMES,
  SVGNAMES,
  X11,
  XKCD,
} from "../../src/utils/color/index.js";

describe("ManimColor", () => {
  describe("constructor", () => {
    it("creates black when given null", () => {
      const c = new ManimColor(null);
      expect(c.r).toBe(0);
      expect(c.g).toBe(0);
      expect(c.b).toBe(0);
      expect(c.a).toBe(1);
    });

    it("creates black when given no arguments", () => {
      const c = new ManimColor();
      expect(c.toHex()).toBe("#000000");
    });

    it("parses hex string with #", () => {
      const c = new ManimColor("#FF0000");
      expect(c.r).toBeCloseTo(1.0, 2);
      expect(c.g).toBeCloseTo(0.0, 2);
      expect(c.b).toBeCloseTo(0.0, 2);
    });

    it("parses hex string with 0x prefix", () => {
      const c = new ManimColor("0x00FF00");
      expect(c.g).toBeCloseTo(1.0, 2);
    });

    it("parses short hex (#RGB)", () => {
      const c = new ManimColor("#F00");
      expect(c.r).toBeCloseTo(1.0, 2);
      expect(c.g).toBeCloseTo(0.0, 2);
      expect(c.b).toBeCloseTo(0.0, 2);
    });

    it("parses integer color", () => {
      const c = new ManimColor(0xff0000);
      expect(c.r).toBeCloseTo(1.0, 2);
      expect(c.g).toBeCloseTo(0.0, 2);
      expect(c.b).toBeCloseTo(0.0, 2);
    });

    it("copies another ManimColor", () => {
      const original = new ManimColor("#FF8000");
      const copy = new ManimColor(original);
      expect(copy.toHex()).toBe(original.toHex());
    });

    it("accepts float RGB tuple", () => {
      const c = new ManimColor([0.5, 0.25, 0.75] as const);
      expect(c.r).toBeCloseTo(0.5, 5);
      expect(c.g).toBeCloseTo(0.25, 5);
      expect(c.b).toBeCloseTo(0.75, 5);
    });

    it("accepts float RGBA tuple", () => {
      const c = new ManimColor([0.5, 0.25, 0.75, 0.5] as const);
      expect(c.a).toBeCloseTo(0.5, 5);
    });

    it("accepts int RGB tuple (values > 1)", () => {
      const c = new ManimColor([255, 128, 0] as const);
      expect(c.r).toBeCloseTo(1.0, 2);
      expect(c.g).toBeCloseTo(128 / 255, 2);
      expect(c.b).toBeCloseTo(0.0, 2);
    });

    it("respects alpha parameter", () => {
      const c = new ManimColor("#FF0000", 0.5);
      expect(c.a).toBeCloseTo(0.5, 5);
    });

    it("throws on invalid type", () => {
      expect(() => new ManimColor(true as unknown as string)).toThrow(TypeError);
    });
  });

  describe("conversion methods", () => {
    const red = new ManimColor("#FF0000");

    it("toRgb returns float array", () => {
      const rgb = red.toRgb();
      expect(rgb).toHaveLength(3);
      expect(rgb[0]).toBeCloseTo(1.0, 2);
    });

    it("toIntRgb returns int array", () => {
      const rgb = red.toIntRgb();
      expect(rgb[0]).toBe(255);
      expect(rgb[1]).toBe(0);
      expect(rgb[2]).toBe(0);
    });

    it("toRgba returns float array with alpha", () => {
      const rgba = red.toRgba();
      expect(rgba).toHaveLength(4);
      expect(rgba[3]).toBeCloseTo(1.0, 2);
    });

    it("toIntRgba returns int array", () => {
      const rgba = red.toIntRgba();
      expect(rgba[0]).toBe(255);
      expect(rgba[3]).toBe(255);
    });

    it("toHex returns uppercase hex", () => {
      expect(red.toHex()).toBe("#FF0000");
    });

    it("toHex with alpha includes alpha byte", () => {
      const hex = red.toHex(true);
      expect(hex).toBe("#FF0000FF");
    });

    it("toInteger returns packed int", () => {
      expect(red.toInteger()).toBe(0xff0000);
    });

    it("toRgbaWithAlpha overrides alpha", () => {
      const rgba = red.toRgbaWithAlpha(0.3);
      expect(rgba[3]).toBeCloseTo(0.3, 5);
    });

    it("toHsv converts correctly", () => {
      const hsv = red.toHsv();
      expect(hsv[0]).toBeCloseTo(0, 5); // hue = 0 for red
      expect(hsv[1]).toBeCloseTo(1.0, 5); // full saturation
      expect(hsv[2]).toBeCloseTo(1.0, 5); // full value
    });

    it("toHsl converts correctly", () => {
      const hsl = red.toHsl();
      expect(hsl[0]).toBeCloseTo(0, 5); // hue
      expect(hsl[1]).toBeCloseTo(1.0, 5); // saturation
      expect(hsl[2]).toBeCloseTo(0.5, 5); // lightness
    });

    it("toArray returns ColorArray", () => {
      const arr = red.toArray();
      expect(arr).toHaveLength(4);
      expect(arr[0]).toBeCloseTo(1.0, 2);
    });

    it("toString returns hex", () => {
      expect(red.toString()).toBe("#FF0000");
    });
  });

  describe("manipulation methods", () => {
    it("interpolate blends colors", () => {
      const result = BLACK.interpolate(WHITE, 0.5);
      expect(result.r).toBeCloseTo(0.5, 2);
      expect(result.g).toBeCloseTo(0.5, 2);
      expect(result.b).toBeCloseTo(0.5, 2);
    });

    it("interpolate at 0 returns self", () => {
      const result = RED.interpolate(BLUE, 0);
      expect(result.r).toBeCloseTo(RED.r, 2);
      expect(result.g).toBeCloseTo(RED.g, 2);
      expect(result.b).toBeCloseTo(RED.b, 2);
    });

    it("interpolate at 1 returns other", () => {
      const result = RED.interpolate(BLUE, 1);
      expect(result.r).toBeCloseTo(BLUE.r, 2);
      expect(result.g).toBeCloseTo(BLUE.g, 2);
      expect(result.b).toBeCloseTo(BLUE.b, 2);
    });

    it("darker returns darker color", () => {
      const dark = WHITE.darker(0.5);
      expect(dark.r).toBeLessThan(1.0);
      expect(dark.g).toBeLessThan(1.0);
      expect(dark.b).toBeLessThan(1.0);
    });

    it("lighter returns lighter color", () => {
      const light = BLACK.lighter(0.5);
      expect(light.r).toBeGreaterThan(0.0);
    });

    it("invert inverts RGB", () => {
      const inv = new ManimColor("#FF0000").invert();
      expect(inv.r).toBeCloseTo(0.0, 2);
      expect(inv.g).toBeCloseTo(1.0, 2);
      expect(inv.b).toBeCloseTo(1.0, 2);
    });

    it("invert preserves alpha by default", () => {
      const c = new ManimColor("#FF0000", 0.5);
      const inv = c.invert();
      expect(inv.a).toBeCloseTo(0.5, 5);
    });

    it("invert with alpha inverts alpha too", () => {
      const c = new ManimColor("#FF0000", 0.8);
      const inv = c.invert(true);
      expect(inv.a).toBeCloseTo(0.2, 2);
    });

    it("opacity creates new color with given alpha", () => {
      const c = new ManimColor("#FF0000").opacity(0.3);
      expect(c.a).toBeCloseTo(0.3, 5);
      expect(c.r).toBeCloseTo(1.0, 2);
    });

    it("contrasting returns white for dark colors", () => {
      const result = BLACK.contrasting();
      expect(result.toHex()).toBe("#FFFFFF");
    });

    it("contrasting returns black for light colors", () => {
      const result = WHITE.contrasting();
      expect(result.toHex()).toBe("#000000");
    });
  });

  describe("equality", () => {
    it("equals returns true for same color", () => {
      expect(new ManimColor("#FF0000").equals(new ManimColor("#FF0000"))).toBe(true);
    });

    it("equals returns false for different colors", () => {
      expect(new ManimColor("#FF0000").equals(new ManimColor("#00FF00"))).toBe(false);
    });
  });

  describe("factory methods", () => {
    it("fromRgb with floats", () => {
      const c = ManimColor.fromRgb([1, 0, 0]);
      expect(c.toHex()).toBe("#FF0000");
    });

    it("fromRgba", () => {
      const c = ManimColor.fromRgba([1, 0, 0, 0.5]);
      expect(c.r).toBeCloseTo(1.0, 2);
      expect(c.a).toBeCloseTo(0.5, 5);
    });

    it("fromHex", () => {
      const c = ManimColor.fromHex("#00FF00");
      expect(c.g).toBeCloseTo(1.0, 2);
    });

    it("fromHsv", () => {
      const c = ManimColor.fromHsv([0, 1, 1]); // red
      expect(c.r).toBeCloseTo(1.0, 2);
      expect(c.g).toBeCloseTo(0.0, 2);
    });

    it("fromHsl", () => {
      const c = ManimColor.fromHsl([0.333, 1, 0.5]); // green-ish
      expect(c.g).toBeGreaterThan(0.5);
    });

    it("parse single color", () => {
      const c = ManimColor.parse("#FF0000");
      expect(c).toBeInstanceOf(ManimColor);
    });

    it("parse array of colors", () => {
      const colors = ManimColor.parse(["#FF0000", "#00FF00"]);
      expect(Array.isArray(colors)).toBe(true);
      expect((colors as ManimColor[]).length).toBe(2);
    });
  });
});

describe("HSV", () => {
  it("constructs from HSV values", () => {
    const c = new HSV([0, 1, 1]); // red
    expect(c.r).toBeCloseTo(1.0, 2);
    expect(c.g).toBeCloseTo(0.0, 2);
    expect(c.b).toBeCloseTo(0.0, 2);
  });

  it("exposes hue, saturation, value", () => {
    const c = new HSV([0.5, 0.8, 0.6]);
    expect(c.hue).toBeCloseTo(0.5, 5);
    expect(c.saturation).toBeCloseTo(0.8, 5);
    expect(c.value).toBeCloseTo(0.6, 5);
  });

  it("h/s/v aliases work", () => {
    const c = new HSV([0.25, 0.5, 0.75]);
    expect(c.h).toBeCloseTo(0.25, 5);
    expect(c.s).toBeCloseTo(0.5, 5);
    expect(c.v).toBeCloseTo(0.75, 5);
  });

  it("_fromInternal roundtrips", () => {
    const original = new ManimColor("#FF8040");
    const hsv = HSV._fromInternal(original.toRgba());
    expect(hsv.r).toBeCloseTo(original.r, 2);
    expect(hsv.g).toBeCloseTo(original.g, 2);
    expect(hsv.b).toBeCloseTo(original.b, 2);
  });
});

describe("RGBA alias", () => {
  it("RGBA is ManimColor", () => {
    expect(RGBA).toBe(ManimColor);
  });
});

describe("helper functions", () => {
  it("colorToRgb returns 3-element array", () => {
    const rgb = colorToRgb("#FF0000");
    expect(rgb).toHaveLength(3);
    expect(rgb[0]).toBeCloseTo(1.0, 2);
  });

  it("colorToRgba returns 4-element array", () => {
    const rgba = colorToRgba("#FF0000", 0.5);
    expect(rgba).toHaveLength(4);
    expect(rgba[3]).toBeCloseTo(0.5, 5);
  });

  it("colorToIntRgb returns ints", () => {
    const rgb = colorToIntRgb("#FF0000");
    expect(rgb[0]).toBe(255);
  });

  it("colorToIntRgba returns ints", () => {
    const rgba = colorToIntRgba("#FF0000", 0.5);
    expect(rgba[0]).toBe(255);
    expect(rgba[3]).toBe(128);
  });

  it("rgbToColor creates ManimColor", () => {
    const c = rgbToColor([1, 0, 0]);
    expect(c).toBeInstanceOf(ManimColor);
    expect(c.r).toBeCloseTo(1.0, 2);
  });

  it("rgbaToColor creates ManimColor", () => {
    const c = rgbaToColor([1, 0, 0, 0.5]);
    expect(c.a).toBeCloseTo(0.5, 5);
  });

  it("rgbToHex converts correctly", () => {
    expect(rgbToHex([1, 0, 0])).toBe("#FF0000");
  });

  it("hexToRgb converts correctly", () => {
    const rgb = hexToRgb("#FF0000");
    expect(rgb[0]).toBeCloseTo(1.0, 2);
  });

  it("invertColor inverts", () => {
    const inv = invertColor(new ManimColor("#FF0000"));
    expect(inv.r).toBeCloseTo(0.0, 2);
    expect(inv.g).toBeCloseTo(1.0, 2);
  });

  it("interpolateColor works", () => {
    const result = interpolateColor(
      new ManimColor("#000000"),
      new ManimColor("#FFFFFF"),
      0.5
    );
    expect(result.r).toBeCloseTo(0.5, 2);
  });

  it("averageColor averages", () => {
    const avg = averageColor("#FF0000", "#00FF00", "#0000FF");
    // Average of (1,0,0), (0,1,0), (0,0,1) = (0.333, 0.333, 0.333)
    expect(avg.r).toBeCloseTo(1 / 3, 1);
    expect(avg.g).toBeCloseTo(1 / 3, 1);
    expect(avg.b).toBeCloseTo(1 / 3, 1);
  });

  it("colorGradient returns correct length", () => {
    const gradient = colorGradient(["#FF0000", "#0000FF"], 5);
    expect(gradient).toHaveLength(5);
  });

  it("colorGradient endpoints match", () => {
    const gradient = colorGradient(["#FF0000", "#0000FF"], 3);
    expect(gradient[0].r).toBeCloseTo(1.0, 2);
    expect(gradient[2].b).toBeCloseTo(1.0, 1);
  });

  it("colorGradient with empty output", () => {
    expect(colorGradient(["#FF0000"], 0)).toHaveLength(0);
  });

  it("randomColor returns ManimColor", () => {
    const c = randomColor();
    expect(c).toBeInstanceOf(ManimColor);
  });

  it("randomBrightColor returns ManimColor", () => {
    const c = randomBrightColor();
    expect(c).toBeInstanceOf(ManimColor);
  });
});

describe("RandomColorGenerator", () => {
  it("produces deterministic colors with seed", () => {
    const gen1 = new RandomColorGenerator(42);
    const gen2 = new RandomColorGenerator(42);
    const c1 = gen1.next();
    const c2 = gen2.next();
    expect(c1.toHex()).toBe(c2.toHex());
  });

  it("produces colors without seed", () => {
    const gen = new RandomColorGenerator();
    const c = gen.next();
    expect(c).toBeInstanceOf(ManimColor);
  });
});

describe("color constants", () => {
  it("manim default colors are ManimColor instances", () => {
    expect(WHITE).toBeInstanceOf(ManimColor);
    expect(BLACK).toBeInstanceOf(ManimColor);
    expect(RED).toBeInstanceOf(ManimColor);
    expect(GREEN).toBeInstanceOf(ManimColor);
    expect(BLUE).toBeInstanceOf(ManimColor);
    expect(YELLOW).toBeInstanceOf(ManimColor);
  });

  it("RED is #FC6255 (Manim red, not pure red)", () => {
    expect(RED.toHex()).toBe("#FC6255");
  });

  it("YELLOW is #F7D96F (warm gold, not pure yellow)", () => {
    expect(YELLOW.toHex()).toBe("#F7D96F");
  });

  it("PURE_RED is #FF0000", () => {
    expect(PURE_RED.toHex()).toBe("#FF0000");
  });

  it("PURE_GREEN is #00FF00", () => {
    expect(PURE_GREEN.toHex()).toBe("#00FF00");
  });

  it("PURE_BLUE is #0000FF", () => {
    expect(PURE_BLUE.toHex()).toBe("#0000FF");
  });
});

describe("color submodules", () => {
  it("AS2700 has Australian colors", () => {
    expect(AS2700.B23_BRIGHT_BLUE).toBeInstanceOf(ManimColor);
    expect(AS2700.B23_BRIGHT_BLUE.toHex()).toBe("#174F90");
  });

  it("BS381 has British standard colors", () => {
    expect(BS381.OXFORD_BLUE).toBeInstanceOf(ManimColor);
    expect(BS381.OXFORD_BLUE.toHex()).toBe("#1F3057");
  });

  it("DVIPSNAMES has dvips colors", () => {
    expect(DVIPSNAMES.CERULEAN).toBeInstanceOf(ManimColor);
  });

  it("SVGNAMES has SVG colors", () => {
    expect(SVGNAMES.CORAL).toBeInstanceOf(ManimColor);
  });

  it("X11 has X11 colors", () => {
    expect(X11.BEIGE).toBeInstanceOf(ManimColor);
    expect(X11.BEIGE.toHex()).toBe("#F5F5DC");
  });

  it("XKCD has XKCD survey colors", () => {
    expect(XKCD.MANGO).toBeInstanceOf(ManimColor);
    expect(XKCD.MANGO.toHex()).toBe("#FFA62B");
  });
});

describe("color dictionary", () => {
  it("_allColorDict is populated", () => {
    expect(_allColorDict).toBeInstanceOf(Map);
    expect(_allColorDict.size).toBeGreaterThan(100);
  });

  it("can look up colors by name", () => {
    expect(_allColorDict.get("WHITE")).toBeInstanceOf(ManimColor);
    expect(_allColorDict.get("RED")).toBeInstanceOf(ManimColor);
  });

  it("string lookup in ManimColor works after dict init", () => {
    // This tests the _allColorDict is wired into ManimColor._fromString
    const c = new ManimColor("RED");
    expect(c).toBeInstanceOf(ManimColor);
  });
});
