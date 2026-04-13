/**
 * camera — barrel export for the camera module.
 */

export { Camera, BackgroundColoredVMobjectDisplayer } from "./camera/index.js";
export type { CameraOptions, PixelArray } from "./camera/index.js";

export {
  MovingCamera,
  CameraFrame,
  CameraFrameAnimateProxy,
} from "./moving_camera/index.js";
export type {
  IMovableFrame,
  MovingCameraOptions,
} from "./moving_camera/index.js";

export { ThreeDCamera } from "./three_d_camera/index.js";
export type { ThreeDCameraOptions, FloatRGBA } from "./three_d_camera/index.js";
