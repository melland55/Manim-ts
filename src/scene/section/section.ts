/**
 * Building blocks of the segmented video API.
 *
 * Python equivalent: manim/scene/section.py
 */

import { join } from "path";
import ffmpeg from "fluent-ffmpeg";

// ─── DefaultSectionType ──────────────────────────────────────────────────────

/**
 * The type of a section can be used for third party applications.
 * A presentation system could for example use the types to create loops.
 *
 * @example
 * This class can be reimplemented for more types:
 * ```typescript
 * enum PresentationSectionType {
 *   NORMAL       = "presentation.normal",
 *   SKIP         = "presentation.skip",
 *   LOOP         = "presentation.loop",
 *   COMPLETE_LOOP = "presentation.complete_loop",
 * }
 * ```
 */
export enum DefaultSectionType {
  NORMAL = "default.normal",
}

// ─── Video metadata helper ────────────────────────────────────────────────────

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  [key: string]: unknown;
}

/**
 * Read basic metadata from a video file using ffprobe.
 */
export function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const videoStream = data.streams.find((s) => s.codec_type === "video");
      const duration = data.format.duration ?? 0;
      const width = videoStream?.width ?? 0;
      const height = videoStream?.height ?? 0;

      // Parse fps from r_frame_rate string, e.g. "30/1"
      let fps = 0;
      const rFrameRate = videoStream?.r_frame_rate ?? "0/1";
      const parts = rFrameRate.split("/");
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        fps = den !== 0 ? num / den : 0;
      }

      resolve({ duration, width, height, fps });
    });
  });
}

// ─── Section ─────────────────────────────────────────────────────────────────

/**
 * A {@link IScene} can be segmented into multiple Sections.
 * It consists of multiple animations.
 *
 * @see {@link DefaultSectionType}
 */
export class Section {
  /** Can be used by third party applications to classify different types of sections. */
  type_: string;

  /**
   * Path to video file with animations belonging to section, relative to sections directory.
   * If `null`, the section will not be saved.
   */
  video: string | null;

  /** Human readable, non-unique name for this section. */
  name: string;

  /** Skip rendering the animations in this section when `true`. */
  skipAnimations: boolean;

  /** Animations belonging to this section. */
  partialMovieFiles: Array<string | null>;

  constructor(
    type_: string,
    video: string | null,
    name: string,
    skipAnimations: boolean,
  ) {
    this.type_ = type_;
    this.video = video;
    this.name = name;
    this.skipAnimations = skipAnimations;
    this.partialMovieFiles = [];
  }

  /**
   * Check whether this section is empty.
   *
   * Note that animations represented by `null` are also counted.
   */
  isEmpty(): boolean {
    return this.partialMovieFiles.length === 0;
  }

  /**
   * Return all partial movie files that are not `null`.
   */
  getCleanPartialMovieFiles(): string[] {
    return this.partialMovieFiles.filter(
      (el): el is string => el !== null,
    );
  }

  /**
   * Get dictionary representation with metadata of the output video.
   *
   * The output from this method is used from every section to build the sections index file.
   * The output video must have been created in `sectionsDir` before calling this method.
   * This is the main part of the Segmented Video API.
   */
  async getDict(sectionsDir: string): Promise<Record<string, unknown>> {
    if (this.video === null) {
      throw new Error(
        `Section '${this.name}' cannot be exported as dict, it does not have a video path assigned to it`,
      );
    }

    const videoMetadata = await getVideoMetadata(join(sectionsDir, this.video));

    return {
      name: this.name,
      type: this.type_,
      video: this.video,
      ...videoMetadata,
    };
  }

  toString(): string {
    return `<Section '${this.name}' stored in '${this.video}'>`;
  }
}
