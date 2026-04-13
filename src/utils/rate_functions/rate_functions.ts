/**
 * Rate functions (speed curves) for animations.
 *
 * Port of manim.utils.rate_functions. Matches the Python source exactly,
 * including formulas and edge cases. Many functions also live in core/math
 * for convenience; this module is the authoritative implementation.
 *
 * Standard easing library: https://easings.net/
 */

import type { RateFunc } from "../../core/math/index.js";
import { sigmoid } from "../../core/math/index.js";

// ─── Decorator helpers ───────────────────────────────────────
// Mirrors Python's @unit_interval and @zero decorators.

function unitInterval(fn: RateFunc): RateFunc {
  return (t: number): number => {
    if (t < 0) return 0;
    if (t > 1) return 1;
    return fn(t);
  };
}

function zero(fn: RateFunc): RateFunc {
  return (t: number): number => {
    if (t < 0 || t > 1) return 0;
    return fn(t);
  };
}

// ─── Core smooth function ────────────────────────────────────

function smoothAt(t: number, inflection: number): number {
  const error = sigmoid(-inflection / 2);
  return Math.min(
    Math.max(
      (sigmoid(inflection * (t - 0.5)) - error) / (1 - 2 * error),
      0,
    ),
    1,
  );
}

// ─── Exported rate functions ─────────────────────────────────

export const linear: RateFunc = unitInterval((t) => t);

/**
 * Manim's default smooth: sigmoid-based with inflection=10.
 * Different from smoothstep (3t²-2t³). This is the standard rate func for
 * most Manim animations.
 */
export function smooth(t: number, inflection = 10.0): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return smoothAt(t, inflection);
}

/**
 * 1st order SmoothStep: 3t² - 2t³.
 * https://en.wikipedia.org/wiki/Smoothstep
 */
export const smoothstep: RateFunc = unitInterval((t) => 3 * t * t - 2 * t * t * t);

/**
 * 2nd order SmoothStep: 6t⁵ - 15t⁴ + 10t³.
 * 1st and 2nd derivatives are zero at endpoints.
 */
export const smootherstep: RateFunc = unitInterval(
  (t) => 6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3,
);

/**
 * 3rd order SmoothStep: 35t⁴ - 84t⁵ + 70t⁶ - 20t⁷.
 * 1st, 2nd and 3rd derivatives are zero at endpoints.
 */
export const smoothererstep: RateFunc = unitInterval(
  (t) => 35 * t ** 4 - 84 * t ** 5 + 70 * t ** 6 - 20 * t ** 7,
);

export function rushInto(t: number, inflection = 10.0): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return 2 * smoothAt(t / 2.0, inflection);
}

export function rushFrom(t: number, inflection = 10.0): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return 2 * smoothAt(t / 2.0 + 0.5, inflection) - 1;
}

export const slowInto: RateFunc = unitInterval((t) => Math.sqrt(1 - (1 - t) * (1 - t)));

export const doubleSmooth: RateFunc = unitInterval((t) => {
  if (t < 0.5) return 0.5 * smooth(2 * t);
  return 0.5 * (1 + smooth(2 * t - 1));
});

export const thereAndBack: RateFunc = zero((t) => {
  const newT = t < 0.5 ? 2 * t : 2 * (1 - t);
  return smooth(newT);
});

export function thereAndBackWithPause(pauseRatio = 1.0 / 3): RateFunc {
  return zero((t) => {
    const a = 2.0 / (1.0 - pauseRatio);
    if (t < 0.5 - pauseRatio / 2) return smooth(a * t);
    if (t < 0.5 + pauseRatio / 2) return 1;
    return smooth(a - a * t);
  });
}

/**
 * Equivalent to a degree-6 Bézier with control points [0, 0, p, p, 1, 1, 1].
 */
export function runningStart(pullFactor = -0.5): RateFunc {
  return unitInterval((t) => {
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;
    const t6 = t5 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const mt4 = mt3 * mt;
    return (
      15 * t2 * mt4 * pullFactor +
      20 * t3 * mt3 * pullFactor +
      15 * t4 * mt2 +
      6 * t5 * mt +
      t6
    );
  });
}

export function notQuiteThere(func: RateFunc = smooth, proportion = 0.7): RateFunc {
  return (t: number) => proportion * func(t);
}

export function wiggleWith(wiggles = 2): RateFunc {
  return zero((t) => thereAndBack(t) * Math.sin(wiggles * Math.PI * t));
}

/** wiggle with default wiggles=2 */
export const wiggle: RateFunc = wiggleWith(2);

/**
 * Squish a rate function to only act within [a, b] of the timeline.
 * Outside that window the function is clamped to its value at 0 or 1.
 * Special case: when a === b, returns a (the constant boundary value).
 */
export function squishRateFunc(func: RateFunc, a = 0.4, b = 0.6): RateFunc {
  return (t: number): number => {
    if (a === b) return a;
    let newT: number;
    if (t < a) {
      newT = 0.0;
    } else if (t > b) {
      newT = 1.0;
    } else {
      newT = (t - a) / (b - a);
    }
    return func(newT);
  };
}

/**
 * Animation that stays full speed until 80% then holds at 1.
 * Uses identity (linear) squished to [0, 0.8].
 */
export const lingering: RateFunc = unitInterval(
  squishRateFunc((t) => t, 0, 0.8),
);

/**
 * Exponential approach to 1. Uses e-based decay (matches Python).
 * halfLife controls how quickly it reaches 1.
 */
export function exponentialDecay(halfLife = 0.1): RateFunc {
  return unitInterval((t) => 1 - Math.exp(-t / halfLife));
}

// ─── Standard easing functions ───────────────────────────────
// From https://easings.net/ — not in Python __all__ but publicly accessible.

export const easeInSine: RateFunc = unitInterval((t) => 1 - Math.cos((t * Math.PI) / 2));
export const easeOutSine: RateFunc = unitInterval((t) => Math.sin((t * Math.PI) / 2));
export const easeInOutSine: RateFunc = unitInterval((t) => -(Math.cos(Math.PI * t) - 1) / 2);

export const easeInQuad: RateFunc = unitInterval((t) => t * t);
export const easeOutQuad: RateFunc = unitInterval((t) => 1 - (1 - t) * (1 - t));
export const easeInOutQuad: RateFunc = unitInterval((t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
);

export const easeInCubic: RateFunc = unitInterval((t) => t * t * t);
export const easeOutCubic: RateFunc = unitInterval((t) => 1 - Math.pow(1 - t, 3));
export const easeInOutCubic: RateFunc = unitInterval((t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
);

export const easeInQuart: RateFunc = unitInterval((t) => t * t * t * t);
export const easeOutQuart: RateFunc = unitInterval((t) => 1 - Math.pow(1 - t, 4));
export const easeInOutQuart: RateFunc = unitInterval((t) =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
);

export const easeInQuint: RateFunc = unitInterval((t) => t * t * t * t * t);
export const easeOutQuint: RateFunc = unitInterval((t) => 1 - Math.pow(1 - t, 5));
export const easeInOutQuint: RateFunc = unitInterval((t) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
);

export const easeInExpo: RateFunc = unitInterval((t) =>
  t === 0 ? 0 : Math.pow(2, 10 * t - 10),
);
export const easeOutExpo: RateFunc = unitInterval((t) =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
);
export const easeInOutExpo: RateFunc = unitInterval((t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  return t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
});

export const easeInCirc: RateFunc = unitInterval(
  (t) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
);
export const easeOutCirc: RateFunc = unitInterval(
  (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
);
export const easeInOutCirc: RateFunc = unitInterval((t) =>
  t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
);

export const easeInBack: RateFunc = unitInterval((t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
});
export const easeOutBack: RateFunc = unitInterval((t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
});
export const easeInOutBack: RateFunc = unitInterval((t) => {
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
});

export const easeInElastic: RateFunc = unitInterval((t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
});
export const easeOutElastic: RateFunc = unitInterval((t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
});
export const easeInOutElastic: RateFunc = unitInterval((t) => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c5 = (2 * Math.PI) / 4.5;
  return t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
    : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
});

export const easeOutBounce: RateFunc = unitInterval((t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const t2 = t - 1.5 / d1;
    return n1 * t2 * t2 + 0.75;
  } else if (t < 2.5 / d1) {
    const t2 = t - 2.25 / d1;
    return n1 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / d1;
    return n1 * t2 * t2 + 0.984375;
  }
});
export const easeInBounce: RateFunc = unitInterval((t) => 1 - easeOutBounce(1 - t));
export const easeInOutBounce: RateFunc = unitInterval((t) =>
  t < 0.5
    ? (1 - easeOutBounce(1 - 2 * t)) / 2
    : (1 + easeOutBounce(2 * t - 1)) / 2,
);
