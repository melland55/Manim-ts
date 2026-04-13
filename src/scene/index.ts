/**
 * scene — barrel export for the scene module.
 */

export { Scene, EndSceneEarlyError } from "./scene/index.js";
export type { SceneOptions } from "./scene/index.js";

export { Section, DefaultSectionType, getVideoMetadata } from "./section/index.js";
export type { VideoMetadata } from "./section/index.js";

export {
  SceneFileWriter,
  toFfmpegFrameRate,
  convertAudio,
  AudioSegment,
  composeSrt,
} from "./scene_file_writer/index.js";
export type {
  PixelArray,
  StrPath,
  FrameRate,
  SceneFileWriterConfig,
  SceneFileWriterRenderer,
  Subtitle,
} from "./scene_file_writer/index.js";
