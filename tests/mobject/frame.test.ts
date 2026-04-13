import { describe, it, expect } from "vitest";
import { ScreenRectangle, FullScreenRectangle } from "../../src/mobject/frame/index.js";

describe("ScreenRectangle", () => {
  it("constructs with default 16:9 aspect ratio and height 4", () => {
    const sr = new ScreenRectangle();
    expect(sr.height).toBeCloseTo(4, 5);
    expect(sr.width).toBeCloseTo((16 / 9) * 4, 5);
  });

  it("constructs with custom aspect ratio", () => {
    const sr = new ScreenRectangle({ aspectRatio: 4 / 3 });
    expect(sr.height).toBeCloseTo(4, 5);
    expect(sr.width).toBeCloseTo((4 / 3) * 4, 5);
  });

  it("constructs with custom height", () => {
    const sr = new ScreenRectangle({ height: 6 });
    expect(sr.height).toBeCloseTo(6, 5);
    expect(sr.width).toBeCloseTo((16 / 9) * 6, 5);
  });

  it("constructs with both custom aspect ratio and height", () => {
    const sr = new ScreenRectangle({ aspectRatio: 2, height: 3 });
    expect(sr.height).toBeCloseTo(3, 5);
    expect(sr.width).toBeCloseTo(6, 5);
  });

  it("aspectRatio getter returns width / height", () => {
    const sr = new ScreenRectangle({ aspectRatio: 2, height: 5 });
    expect(sr.aspectRatio).toBeCloseTo(2, 5);
  });

  it("aspectRatio setter stretches width", () => {
    const sr = new ScreenRectangle({ height: 4 });
    sr.aspectRatio = 2;
    expect(sr.width).toBeCloseTo(8, 5);
    expect(sr.height).toBeCloseTo(4, 5);
  });

  it("is an instance of ScreenRectangle", () => {
    const sr = new ScreenRectangle();
    expect(sr).toBeInstanceOf(ScreenRectangle);
  });
});

describe("FullScreenRectangle", () => {
  it("uses config.frameHeight for its height", () => {
    const fsr = new FullScreenRectangle();
    // Default config.frameHeight is 8.0
    expect(fsr.height).toBeCloseTo(8.0, 5);
  });

  it("preserves default 16:9 aspect ratio scaled to frame height", () => {
    const fsr = new FullScreenRectangle();
    expect(fsr.aspectRatio).toBeCloseTo(16 / 9, 4);
  });

  it("is an instance of ScreenRectangle", () => {
    const fsr = new FullScreenRectangle();
    expect(fsr).toBeInstanceOf(ScreenRectangle);
  });
});
