/**
 * AudioSegment — lightweight audio mixing abstraction.
 *
 * Replaces Python's pydub.AudioSegment. Tracks a timeline of audio clips;
 * exports the mixed result to a file via ffmpeg.
 *
 * Python equivalent: pydub.AudioSegment (pydub is not available in Node.js)
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "child_process";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AudioClip {
  /** Path to the audio file on disk. `null` for silent regions. */
  filePath: string | null;
  /** Start position in the output timeline (milliseconds). */
  positionMs: number;
  /** Duration of this clip (milliseconds). `null` = use file duration. */
  durationMs: number | null;
  /** Gain adjustment in dB. */
  gainDb: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Probe the duration of an audio file using ffprobe (synchronous).
 * Returns duration in milliseconds, or 0 on failure.
 */
function probeDurationMs(filePath: string): number {
  const result = spawnSync(
    "ffprobe",
    [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      filePath,
    ],
    { encoding: "utf-8" },
  );

  if (result.status !== 0 || result.stdout === "") {
    return 0;
  }

  try {
    const data = JSON.parse(result.stdout) as {
      format?: { duration?: string };
    };
    const d = parseFloat(data.format?.duration ?? "0");
    return isFinite(d) ? Math.round(d * 1000) : 0;
  } catch {
    return 0;
  }
}

// ─── AudioSegment ─────────────────────────────────────────────────────────────

/**
 * Represents a segment of audio — either silence or loaded from a file.
 *
 * Mirrors the subset of pydub.AudioSegment used by SceneFileWriter:
 *  - `silent()`, `from_file()`
 *  - `.duration_seconds`
 *  - `.append()`, `.overlay()`, `.apply_gain()`
 *  - `.export()`
 */
export class AudioSegment {
  /** Total duration of this segment (milliseconds). */
  private _durationMs: number;

  /** Ordered list of audio clips that make up this segment. */
  private _clips: AudioClip[];

  private constructor(durationMs: number, clips: AudioClip[]) {
    this._durationMs = durationMs;
    this._clips = clips;
  }

  // ── Factory methods ──────────────────────────────────────────────────────

  /**
   * Create a silent segment of the given duration.
   * Python: `AudioSegment.silent(duration_ms)`
   */
  static silent(durationMs: number = 0): AudioSegment {
    return new AudioSegment(Math.max(0, durationMs), []);
  }

  /**
   * Load an audio file into a segment.
   * Python: `AudioSegment.from_file(path)`
   */
  static fromFile(filePath: string): AudioSegment {
    const durationMs = probeDurationMs(filePath);
    const clips: AudioClip[] = [
      { filePath, positionMs: 0, durationMs, gainDb: 0 },
    ];
    return new AudioSegment(durationMs, clips);
  }

  // ── Properties ───────────────────────────────────────────────────────────

  /** Duration in seconds. Python: `segment.duration_seconds` */
  get duration_seconds(): number {
    return this._durationMs / 1000;
  }

  // ── Operations ───────────────────────────────────────────────────────────

  /**
   * Append another segment at the end of this one.
   * Python: `segment.append(other, crossfade=0)`
   */
  append(other: AudioSegment, crossfade: number = 0): AudioSegment {
    // crossfade is not implemented — matches pydub's crossfade=0 behaviour
    void crossfade;

    const offset = this._durationMs;
    const newClips: AudioClip[] = [
      ...this._clips,
      ...other._clips.map((c) => ({
        ...c,
        positionMs: c.positionMs + offset,
      })),
    ];

    // If other has no clips but has duration (i.e. it is pure silence) we still
    // need to extend our duration.
    return new AudioSegment(this._durationMs + other._durationMs, newClips);
  }

  /**
   * Overlay another segment at a given position.
   * Python: `segment.overlay(other, position=..., gain_during_overlay=...)`
   */
  overlay(
    other: AudioSegment,
    options: {
      position?: number;
      gain_during_overlay?: number | null | undefined;
    } = {},
  ): AudioSegment {
    const positionMs = options.position ?? 0;
    const gainDb = options.gain_during_overlay ?? 0;

    const shiftedClips = other._clips.map((c) => ({
      ...c,
      positionMs: c.positionMs + positionMs,
      gainDb: c.gainDb + (gainDb ?? 0),
    }));

    const newDuration = Math.max(
      this._durationMs,
      positionMs + other._durationMs,
    );

    return new AudioSegment(newDuration, [
      ...this._clips,
      ...shiftedClips,
    ]);
  }

  /**
   * Apply a gain adjustment to every clip in this segment.
   * Python: `segment.apply_gain(gain_db)`
   */
  applyGain(gainDb: number): AudioSegment {
    const newClips = this._clips.map((c) => ({
      ...c,
      gainDb: c.gainDb + gainDb,
    }));
    return new AudioSegment(this._durationMs, newClips);
  }

  /**
   * Export this segment to a file via ffmpeg.
   * Python: `segment.export(path, format=..., bitrate=...)`
   */
  export(
    outputPath: string,
    options: { format?: string; bitrate?: string } = {},
  ): void {
    const realClips = this._clips.filter((c) => c.filePath !== null);

    if (realClips.length === 0) {
      // Generate silence via ffmpeg
      const durationSecs = this._durationMs / 1000;
      const result = spawnSync(
        "ffmpeg",
        [
          "-y",
          "-f", "lavfi",
          "-i", `anullsrc=r=44100:cl=stereo:d=${durationSecs}`,
          "-t", String(durationSecs),
          ...(options.bitrate ? ["-b:a", options.bitrate] : []),
          outputPath,
        ],
        { stdio: "pipe" },
      );
      if (result.status !== 0) {
        const stderr = result.stderr?.toString() ?? "";
        throw new Error(`ffmpeg failed to generate silence: ${stderr}`);
      }
      return;
    }

    if (realClips.length === 1 && realClips[0].positionMs === 0 && realClips[0].gainDb === 0) {
      // Simple conversion — no mixing needed
      const clip = realClips[0];
      const result = spawnSync(
        "ffmpeg",
        [
          "-y",
          "-i", clip.filePath!,
          ...(options.bitrate ? ["-b:a", options.bitrate] : []),
          outputPath,
        ],
        { stdio: "pipe" },
      );
      if (result.status !== 0) {
        const stderr = result.stderr?.toString() ?? "";
        throw new Error(`ffmpeg audio conversion failed: ${stderr}`);
      }
      return;
    }

    // Complex mixing with adelay / volume filters
    const filterParts: string[] = [];
    const inputArgs: string[] = [];

    for (let i = 0; i < realClips.length; i++) {
      const clip = realClips[i];
      inputArgs.push("-i", clip.filePath!);

      let filterChain = `[${i}:a]`;
      if (clip.positionMs > 0) {
        filterChain += `adelay=${clip.positionMs}|${clip.positionMs}`;
        filterChain += `[da${i}];[da${i}]`;
      }
      if (clip.gainDb !== 0) {
        filterChain += `volume=${clip.gainDb}dB`;
        filterChain += `[va${i}];[va${i}]`;
      } else if (clip.positionMs > 0) {
        // Already labelled via adelay chain above — noop
      } else {
        filterChain += `anull`;
        filterChain += `[na${i}];[na${i}]`;
      }
      filterParts.push(`[${i}:a]adelay=${clip.positionMs}|${clip.positionMs}[s${i}]`);
    }

    // Simpler approach: write each clip to a temp file, then amix
    const tempDir = os.tmpdir();
    const tempFiles: string[] = [];

    try {
      for (const clip of realClips) {
        const tmpFile = path.join(
          tempDir,
          `manim_audio_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`,
        );

        const delayMs = clip.positionMs;
        const gainDb = clip.gainDb;
        const filterStr = [
          `adelay=${delayMs}|${delayMs}`,
          gainDb !== 0 ? `volume=${gainDb}dB` : null,
        ]
          .filter(Boolean)
          .join(",");

        spawnSync(
          "ffmpeg",
          [
            "-y",
            "-i", clip.filePath!,
            "-af", filterStr || "anull",
            tmpFile,
          ],
          { stdio: "pipe" },
        );
        tempFiles.push(tmpFile);
      }

      // Mix all temp files
      const inputsArgs: string[] = [];
      for (const f of tempFiles) {
        inputsArgs.push("-i", f);
      }

      const result = spawnSync(
        "ffmpeg",
        [
          "-y",
          ...inputsArgs,
          "-filter_complex", `amix=inputs=${tempFiles.length}:duration=longest`,
          ...(options.bitrate ? ["-b:a", options.bitrate] : []),
          outputPath,
        ],
        { stdio: "pipe" },
      );

      if (result.status !== 0) {
        const stderr = result.stderr?.toString() ?? "";
        throw new Error(`ffmpeg audio mixing failed: ${stderr}`);
      }
    } finally {
      // Clean up temp files
      for (const f of tempFiles) {
        try { fs.unlinkSync(f); } catch { /* ignore */ }
      }
    }
  }
}
