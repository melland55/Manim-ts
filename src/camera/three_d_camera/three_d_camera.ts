/**
 * A camera that can be positioned and oriented in three-dimensional space.
 *
 * TypeScript port of manim/camera/three_d_camera.py
 */

import type { NDArray } from "numpy-ts";
import { np, ORIGIN, RIGHT, DOWN, LEFT, OUT, DEGREES } from "../../core/math/index.js";
import type { IMobject, IVMobject, Point3D, Points3D } from "../../core/types.js";
import { Camera } from "../camera/index.js";
import type { CameraOptions } from "../camera/index.js";
import { ValueTracker } from "../../mobject/value_tracker/index.js";
import {
  get3dVmobStartCorner,
  get3dVmobStartCornerUnitNormal,
  get3dVmobEndCorner,
  get3dVmobEndCornerUnitNormal,
} from "../../mobject/three_d/index.js";
import { rotationAboutZ, rotationMatrix } from "../../utils/space_ops/index.js";
import { getShadedRgb } from "../../utils/color/index.js";
import { extractMobjectFamilyMembers } from "../../utils/family/index.js";

export interface ThreeDCameraOptions extends CameraOptions {
  focalDistance?: number;
  shadingFactor?: number;
  defaultDistance?: number;
  lightSourceStartPoint?: Point3D;
  shouldApplyShading?: boolean;
  exponentialProjection?: boolean;
  phi?: number;
  theta?: number;
  gamma?: number;
  zoom?: number;
}

export type FloatRGBA = [number, number, number, number];

export class ThreeDCamera extends Camera {
  focalDistance: number;
  shadingFactor: number;
  defaultDistance: number;
  lightSourceStartPoint: Point3D;
  lightSourcePoint: Point3D;
  shouldApplyShading: boolean;
  exponentialProjection: boolean;

  phiTracker: ValueTracker;
  thetaTracker: ValueTracker;
  focalDistanceTracker: ValueTracker;
  gammaTracker: ValueTracker;
  zoomTracker: ValueTracker;

  fixedOrientationMobjects: Map<IMobject, () => Point3D>;
  fixedInFrameMobjects: Set<IMobject>;

  private _rotationMatrix: NDArray;

  constructor(options: ThreeDCameraOptions = {}) {
    super(options);

    this.focalDistance = options.focalDistance ?? 20.0;
    const phi = options.phi ?? 0;
    const theta = options.theta ?? -90 * (DEGREES as number);
    const gamma = options.gamma ?? 0;
    const zoom = options.zoom ?? 1;
    this.shadingFactor = options.shadingFactor ?? 0.2;
    this.defaultDistance = options.defaultDistance ?? 5.0;

    this.lightSourceStartPoint = options.lightSourceStartPoint
      ? options.lightSourceStartPoint.copy()
      : DOWN.multiply(9).add(LEFT.multiply(7)).add(OUT.multiply(10));

    this.lightSourcePoint = this.lightSourceStartPoint.copy();
    this.shouldApplyShading = options.shouldApplyShading ?? true;
    this.exponentialProjection = options.exponentialProjection ?? false;

    this.phiTracker = new ValueTracker({ value: phi });
    this.thetaTracker = new ValueTracker({ value: theta });
    this.focalDistanceTracker = new ValueTracker({ value: this.focalDistance });
    this.gammaTracker = new ValueTracker({ value: gamma });
    this.zoomTracker = new ValueTracker({ value: zoom });

    this.fixedOrientationMobjects = new Map();
    this.fixedInFrameMobjects = new Set();

    this._rotationMatrix = this.generateRotationMatrix();
  }

  // ── Capture ────────────────────────────────────────────────

  override captureMobjects(
    mobjects: Iterable<IMobject>,
    options?: {
      includeSubmobjects?: boolean;
      excludedMobjects?: IMobject[];
    },
  ): void {
    this.resetRotationMatrix();
    super.captureMobjects(mobjects, options);
  }

  // ── Value trackers ─────────────────────────────────────────

  getValueTrackers(): ValueTracker[] {
    return [
      this.phiTracker,
      this.thetaTracker,
      this.focalDistanceTracker,
      this.gammaTracker,
      this.zoomTracker,
    ];
  }

  // ── Shading ────────────────────────────────────────────────

  modifiedRgbas(
    vmobject: IMobject & { shadeIn3d?: boolean; getNumPoints?: () => number },
    rgbas: FloatRGBA[],
  ): FloatRGBA[] {
    if (!this.shouldApplyShading) {
      return rgbas;
    }
    if (
      vmobject.shadeIn3d &&
      vmobject.getNumPoints &&
      vmobject.getNumPoints() > 0
    ) {
      const lightSourcePoint = this.lightSourcePoint;

      let shadedRgbas: FloatRGBA[];
      if (rgbas.length < 2) {
        shadedRgbas = [
          [...rgbas[0]] as FloatRGBA,
          [...rgbas[0]] as FloatRGBA,
        ];
      } else {
        shadedRgbas = [
          [...rgbas[0]] as FloatRGBA,
          [...rgbas[1]] as FloatRGBA,
        ];
      }

      // Cast: get3dVmob* functions expect VMobjectLike (Mobject & {points, getNumPoints})
      // which the vmobject satisfies at runtime but IMobject interface doesn't cover
      const vmob = vmobject as unknown as Parameters<typeof get3dVmobStartCorner>[0];

      const startRgb = getShadedRgb(
        [shadedRgbas[0][0], shadedRgbas[0][1], shadedRgbas[0][2]],
        get3dVmobStartCorner(vmob),
        get3dVmobStartCornerUnitNormal(vmob),
        lightSourcePoint,
      );
      shadedRgbas[0][0] = startRgb[0];
      shadedRgbas[0][1] = startRgb[1];
      shadedRgbas[0][2] = startRgb[2];

      const endRgb = getShadedRgb(
        [shadedRgbas[1][0], shadedRgbas[1][1], shadedRgbas[1][2]],
        get3dVmobEndCorner(vmob),
        get3dVmobEndCornerUnitNormal(vmob),
        lightSourcePoint,
      );
      shadedRgbas[1][0] = endRgb[0];
      shadedRgbas[1][1] = endRgb[1];
      shadedRgbas[1][2] = endRgb[2];

      return shadedRgbas;
    }
    return rgbas;
  }

  // ── Stroke/Fill rgba overrides ─────────────────────────────

  override getStrokeRgbas(vmobject: IVMobject, background: boolean = false): number[][] {
    const baseRgbas = super.getStrokeRgbas(vmobject, background);
    return this.modifiedRgbas(
      vmobject as unknown as IMobject & { shadeIn3d?: boolean; getNumPoints?: () => number },
      baseRgbas as FloatRGBA[],
    );
  }

  override getFillRgbas(vmobject: IVMobject): number[][] {
    const baseRgbas = super.getFillRgbas(vmobject);
    return this.modifiedRgbas(
      vmobject as unknown as IMobject & { shadeIn3d?: boolean; getNumPoints?: () => number },
      baseRgbas as FloatRGBA[],
    );
  }

  // ── Sorting mobjects by depth ──────────────────────────────

  override getMobjectsToDisplay(
    mobjects: Iterable<IMobject>,
    includeSubmobjects?: boolean,
    excludedMobjects?: IMobject[],
  ): IMobject[] {
    const baseMobjects = super.getMobjectsToDisplay(
      mobjects,
      includeSubmobjects,
      excludedMobjects,
    );

    const rotMatrix = this.getRotationMatrix();

    const zKey = (mob: IMobject): number => {
      const mob3d = mob as IMobject & { shadeIn3d?: boolean };
      if (!mob3d.shadeIn3d) {
        return Infinity;
      }
      const refPoint = (mob as IMobject & { getZIndexReferencePoint?: () => Point3D })
        .getZIndexReferencePoint
        ? (mob as IMobject & { getZIndexReferencePoint: () => Point3D }).getZIndexReferencePoint()
        : mob.getCenter();
      const rotated = np.dot(refPoint, rotMatrix.T) as NDArray;
      return rotated.item(2) as number;
    };

    return baseMobjects.sort((a, b) => zKey(a) - zKey(b));
  }

  // ── Phi / Theta / Focal Distance / Gamma / Zoom ───────────

  getPhi(): number {
    return this.phiTracker.getValue();
  }

  getTheta(): number {
    return this.thetaTracker.getValue();
  }

  getFocalDistance(): number {
    return this.focalDistanceTracker.getValue();
  }

  getGamma(): number {
    return this.gammaTracker.getValue();
  }

  getZoom(): number {
    return this.zoomTracker.getValue();
  }

  setPhi(value: number): void {
    this.phiTracker.setValue(value);
  }

  setTheta(value: number): void {
    this.thetaTracker.setValue(value);
  }

  setFocalDistance(value: number): void {
    this.focalDistanceTracker.setValue(value);
  }

  setGamma(value: number): void {
    this.gammaTracker.setValue(value);
  }

  setZoom(value: number): void {
    this.zoomTracker.setValue(value);
  }

  // ── Rotation matrix ────────────────────────────────────────

  resetRotationMatrix(): void {
    this._rotationMatrix = this.generateRotationMatrix();
  }

  getRotationMatrix(): NDArray {
    return this._rotationMatrix;
  }

  generateRotationMatrix(): NDArray {
    const phi = this.getPhi();
    const theta = this.getTheta();
    const gamma = this.getGamma();

    const matrices = [
      rotationAboutZ(-theta - 90 * (DEGREES as number)),
      rotationMatrix(-phi, RIGHT),
      rotationAboutZ(gamma),
    ];

    let result = np.eye(3);
    for (const matrix of matrices) {
      result = np.dot(matrix, result) as NDArray;
    }
    return result;
  }

  // ── Projection ─────────────────────────────────────────────

  projectPoints(points: Points3D): Points3D {
    const frameCenter = this.frameCenter;
    const focalDistance = this.getFocalDistance();
    const zoom = this.getZoom();
    const rotMatrix = this.getRotationMatrix();

    let projected = points.subtract(frameCenter) as NDArray;
    projected = np.dot(projected, rotMatrix.T) as NDArray;

    const numPoints = projected.shape[0];

    for (let p = 0; p < numPoints; p++) {
      const z = projected.get([p, 2]) as number;

      for (const i of [0, 1]) {
        let factor: number;
        if (this.exponentialProjection) {
          if (z < 0) {
            factor = focalDistance / (focalDistance - z);
          } else {
            factor = Math.exp(z / focalDistance);
          }
        } else {
          const denom = focalDistance - z;
          if (denom < 0) {
            factor = 1e6;
          } else {
            factor = focalDistance / denom;
          }
        }

        const val = projected.get([p, i]) as number;
        projected.set([p, i], val * factor * zoom);
      }
    }

    return projected;
  }

  projectPoint(point: Point3D): Point3D {
    const reshaped = point.reshape(1, 3);
    const projected = this.projectPoints(reshaped);
    return np.array([
      projected.get([0, 0]) as number,
      projected.get([0, 1]) as number,
      projected.get([0, 2]) as number,
    ]);
  }

  // ── Transform points pre-display ───────────────────────────

  override transformPointsPreDisplay(
    mobject: IMobject,
    points: NDArray,
  ): NDArray {
    // Call parent for validation (non-finite check, etc.)
    const validatedPoints = super.transformPointsPreDisplay(mobject, points);

    const fixedInFrame = this.fixedInFrameMobjects.has(mobject);
    if (fixedInFrame) {
      return validatedPoints;
    }

    const fixedOrientation = this.fixedOrientationMobjects.has(mobject);
    if (fixedOrientation) {
      const centerFunc = this.fixedOrientationMobjects.get(mobject)!;
      const center = centerFunc();
      const newCenter = this.projectPoint(center);
      return validatedPoints.add(newCenter.subtract(center)) as NDArray;
    }

    return this.projectPoints(validatedPoints);
  }

  // ── Fixed orientation / fixed in frame ─────────────────────

  addFixedOrientationMobjects(
    ...mobjects: IMobject[]
  ): void;
  addFixedOrientationMobjects(
    options: {
      mobjects: IMobject[];
      useStaticCenterFunc?: boolean;
      centerFunc?: () => Point3D;
    },
  ): void;
  addFixedOrientationMobjects(
    ...args:
      | IMobject[]
      | [{ mobjects: IMobject[]; useStaticCenterFunc?: boolean; centerFunc?: () => Point3D }]
  ): void {
    let mobjects: IMobject[];
    let useStaticCenterFunc = false;
    let centerFunc: (() => Point3D) | undefined;

    if (
      args.length === 1 &&
      typeof args[0] === "object" &&
      args[0] !== null &&
      "mobjects" in (args[0] as Record<string, unknown>)
    ) {
      const opts = args[0] as {
        mobjects: IMobject[];
        useStaticCenterFunc?: boolean;
        centerFunc?: () => Point3D;
      };
      mobjects = opts.mobjects;
      useStaticCenterFunc = opts.useStaticCenterFunc ?? false;
      centerFunc = opts.centerFunc;
    } else {
      mobjects = args as IMobject[];
    }

    const getStaticCenterFunc = (mob: IMobject): (() => Point3D) => {
      const point = mob.getCenter();
      return () => point;
    };

    for (const mobject of mobjects) {
      let func: () => Point3D;
      if (centerFunc) {
        func = centerFunc;
      } else if (useStaticCenterFunc) {
        func = getStaticCenterFunc(mobject);
      } else {
        func = () => mobject.getCenter();
      }

      for (const submob of mobject.getFamily()) {
        this.fixedOrientationMobjects.set(submob, func);
      }
    }
  }

  addFixedInFrameMobjects(...mobjects: IMobject[]): void {
    const familyMembers = extractMobjectFamilyMembers(mobjects);
    for (const mob of familyMembers) {
      this.fixedInFrameMobjects.add(mob);
    }
  }

  removeFixedOrientationMobjects(...mobjects: IMobject[]): void {
    const familyMembers = extractMobjectFamilyMembers(mobjects);
    for (const mob of familyMembers) {
      this.fixedOrientationMobjects.delete(mob);
    }
  }

  removeFixedInFrameMobjects(...mobjects: IMobject[]): void {
    const familyMembers = extractMobjectFamilyMembers(mobjects);
    for (const mob of familyMembers) {
      this.fixedInFrameMobjects.delete(mob);
    }
  }
}
