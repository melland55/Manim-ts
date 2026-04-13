/**
 * A scene suitable for rendering three-dimensional objects and animations.
 *
 * TypeScript port of manim/scene/three_d_scene.py
 */

import type { IAnimation, IMobject, Point3D } from "../../core/types.js";
import { DEGREES } from "../../core/math/index.js";
import { Scene } from "../scene/index.js";
import type { SceneOptions } from "../scene/index.js";
import { ThreeDCamera } from "../../camera/three_d_camera/index.js";
import type { ThreeDCameraOptions } from "../../camera/three_d_camera/index.js";
import { ValueTracker } from "../../mobject/value_tracker/index.js";
import { Mobject } from "../../mobject/mobject/index.js";
import { Sphere } from "../../mobject/three_d/index.js";
import type { SphereOptions } from "../../mobject/three_d/index.js";
import { mergeDictsRecursively } from "../../utils/config_ops/index.js";
import type { AnyDict } from "../../utils/config_ops/index.js";

// ─── Options ────────────────────────────────────────────────

export interface ThreeDSceneOptions extends SceneOptions {
  ambientCameraRotation?: number | null;
  defaultAngledCameraOrientationKwargs?: {
    phi?: number;
    theta?: number;
    gamma?: number;
    zoom?: number;
    focalDistance?: number;
  };
}

export interface SpecialThreeDSceneOptions extends ThreeDSceneOptions {
  cutAxesAtRadius?: boolean;
  cameraConfig?: Partial<ThreeDCameraOptions>;
  threeDAxesConfig?: AnyDict;
  sphereConfig?: Partial<SphereOptions>;
  defaultAngledCameraPosition?: {
    phi?: number;
    theta?: number;
    gamma?: number;
    zoom?: number;
    focalDistance?: number;
  };
  lowQualityConfig?: AnyDict;
}

// ─── SetCameraOrientation options ───────────────────────────

export interface CameraOrientationOptions {
  phi?: number;
  theta?: number;
  gamma?: number;
  zoom?: number;
  focalDistance?: number;
  frameCenter?: IMobject | Point3D;
}

// ─── ThreeDScene ────────────────────────────────────────────

/**
 * This is a Scene, with special configurations and properties that
 * make it suitable for Three Dimensional Scenes.
 */
export class ThreeDScene extends Scene {
  declare camera: ThreeDCamera;

  ambientCameraRotation: number | null;
  defaultAngledCameraOrientationKwargs: {
    phi?: number;
    theta?: number;
    gamma?: number;
    zoom?: number;
    focalDistance?: number;
  };

  constructor(options: ThreeDSceneOptions = {}) {
    const {
      ambientCameraRotation = null,
      defaultAngledCameraOrientationKwargs,
      ...sceneOptions
    } = options;

    const camera = sceneOptions.camera ?? new ThreeDCamera();
    super({ ...sceneOptions, camera });

    this.ambientCameraRotation = ambientCameraRotation;
    this.defaultAngledCameraOrientationKwargs =
      defaultAngledCameraOrientationKwargs ?? {
        phi: 70 * (DEGREES as number),
        theta: -135 * (DEGREES as number),
      };
  }

  /**
   * Sets the orientation of the camera in the scene.
   */
  setCameraOrientation(options: CameraOrientationOptions = {}): void {
    const { phi, theta, gamma, zoom, focalDistance, frameCenter } = options;

    if (phi != null) {
      this.camera.setPhi(phi);
    }
    if (theta != null) {
      this.camera.setTheta(theta);
    }
    if (focalDistance != null) {
      this.camera.setFocalDistance(focalDistance);
    }
    if (gamma != null) {
      this.camera.setGamma(gamma);
    }
    if (zoom != null) {
      this.camera.setZoom(zoom);
    }
    if (frameCenter != null) {
      if (isIMobject(frameCenter)) {
        this.camera.setFrameCenter(frameCenter.getCenter());
      } else {
        this.camera.setFrameCenter(frameCenter);
      }
    }
  }

  /**
   * Begins an ambient rotation of the camera about a specified axis.
   *
   * @param rate - The rate at which the camera should rotate. Negative = clockwise.
   * @param about - Which angle to rotate: "theta", "phi", or "gamma". Defaults to "theta".
   */
  beginAmbientCameraRotation(rate: number = 0.02, about: string = "theta"): void {
    about = about.toLowerCase();

    const trackers: Record<string, ValueTracker> = {
      theta: this.camera.thetaTracker,
      phi: this.camera.phiTracker,
      gamma: this.camera.gammaTracker,
    };

    const tracker = trackers[about];
    if (!tracker) {
      throw new Error(`Invalid ambient rotation angle: "${about}". Must be "theta", "phi", or "gamma".`);
    }

    tracker.addUpdater((_m: Mobject, dt: number) => {
      tracker.incrementValue(rate * dt);
    });
    this.add(tracker as unknown as IMobject);
  }

  /**
   * Stops ambient camera rotation about the given axis.
   *
   * @param about - Which angle to stop rotating: "theta", "phi", or "gamma".
   */
  stopAmbientCameraRotation(about: string = "theta"): void {
    about = about.toLowerCase();

    const trackers: Record<string, ValueTracker> = {
      theta: this.camera.thetaTracker,
      phi: this.camera.phiTracker,
      gamma: this.camera.gammaTracker,
    };

    const tracker = trackers[about];
    if (!tracker) {
      throw new Error(`Invalid ambient rotation angle: "${about}". Must be "theta", "phi", or "gamma".`);
    }

    tracker.clearUpdaters();
    this.remove(tracker as unknown as IMobject);
  }

  /**
   * Creates a 3D camera rotation illusion around the current camera orientation.
   *
   * @param rate - The rate at which the illusion should operate.
   * @param originPhi - The polar angle to oscillate around. Defaults to current phi.
   * @param originTheta - The azimuthal angle to oscillate around. Defaults to current theta.
   */
  begin3dIllusionCameraRotation(
    rate: number = 1,
    originPhi?: number,
    originTheta?: number,
  ): void {
    if (originTheta == null) {
      originTheta = this.camera.thetaTracker.getValue();
    }
    if (originPhi == null) {
      originPhi = this.camera.phiTracker.getValue();
    }

    const valTrackerTheta = new ValueTracker({ value: 0 });
    const capturedOriginTheta = originTheta;

    this.camera.thetaTracker.addUpdater(
      (m: Mobject, dt: number) => {
        valTrackerTheta.incrementValue(dt * rate);
        const valForLeftRight = 0.2 * Math.sin(valTrackerTheta.getValue());
        (m as unknown as ValueTracker).setValue(capturedOriginTheta + valForLeftRight);
      },
    );
    this.add(this.camera.thetaTracker as unknown as IMobject);

    const valTrackerPhi = new ValueTracker({ value: 0 });
    const capturedOriginPhi = originPhi;

    this.camera.phiTracker.addUpdater(
      (m: Mobject, dt: number) => {
        valTrackerPhi.incrementValue(dt * rate);
        const valForUpDown = 0.1 * Math.cos(valTrackerPhi.getValue()) - 0.1;
        (m as unknown as ValueTracker).setValue(capturedOriginPhi + valForUpDown);
      },
    );
    this.add(this.camera.phiTracker as unknown as IMobject);
  }

  /**
   * Stops all illusion camera rotations.
   */
  stop3dIllusionCameraRotation(): void {
    this.camera.thetaTracker.clearUpdaters();
    this.remove(this.camera.thetaTracker as unknown as IMobject);
    this.camera.phiTracker.clearUpdaters();
    this.remove(this.camera.phiTracker as unknown as IMobject);
  }

  /**
   * Animates the movement of the camera to the given spherical coordinates.
   */
  moveCamera(options: {
    phi?: number;
    theta?: number;
    gamma?: number;
    zoom?: number;
    focalDistance?: number;
    frameCenter?: IMobject | Point3D;
    addedAnims?: IAnimation[];
  } = {}): Promise<void> {
    const {
      phi,
      theta,
      gamma,
      zoom,
      focalDistance,
      frameCenter,
      addedAnims = [],
    } = options;

    const anims: IAnimation[] = [];

    const valueTrackerPairs: [number | undefined, ValueTracker][] = [
      [phi, this.camera.phiTracker],
      [theta, this.camera.thetaTracker],
      [focalDistance, this.camera.focalDistanceTracker],
      [gamma, this.camera.gammaTracker],
      [zoom, this.camera.zoomTracker],
    ];

    for (const [value, tracker] of valueTrackerPairs) {
      if (value != null) {
        const builder = tracker.animate;
        builder.getMethod("setValue")(value);
        anims.push(builder.build());
      }
    }

    if (frameCenter != null) {
      const target = isIMobject(frameCenter) ? frameCenter.getCenter() : frameCenter;
      this.camera.setFrameCenter(target);
    }

    return this.play(...anims, ...addedAnims);
  }

  /**
   * Returns a list of all Mobjects in the Scene that are moving.
   * If any camera value trackers are moving, all mobjects are considered moving.
   */
  getMovingMobjects(...animations: IAnimation[]): IMobject[] {
    const movingMobjects: IMobject[] = [];
    for (const anim of animations) {
      const allMobs = anim.getAllMobjects();
      for (const mob of allMobs) {
        if (!movingMobjects.includes(mob)) {
          movingMobjects.push(mob);
        }
      }
    }

    const cameraMobjects = this.camera.getValueTrackers() as unknown as IMobject[];

    if (cameraMobjects.some((cm) => movingMobjects.includes(cm))) {
      return this.mobjects;
    }

    return movingMobjects;
  }

  /**
   * Prevents the rotation and tilting of mobjects as the camera moves.
   * The mobject can still move in x,y,z directions but will maintain
   * its orientation relative to the camera.
   */
  addFixedOrientationMobjects(...mobjects: IMobject[]): void {
    this.add(...mobjects);
    this.camera.addFixedOrientationMobjects(...mobjects);
  }

  /**
   * Prevents the rotation and movement of mobjects as the camera moves.
   * The mobject is essentially overlaid on the frame.
   */
  addFixedInFrameMobjects(...mobjects: IMobject[]): void {
    this.add(...mobjects);
    this.camera.addFixedInFrameMobjects(...mobjects);
  }

  /**
   * Unfixes the orientation of the given mobjects.
   */
  removeFixedOrientationMobjects(...mobjects: IMobject[]): void {
    this.camera.removeFixedOrientationMobjects(...mobjects);
  }

  /**
   * Unfixes the given mobjects from the frame.
   */
  removeFixedInFrameMobjects(...mobjects: IMobject[]): void {
    this.camera.removeFixedInFrameMobjects(...mobjects);
  }

  /**
   * Sets the camera to the default angled orientation.
   */
  setToDefaultAngledCameraOrientation(overrides: CameraOrientationOptions = {}): void {
    const merged = {
      ...this.defaultAngledCameraOrientationKwargs,
      ...overrides,
    };
    this.setCameraOrientation(merged);
  }
}

// ─── SpecialThreeDScene ─────────────────────────────────────

/**
 * An extension of ThreeDScene with more settings.
 *
 * It has extra configuration for axes, spheres, and an override
 * for low quality rendering. Key differences:
 * - The camera shades applicable 3DMobjects by default.
 * - Default params for Spheres and Axes are provided.
 */
export class SpecialThreeDScene extends ThreeDScene {
  cutAxesAtRadius: boolean;
  cameraConfig: Partial<ThreeDCameraOptions>;
  threeDAxesConfig: AnyDict;
  sphereConfig: Partial<SphereOptions>;
  defaultAngledCameraPosition: {
    phi?: number;
    theta?: number;
    gamma?: number;
    zoom?: number;
    focalDistance?: number;
  };
  lowQualityConfig: AnyDict;

  constructor(options: SpecialThreeDSceneOptions = {}) {
    const {
      cutAxesAtRadius = true,
      cameraConfig = { shouldApplyShading: true, exponentialProjection: true },
      threeDAxesConfig = {
        numAxisPieces: 1,
        axisConfig: {
          unitSize: 2,
          tickFrequency: 1,
          numbersWithElongatedTicks: [0, 1, 2],
          strokeWidth: 2,
        },
      },
      sphereConfig = { radius: 2, resolution: [24, 48] },
      defaultAngledCameraPosition = {
        phi: 70 * (DEGREES as number),
        theta: -110 * (DEGREES as number),
      },
      lowQualityConfig = {
        cameraConfig: { shouldApplyShading: false },
        threeDAxesConfig: { numAxisPieces: 1 },
        sphereConfig: { resolution: [12, 24] },
      },
      ...rest
    } = options;

    // Create camera with the camera config
    const camera = new ThreeDCamera(cameraConfig);

    super({ ...rest, camera });

    this.cutAxesAtRadius = cutAxesAtRadius;
    this.cameraConfig = cameraConfig;
    this.threeDAxesConfig = threeDAxesConfig;
    this.sphereConfig = sphereConfig;
    this.defaultAngledCameraPosition = defaultAngledCameraPosition;
    this.lowQualityConfig = lowQualityConfig;
  }

  /**
   * Return a set of 3D axes.
   *
   * Note: Full implementation requires ThreeDAxes, Line, VGroup, and
   * VectorizedPoint which may not be fully converted yet.
   */
  getAxes(): IMobject {
    // TODO: Port fully when ThreeDAxes, Line, VGroup, VectorizedPoint are available
    // Python: axes = ThreeDAxes(**self.three_d_axes_config)
    // The full implementation cuts axes at radius and adds VectorizedPoints to ticks
    throw new Error(
      "SpecialThreeDScene.getAxes() requires ThreeDAxes, Line, VGroup, " +
      "and VectorizedPoint which are not yet fully integrated. " +
      "Use ThreeDAxes directly as a workaround.",
    );
  }

  /**
   * Returns a sphere with the passed keyword arguments merged with defaults.
   */
  getSphere(overrides: Partial<SphereOptions> = {}): Sphere {
    const config = mergeDictsRecursively(
      this.sphereConfig as AnyDict,
      overrides as AnyDict,
    ) as SphereOptions;
    return new Sphere(config);
  }

  /**
   * Returns the default angled camera position.
   */
  getDefaultCameraPosition(): {
    phi?: number;
    theta?: number;
    gamma?: number;
    zoom?: number;
    focalDistance?: number;
  } {
    return { ...this.defaultAngledCameraPosition };
  }

  /**
   * Sets the camera to its default position.
   */
  setCameraToDefaultPosition(): void {
    this.setCameraOrientation(this.defaultAngledCameraPosition);
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Type guard to check if a value is an IMobject (has getCenter method). */
function isIMobject(value: unknown): value is IMobject {
  return (
    typeof value === "object" &&
    value !== null &&
    "getCenter" in value &&
    typeof (value as IMobject).getCenter === "function"
  );
}
