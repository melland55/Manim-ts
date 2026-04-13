/**
 * Custom vitest matchers for Point3D comparisons.
 * Point3D is now NDArray (from numpy-ts).
 */

import { expect } from "vitest";
import type { Point3D, Points3D } from "../../src/core/math/index.js";
import { pointCount, getPoint } from "../../src/core/math/index.js";

function toArr(p: Point3D): number[] {
  return p.toArray() as number[];
}

expect.extend({
  toBeCloseToPoint(received: Point3D, expected: Point3D, precision = 8) {
    const r = toArr(received);
    const e = toArr(expected);
    const tol = Math.pow(10, -precision);
    const pass =
      Math.abs(r[0] - e[0]) < tol &&
      Math.abs(r[1] - e[1]) < tol &&
      Math.abs(r[2] - e[2]) < tol;

    return {
      pass,
      message: () =>
        `expected [${r[0]}, ${r[1]}, ${r[2]}] to be close to [${e[0]}, ${e[1]}, ${e[2]}] (precision: ${precision})`,
    };
  },

  toBeCloseToPoints(received: Points3D, expected: Points3D, precision = 8) {
    const rCount = pointCount(received);
    const eCount = pointCount(expected);

    if (rCount !== eCount) {
      return {
        pass: false,
        message: () =>
          `expected ${rCount} points but got ${eCount} points`,
      };
    }

    for (let i = 0; i < rCount; i++) {
      const rp = toArr(getPoint(received, i));
      const ep = toArr(getPoint(expected, i));
      const tol = Math.pow(10, -precision);
      if (
        Math.abs(rp[0] - ep[0]) >= tol ||
        Math.abs(rp[1] - ep[1]) >= tol ||
        Math.abs(rp[2] - ep[2]) >= tol
      ) {
        return {
          pass: false,
          message: () =>
            `point ${i}: [${rp[0]}, ${rp[1]}, ${rp[2]}] not close to [${ep[0]}, ${ep[1]}, ${ep[2]}]`,
        };
      }
    }

    return { pass: true, message: () => "points match" };
  },
});

// Extend vitest types
declare module "vitest" {
  interface Assertion<T> {
    toBeCloseToPoint(expected: Point3D, precision?: number): void;
    toBeCloseToPoints(expected: Points3D, precision?: number): void;
  }
  interface AsymmetricMatchersContaining {
    toBeCloseToPoint(expected: Point3D, precision?: number): void;
    toBeCloseToPoints(expected: Points3D, precision?: number): void;
  }
}
