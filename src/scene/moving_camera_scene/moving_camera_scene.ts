/**
 * MovingCameraScene — a Scene whose camera can be moved around.
 *
 * This is a Scene with special configurations and properties that make it
 * suitable for cases where the camera must be moved around.
 *
 * Mirrors Python's manim.scene.moving_camera_scene.MovingCameraScene.
 */

import type { IAnimation, IMobject } from "../../core/types.js";
import { Scene } from "../scene/index.js";
import type { SceneOptions } from "../scene/index.js";
import type { Camera } from "../../camera/camera/index.js";
import { MovingCamera } from "../../camera/moving_camera/moving_camera.js";
import { extractMobjectFamilyMembers } from "../../utils/family/family.js";
import { listUpdate } from "../../utils/iterables/iterables.js";

// ─── MovingCameraSceneOptions ─────────────────────────────────────────────────

export interface MovingCameraSceneOptions extends SceneOptions {
  /** Camera class constructor to use. Defaults to MovingCamera. */
  cameraClass?: new (...args: unknown[]) => Camera;
}

// ─── MovingCameraScene ────────────────────────────────────────────────────────

/**
 * A Scene that supports camera movement.
 *
 * The camera is an instance of {@link MovingCamera} by default, which
 * provides a moveable frame for panning and zooming.
 *
 * ```typescript
 * class MyScene extends MovingCameraScene {
 *   async construct() {
 *     const text = new Text("Hello World").setColor(BLUE);
 *     this.add(text);
 *     // this.camera is a MovingCamera with a moveable frame
 *     await this.play(this.camera.frame.animate.set({ width: text.getWidth() * 1.2 }));
 *   }
 * }
 * ```
 */
export class MovingCameraScene extends Scene {
  declare camera: MovingCamera;

  constructor(options: MovingCameraSceneOptions = {}) {
    const { cameraClass = MovingCamera, ...sceneOptions } = options;
    // Construct the camera instance and pass it via the camera option
    const camera = new (cameraClass as new (...args: unknown[]) => Camera)();
    super({ ...sceneOptions, camera });
  }

  /**
   * Returns a list of all Mobjects in the Scene that are moving,
   * including those in the given animations.
   *
   * If any of the camera's movement indicator mobjects (e.g. the frame)
   * are among the moving mobjects, then ALL scene mobjects are considered
   * to be moving (since the camera itself is moving).
   *
   * @param animations The animations whose mobjects will be checked.
   */
  getMovingMobjects(...animations: IAnimation[]): IMobject[] {
    // Delegate to Scene base class to collect mobjects from animations
    const movingMobjects = super.getMovingMobjects(...animations);
    const allMovingMobjects = extractMobjectFamilyMembers(movingMobjects);

    // Check if any camera movement indicators are among the moving mobjects
    const movementIndicators = (this.camera as MovingCamera).getMobjectsIndicatingMovement();
    for (const indicator of movementIndicators) {
      if (allMovingMobjects.includes(indicator)) {
        // When the camera frame is moving, treat all mobjects as moving
        return listUpdate(this.mobjects, movingMobjects);
      }
    }

    return movingMobjects;
  }
}
