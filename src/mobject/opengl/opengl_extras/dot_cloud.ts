/**
 * TypeScript port of manim/mobject/opengl/dot_cloud.py
 *
 * DotCloud and TrueDot classes.
 */

import type { NDArray } from "numpy-ts";
import { np, ORIGIN, RIGHT, UP, PI } from "../../../core/math/index.js";
import { PURE_YELLOW, type ParsableManimColor } from "../../../utils/color/index.js";
import { OpenGLPMobject, type OpenGLPMobjectOptions } from "./opengl_point_cloud_mobject.js";
import type { Point3D } from "../../../core/types.js";

// ─── DotCloud ────────────────────────────────────────────────

export interface DotCloudOptions extends OpenGLPMobjectOptions {
  radius?: number;
  density?: number;
}

/**
 * A cloud of dots arranged in a disc pattern.
 *
 * Python: manim.mobject.opengl.dot_cloud.DotCloud
 */
export class DotCloud extends OpenGLPMobject {
  radius: number;
  epsilon: number;

  constructor(options: DotCloudOptions = {}) {
    const {
      color = PURE_YELLOW,
      strokeWidth = 2.0,
      radius = 2.0,
      density = 10,
      ...rest
    } = options;

    // Set radius/epsilon before super (which calls initPoints)
    const self = { radius, epsilon: 1.0 / density };

    super({ strokeWidth, density, color, ...rest });

    this.radius = radius;
    this.epsilon = self.epsilon;

    // Re-init points now that radius/epsilon are properly set
    this.initPoints();
  }

  override initPoints(): void {
    if (this.radius === undefined || this.epsilon === undefined) return;

    const rightArr = RIGHT.toArray() as number[];
    const upArr = UP.toArray() as number[];
    const points: number[][] = [];

    const rValues: number[] = [];
    for (let r = this.epsilon; r < this.radius; r += this.epsilon) {
      rValues.push(r);
    }

    for (const r of rValues) {
      const numTheta = Math.floor(2 * PI * (r + this.epsilon) / this.epsilon);
      const thetaValues = np.linspace(0, 2 * PI, numTheta).toArray() as number[];

      for (const theta of thetaValues) {
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        points.push([
          r * (cosTheta * rightArr[0] + sinTheta * upArr[0]),
          r * (cosTheta * rightArr[1] + sinTheta * upArr[1]),
          r * (cosTheta * rightArr[2] + sinTheta * upArr[2]),
        ]);
      }
    }

    if (points.length > 0) {
      this.points = np.array(points);
    } else {
      this.points = np.zeros([0, 3]);
    }
  }

  /**
   * Enable 3D rendering with gloss and shadow.
   */
  make3d(gloss: number = 0.5, shadow: number = 0.2): this {
    this.setGloss(gloss);
    this.setShadow(shadow);
    this.applyDepthTest();
    return this;
  }
}

// ─── TrueDot ─────────────────────────────────────────────────

export interface TrueDotOptions extends Omit<DotCloudOptions, "radius"> {
  center?: Point3D | number[];
}

/**
 * A single dot rendered as a point cloud with one point.
 *
 * Python: manim.mobject.opengl.dot_cloud.TrueDot
 */
export class TrueDot extends DotCloud {
  constructor(options: TrueDotOptions = {}) {
    const {
      center = ORIGIN,
      strokeWidth = 2.0,
      ...rest
    } = options;

    // Duck-type NDArray via `.toArray` method — numpy-ts NDArrays are Proxies
    // whose `has` trap does not expose `shape`, making `"shape" in x` unreliable.
    const centerArr =
      center !== null &&
      typeof center === "object" &&
      typeof (center as NDArray).toArray === "function"
        ? ((center as NDArray).toArray() as number[])
        : (center as number[]);

    super({
      strokeWidth,
      points: np.array([centerArr]),
      ...rest,
    });

    this.radius = strokeWidth;
  }

  override initPoints(): void {
    // TrueDot does not use the disc pattern — points are set via constructor
    // No-op: points come from the options.points parameter
  }
}
