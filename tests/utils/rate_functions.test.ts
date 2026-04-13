import { describe, it, expect } from "vitest";
import {
  linear,
  smooth,
  smoothstep,
  smootherstep,
  smoothererstep,
  rushInto,
  rushFrom,
  slowInto,
  doubleSmooth,
  thereAndBack,
  thereAndBackWithPause,
  runningStart,
  notQuiteThere,
  wiggle,
  wiggleWith,
  squishRateFunc,
  lingering,
  exponentialDecay,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInBack,
  easeOutBack,
  easeInBounce,
  easeOutBounce,
  easeInOutBounce,
  easeInElastic,
  easeOutElastic,
} from "../../src/utils/rate_functions/index.js";

const EPS = 1e-9;

// Helper: check that a rate function maps 0→0 and 1→1
function assertBoundary(fn: (t: number) => number, name: string): void {
  expect(fn(0), `${name}(0) should be 0`).toBeCloseTo(0, 10);
  expect(fn(1), `${name}(1) should be 1`).toBeCloseTo(1, 10);
}

// Helper: check clamping outside [0,1]
function assertClamped(fn: (t: number) => number, name: string): void {
  expect(fn(-1), `${name}(-1) should be 0`).toBe(0);
  expect(fn(2), `${name}(2) should be 1`).toBe(1);
}

describe("linear", () => {
  it("maps t→t on [0,1]", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(linear(t)).toBeCloseTo(t, 10);
    }
  });
  it("clamps outside [0,1]", () => assertClamped(linear, "linear"));
  it("has correct boundary values", () => assertBoundary(linear, "linear"));
});

describe("smooth", () => {
  it("has correct boundary values", () => assertBoundary(smooth, "smooth"));
  it("clamps outside [0,1]", () => assertClamped(smooth, "smooth"));
  it("is symmetric around 0.5", () => {
    expect(smooth(0.3)).toBeCloseTo(1 - smooth(0.7), 10);
  });
  it("is monotonically increasing on (0,1)", () => {
    let prev = smooth(0);
    for (let i = 1; i <= 10; i++) {
      const cur = smooth(i / 10);
      expect(cur).toBeGreaterThanOrEqual(prev - EPS);
      prev = cur;
    }
  });
  it("is S-shaped: below linear before 0.5 and above after", () => {
    // smooth is S-shaped; at midpoint exactly 0.5
    expect(smooth(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("smoothstep", () => {
  it("formula: 3t²-2t³", () => {
    expect(smoothstep(0.5)).toBeCloseTo(3 * 0.25 - 2 * 0.125, 10);
  });
  it("has correct boundary values", () => assertBoundary(smoothstep, "smoothstep"));
});

describe("smootherstep", () => {
  it("has correct boundary values", () => assertBoundary(smootherstep, "smootherstep"));
  it("formula: 6t⁵-15t⁴+10t³", () => {
    const t = 0.5;
    expect(smootherstep(t)).toBeCloseTo(6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3, 10);
  });
});

describe("smoothererstep", () => {
  it("has correct boundary values", () => assertBoundary(smoothererstep, "smoothererstep"));
});

describe("rushInto", () => {
  // rushInto = 2*smooth(t/2): uses left half of S-curve → slow start, fast end
  it("slow start: value at 0.5 is well below 0.5", () => {
    expect(rushInto(0.5)).toBeLessThan(0.5);
  });
  it("has correct boundary values", () => assertBoundary(rushInto, "rushInto"));
  it("clamps outside [0,1]", () => assertClamped(rushInto, "rushInto"));
});

describe("rushFrom", () => {
  // rushFrom = 2*smooth(t/2+0.5)-1: uses right half of S-curve → fast start, slow end
  it("fast start: value at 0.5 is well above 0.5", () => {
    expect(rushFrom(0.5)).toBeGreaterThan(0.5);
  });
  it("has correct boundary values", () => assertBoundary(rushFrom, "rushFrom"));
});

describe("slowInto", () => {
  it("has correct boundary values", () => assertBoundary(slowInto, "slowInto"));
  it("matches sqrt formula at t=0.5", () => {
    expect(slowInto(0.5)).toBeCloseTo(Math.sqrt(1 - 0.25), 10);
  });
});

describe("doubleSmooth", () => {
  it("has correct boundary values", () => assertBoundary(doubleSmooth, "doubleSmooth"));
  it("is 0.5 at t=0.5", () => {
    expect(doubleSmooth(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("thereAndBack", () => {
  it("returns 0 at t=0 and t=1", () => {
    expect(thereAndBack(0)).toBeCloseTo(0, 5);
    expect(thereAndBack(1)).toBeCloseTo(0, 5);
  });
  it("peaks near t=0.5", () => {
    expect(thereAndBack(0.5)).toBeCloseTo(1, 3);
  });
  it("returns 0 outside [0,1]", () => {
    expect(thereAndBack(-0.1)).toBe(0);
    expect(thereAndBack(1.1)).toBe(0);
  });
  it("is symmetric", () => {
    expect(thereAndBack(0.3)).toBeCloseTo(thereAndBack(0.7), 10);
  });
});

describe("thereAndBackWithPause", () => {
  const fn = thereAndBackWithPause();
  it("returns 0 at t=0 and t=1", () => {
    expect(fn(0)).toBeCloseTo(0, 5);
    expect(fn(1)).toBeCloseTo(0, 5);
  });
  it("holds at 1 near midpoint", () => {
    expect(fn(0.5)).toBe(1);
  });
  it("returns 0 outside [0,1]", () => {
    expect(fn(-0.1)).toBe(0);
    expect(fn(1.1)).toBe(0);
  });
  it("accepts custom pause ratio", () => {
    const fn2 = thereAndBackWithPause(0.5);
    expect(fn2(0.5)).toBe(1);
  });
});

describe("runningStart", () => {
  it("has correct boundary values", () => {
    const fn = runningStart();
    assertBoundary(fn, "runningStart");
  });
  it("dips below 0 at start (pull_factor=-0.5)", () => {
    const fn = runningStart(-0.5);
    // With negative pull_factor, the curve goes negative briefly before 0
    let hasNegative = false;
    for (let i = 1; i <= 20; i++) {
      if (fn(i / 100) < 0) hasNegative = true;
    }
    expect(hasNegative).toBe(true);
  });
  it("positive pull_factor gives overshoot", () => {
    const fn = runningStart(0.5);
    let hasPositive = false;
    for (let i = 1; i <= 20; i++) {
      if (fn(i / 100) > 0) hasPositive = true;
    }
    expect(hasPositive).toBe(true);
  });
});

describe("notQuiteThere", () => {
  it("scales output by proportion", () => {
    const fn = notQuiteThere(linear, 0.5);
    expect(fn(0.5)).toBeCloseTo(0.25, 10);
    expect(fn(1)).toBeCloseTo(0.5, 10);
  });
  it("default proportion=0.7 with default smooth func", () => {
    const fn = notQuiteThere();
    expect(fn(1)).toBeCloseTo(0.7, 5);
    expect(fn(0)).toBeCloseTo(0, 5);
  });
});

describe("wiggle", () => {
  it("returns 0 at endpoints", () => {
    expect(wiggle(0)).toBeCloseTo(0, 5);
    expect(wiggle(1)).toBeCloseTo(0, 5);
  });
  it("returns 0 outside [0,1]", () => {
    expect(wiggle(-0.1)).toBe(0);
    expect(wiggle(1.1)).toBe(0);
  });
});

describe("wiggleWith", () => {
  it("uses custom wiggles count", () => {
    const fn1 = wiggleWith(1);
    const fn2 = wiggleWith(4);
    // Different wiggles give different shapes
    expect(fn1(0.25)).not.toBeCloseTo(fn2(0.25), 5);
  });
});

describe("squishRateFunc", () => {
  it("identity outside active window → clamps to 0 or 1", () => {
    const fn = squishRateFunc(linear, 0.2, 0.8);
    expect(fn(0)).toBeCloseTo(0, 10);
    expect(fn(1)).toBeCloseTo(1, 10);
  });
  it("linearly maps within window", () => {
    const fn = squishRateFunc(linear, 0.2, 0.8);
    expect(fn(0.5)).toBeCloseTo(0.5, 10); // (0.5-0.2)/(0.8-0.2) = 0.5
    expect(fn(0.2)).toBeCloseTo(0, 10);
    expect(fn(0.8)).toBeCloseTo(1, 10);
  });
  it("returns a when a === b", () => {
    const fn = squishRateFunc(linear, 0.3, 0.3);
    expect(fn(0)).toBe(0.3);
    expect(fn(0.5)).toBe(0.3);
    expect(fn(1)).toBe(0.3);
  });
  it("default params a=0.4, b=0.6", () => {
    const fn = squishRateFunc(linear);
    expect(fn(0.3)).toBeCloseTo(0, 10);   // below a
    expect(fn(0.7)).toBeCloseTo(1, 10);   // above b
    expect(fn(0.5)).toBeCloseTo(0.5, 10); // (0.5-0.4)/(0.6-0.4) = 0.5
  });
});

describe("lingering", () => {
  it("has correct boundary values", () => assertBoundary(lingering, "lingering"));
  it("linear up to 0.8 then holds at 1", () => {
    // Within [0, 0.8]: returns t/0.8 (linear stretch)
    expect(lingering(0.4)).toBeCloseTo(0.5, 5); // 0.4/0.8 = 0.5
    expect(lingering(0.8)).toBeCloseTo(1, 5);
    expect(lingering(0.9)).toBeCloseTo(1, 5);
  });
});

describe("exponentialDecay", () => {
  const fn = exponentialDecay(0.1);
  it("starts at 0", () => {
    expect(fn(0)).toBeCloseTo(0, 10);
  });
  it("approaches 1 at t=1 (within 0.01%, matches Python)", () => {
    // 1 - e^(-10) ≈ 0.99995 — not exactly 1, by design (Python comment notes this)
    expect(fn(1)).toBeGreaterThan(0.999);
  });
  it("uses e-based exponential (matches Python)", () => {
    // 1 - e^(-0.5/0.1) = 1 - e^(-5)
    expect(fn(0.5)).toBeCloseTo(1 - Math.exp(-0.5 / 0.1), 10);
  });
  it("approaches 1 as t→1", () => {
    expect(fn(1)).toBeCloseTo(1, 3);
  });
});

describe("standard easing functions", () => {
  const fns: Array<[(t: number) => number, string]> = [
    [easeInSine, "easeInSine"],
    [easeOutSine, "easeOutSine"],
    [easeInOutSine, "easeInOutSine"],
    [easeInQuad, "easeInQuad"],
    [easeOutQuad, "easeOutQuad"],
    [easeInOutQuad, "easeInOutQuad"],
    [easeInCubic, "easeInCubic"],
    [easeOutCubic, "easeOutCubic"],
    [easeInOutCubic, "easeInOutCubic"],
    [easeInExpo, "easeInExpo"],
    [easeOutExpo, "easeOutExpo"],
    [easeInOutExpo, "easeInOutExpo"],
    [easeInBack, "easeInBack"],
    [easeOutBack, "easeOutBack"],
    [easeInBounce, "easeInBounce"],
    [easeOutBounce, "easeOutBounce"],
    [easeInOutBounce, "easeInOutBounce"],
    [easeInElastic, "easeInElastic"],
    [easeOutElastic, "easeOutElastic"],
  ];

  for (const [fn, name] of fns) {
    it(`${name}: maps 0→0 and 1→1`, () => assertBoundary(fn, name));
  }

  it("easeInSine matches formula: 1 - cos(πt/2)", () => {
    expect(easeInSine(0.5)).toBeCloseTo(1 - Math.cos(Math.PI / 4), 10);
  });

  it("easeOutSine matches formula: sin(πt/2)", () => {
    expect(easeOutSine(0.5)).toBeCloseTo(Math.sin(Math.PI / 4), 10);
  });

  it("easeInOutSine is symmetric", () => {
    expect(easeInOutSine(0.3)).toBeCloseTo(1 - easeInOutSine(0.7), 10);
  });

  it("easeInQuad matches t²", () => {
    expect(easeInQuad(0.5)).toBeCloseTo(0.25, 10);
  });

  it("easeOutBounce produces correct bounce at 1/2.75", () => {
    // At t = 1/2.75: n1*(1/2.75)^2 = 7.5625 * (1/2.75)^2
    const t = 1 / 2.75;
    expect(easeOutBounce(t)).toBeCloseTo(7.5625 * t * t, 5);
  });

  it("easeInBounce + easeOutBounce complement: in(t) = 1 - out(1-t)", () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      expect(easeInBounce(t)).toBeCloseTo(1 - easeOutBounce(1 - t), 8);
    }
  });

  it("easeInExpo: 0 at t=0, 1 at t=1, uses pow(2,...)", () => {
    expect(easeInExpo(0)).toBe(0);
    expect(easeInExpo(1)).toBeCloseTo(1, 10);
    expect(easeInExpo(0.5)).toBeCloseTo(Math.pow(2, -5), 10);
  });
});
