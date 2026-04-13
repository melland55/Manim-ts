/**
 * Utility functions for running shell commands and inspecting media files.
 *
 * TypeScript port of Python Manim's manim/utils/commands.py
 */

import * as fs from "fs";
import * as nodePath from "path";
import { spawnSync } from "child_process";
import ffmpeg from "fluent-ffmpeg";

import type { StrOrBytesPath } from "../../typing/typing.js";

// ─── Public API ───────────────────────────────────────────────

export { capture, getVideoMetadata, getDirLayout };
export type { VideoMetadata };

// ─── capture ─────────────────────────────────────────────────

/**
 * Runs a shell command and captures its stdout, stderr, and exit code.
 *
 * @param command - Command string or argv array to run.
 * @param cwd - Optional working directory for the child process.
 * @param commandInput - Optional text to feed to the process's stdin.
 * @returns Tuple of [stdout, stderr, exitCode].
 */
function capture(
  command: string | string[],
  cwd?: StrOrBytesPath | null,
  commandInput?: string | null
): [string, string, number] {
  const argv: string[] =
    typeof command === "string" ? command.split(/\s+/).filter(Boolean) : command;

  const cwdStr =
    cwd == null
      ? undefined
      : cwd instanceof URL
        ? cwd.pathname
        : cwd instanceof Uint8Array
          ? Buffer.from(cwd).toString("utf8")
          : (cwd as string);

  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: cwdStr,
    input: commandInput ?? undefined,
    encoding: "utf8",
    shell: false,
  });

  const stdout: string = result.stdout ?? "";
  const stderr: string = result.stderr ?? "";
  const exitCode: number = result.status ?? 1;
  return [stdout, stderr, exitCode];
}

// ─── VideoMetadata ────────────────────────────────────────────

/**
 * Metadata extracted from a video file.
 * Mirrors Python's TypedDict of the same name.
 */
interface VideoMetadata {
  width: number;
  height: number;
  /** Total number of frames as a string (matches Python output). */
  nb_frames: string;
  /** Duration in seconds formatted to 6 decimal places. */
  duration: string;
  /** Average frame rate expressed as "numerator/denominator". */
  avg_frame_rate: string;
  codec_name: string;
  pix_fmt: string;
}

/**
 * Extracts metadata from a video file using ffprobe.
 * Async because ffprobe I/O is non-blocking.
 *
 * @param pathToVideo - Path to the video file.
 * @returns A {@link VideoMetadata} record.
 */
function getVideoMetadata(
  pathToVideo: string | globalThis.Buffer | URL
): Promise<VideoMetadata> {
  const filePath =
    pathToVideo instanceof URL
      ? pathToVideo.pathname
      : pathToVideo instanceof globalThis.Buffer
        ? pathToVideo.toString("utf8")
        : (pathToVideo as string);

  return new Promise<VideoMetadata>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const stream = data.streams.find((s) => s.codec_type === "video");
      if (!stream) {
        reject(new Error(`No video stream found in: ${filePath}`));
        return;
      }

      const width = stream.width ?? 0;
      const height = stream.height ?? 0;
      const codecName = stream.codec_name ?? "";
      const pixFmt = stream.pix_fmt ?? "";

      // avg_frame_rate comes as "num/den" string from ffprobe
      const avgFrameRate = stream.avg_frame_rate ?? "0/1";

      // Duration: prefer stream duration, fall back to format duration
      let durationSec: number;
      if (stream.duration != null) {
        durationSec = parseFloat(stream.duration as unknown as string);
      } else if (data.format.duration != null) {
        durationSec = data.format.duration;
      } else {
        durationSec = 0;
      }

      // nb_frames: prefer explicit frame count, otherwise derive from duration
      let nbFrames: number;
      if (stream.nb_frames != null) {
        nbFrames = parseInt(stream.nb_frames as unknown as string, 10);
      } else {
        // derive from duration × frame rate
        const [num, den] = avgFrameRate.split("/").map(Number);
        const fps = den !== 0 ? num / den : 0;
        nbFrames = Math.round(durationSec * fps);
      }

      resolve({
        width,
        height,
        nb_frames: String(nbFrames),
        duration: durationSec.toFixed(6),
        avg_frame_rate: avgFrameRate,
        codec_name: codecName,
        pix_fmt: pixFmt,
      });
    });
  });
}

// ─── getDirLayout ─────────────────────────────────────────────

/**
 * Yields paths of all files under `dirpath`, relative to `dirpath`,
 * recursively (depth-first).
 *
 * Faithfully mirrors the Python implementation: when recursing into a
 * subdirectory, paths are yielded relative to that subdirectory (not the
 * original root). This matches the behaviour of the Python source.
 *
 * @param dirpath - Root directory to walk.
 */
function* getDirLayout(dirpath: string): Generator<string, void, unknown> {
  const entries = fs.readdirSync(dirpath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = nodePath.join(dirpath, entry.name);
    if (entry.isDirectory()) {
      // Recurse with the subdirectory as the new root — yielded paths are
      // relative to the subdirectory, matching Python's behaviour.
      yield* getDirLayout(fullPath);
    } else {
      yield nodePath.relative(dirpath, fullPath).replace(/\\/g, "/");
    }
  }
}
