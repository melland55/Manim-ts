/**
 * Public API barrel for scene/scene_file_writer.
 */

export {
  SceneFileWriter,
  toFfmpegFrameRate,
  convertAudio,
} from "./scene_file_writer.js";

export type {
  PixelArray,
  StrPath,
  FrameRate,
  SceneFileWriterConfig,
  SceneFileWriterRenderer,
} from "./scene_file_writer.js";

export { AudioSegment } from "./audio_segment.js";

export { composeSrt } from "./subtitle.js";
export type { Subtitle } from "./subtitle.js";
