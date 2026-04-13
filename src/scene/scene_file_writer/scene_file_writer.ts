/**
 * SceneFileWriter — writes Manim scene animations to video / image files.
 *
 * Replaces Python's PyAV-based implementation with fluent-ffmpeg + sharp.
 * Frame-by-frame video encoding pipes raw RGBA data into an ffmpeg child
 * process.  Audio mixing is handled by AudioSegment (see audio_segment.ts).
 *
 * Python equivalent: manim/scene/scene_file_writer.py
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn, spawnSync, ChildProcess } from "child_process";
import ffmpegFluent from "fluent-ffmpeg";
import sharp from "sharp";
import { Section, DefaultSectionType } from "../section/index.js";
import { AudioSegment } from "./audio_segment.js";
import { composeSrt } from "./subtitle.js";
import type { Subtitle } from "./subtitle.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Raw RGBA pixel data for one video frame (width × height × 4 bytes). */
export type PixelArray = Uint8Array;

/** Write raw RGBA pixel data to a file via sharp. */
async function writePixelDataToFile(
  pixelData: PixelArray,
  width: number,
  height: number,
  outPath: string,
): Promise<void> {
  await sharp(Buffer.from(pixelData), {
    raw: { width, height, channels: 4 },
  }).toFile(outPath);
}

/** A string path — mirrors Python's StrPath. */
export type StrPath = string;

/** Rational frame rate as numerator / denominator. */
export interface FrameRate {
  num: number;
  denom: number;
}

/**
 * Extended configuration for SceneFileWriter.
 *
 * Mirrors the fields from Manim's global config object that this class reads.
 * Callers should supply at minimum `pixelWidth`, `pixelHeight`, `frameRate`,
 * and `mediaDir`; the rest default to sensible values.
 */
export interface SceneFileWriterConfig {
  // ── Core dimensions ──────────────────────────────────────────
  pixelWidth: number;
  pixelHeight: number;
  frameRate: number;

  // ── Paths ────────────────────────────────────────────────────
  mediaDir: string;
  /** Module / source file name (used to structure subdirectories). */
  moduleName?: string;
  /** Explicit output file path (overrides derived path). */
  outputFile?: string | null;
  /** When true, use scene name regardless of outputFile. */
  writeAll?: boolean;

  // ── Output format ────────────────────────────────────────────
  /** e.g. ".mp4" | ".webm" | ".mov" — default ".mp4" */
  movieFileExtension?: string;
  /** Output format string: "mp4" | "webm" | "gif" | "png" — default "mp4" */
  format?: string;

  // ── Encoding ─────────────────────────────────────────────────
  /** Encode with alpha channel (transparent background). */
  transparent?: boolean;

  // ── Image sequence output ────────────────────────────────────
  /** Zero-pad frame numbers to this many digits (0 = no padding). */
  zeroPad?: number;

  // ── Section / segment support ────────────────────────────────
  saveSections?: boolean;

  // ── Cache management ─────────────────────────────────────────
  maxFilesCached?: number;
  flushCache?: boolean;

  // ── Misc ─────────────────────────────────────────────────────
  /**
   * When true, write animations to video files.
   * Equivalent to Manim's `write_to_movie` config flag.
   * Default: false (no video written unless explicitly enabled).
   */
  writeToMovie?: boolean;

  /** Skip all file output (useful for tests / dry runs). */
  dryRun?: boolean;
  logToFile?: boolean;
}

/**
 * Minimal interface that the renderer must satisfy.
 *
 * The renderer tracks how many animations have been played so the file writer
 * can index into `partialMovieFiles`.
 */
export interface SceneFileWriterRenderer {
  numPlays: number;
  getFrame?(): PixelArray;
  getImage?(): PixelArray;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a frames-per-second value to a rational `num/denom` frame rate.
 *
 * Python equivalent: `to_av_frame_rate(fps)`
 */
export function toFfmpegFrameRate(fps: number): FrameRate {
  const epsilon1 = 1e-4;
  const epsilon2 = 0.02;

  if (Number.isInteger(fps)) {
    return { num: fps, denom: 1 };
  }
  if (Math.abs(fps - Math.round(fps)) < epsilon1) {
    return { num: Math.round(fps), denom: 1 };
  }

  const denom = 1001;
  const num = Math.round((fps * denom) / 1000) * 1000;
  if (Math.abs(fps - num / denom) >= epsilon2) {
    throw new Error(`Invalid frame rate: ${fps}`);
  }
  return { num, denom };
}

/**
 * Convert an audio file to a different codec using ffmpeg (synchronous).
 *
 * Python equivalent: `convert_audio(input_path, output_path, codec_name)`
 */
export function convertAudio(
  inputPath: string,
  outputPath: string,
  codecName: string,
): void {
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-acodec", codecName, outputPath],
    { stdio: "pipe" },
  );
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? "";
    throw new Error(`convertAudio failed: ${stderr}`);
  }
}

/** Ensure a directory exists, creating it (and parents) if necessary. */
function guaranteeExistence(dirPath: string): string {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

/** Append `ext` to `filePath` if it does not already end with an extension. */
function addExtensionIfNotPresent(filePath: string, ext: string): string {
  if (path.extname(filePath) === "") {
    return filePath + ext;
  }
  return filePath;
}

/** Insert `_v<timestamp>` before the file extension. */
function addVersionBeforeExtension(filePath: string): string {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, filePath.length - ext.length);
  return `${base}_v${Date.now()}${ext}`;
}

/** Update the access time of `filePath` to now (without touching mtime). */
function modifyAtime(filePath: string): void {
  const now = new Date();
  const mtime = fs.statSync(filePath).mtime;
  fs.utimesSync(filePath, now, mtime);
}

/** Resolve the "resolution directory" name, e.g. `"480p15"`. */
function resolutionDir(config: SceneFileWriterConfig): string {
  return `${config.pixelHeight}p${config.frameRate}`;
}

// ─── SceneFileWriter ─────────────────────────────────────────────────────────

const MANIM_TS_VERSION = "0.1.0";

/**
 * Writes Manim scene animations to video / image files.
 *
 * This class is Manim's internal interface to ffmpeg.  Typical usage:
 *
 * ```typescript
 * const writer = new SceneFileWriter(renderer, "MyScene", config);
 * writer.beginAnimation(true);
 * for each frame:
 *   writer.writeFrame(pixelData);
 * await writer.endAnimation(true);
 * await writer.finish();
 * ```
 */
export class SceneFileWriter {
  /** When true, force the output file name to match the scene name. */
  static forceOutputAsSceneName: boolean = false;

  // ── Dependencies ─────────────────────────────────────────────────────────

  readonly renderer: SceneFileWriterRenderer;

  // ── Config ───────────────────────────────────────────────────────────────

  private readonly _config: SceneFileWriterConfig;

  // ── Paths ────────────────────────────────────────────────────────────────

  outputName!: string;
  imageFilePath!: string;
  movieFilePath!: string;
  gifFilePath!: string;
  sectionsOutputDir!: string;
  partialMovieDirectory!: string;
  partialMovieFilePath!: string;

  // ── State ────────────────────────────────────────────────────────────────

  frameCount: number = 0;
  partialMovieFiles: Array<string | null> = [];
  subcaptions: Subtitle[] = [];
  sections: Section[] = [];
  includesSound: boolean = false;
  audioSegment!: AudioSegment;

  // ── Internal video stream state ──────────────────────────────────────────

  private _ffmpegProcess: ChildProcess | null = null;

  // ─────────────────────────────────────────────────────────────────────────

  constructor(
    renderer: SceneFileWriterRenderer,
    sceneName: string,
    config: SceneFileWriterConfig,
  ) {
    this.renderer = renderer;
    this._config = config;

    this.initOutputDirectories(sceneName);
    this.initAudio();
    this.frameCount = 0;
    this.partialMovieFiles = [];
    this.subcaptions = [];
    this.sections = [];

    // First section is created automatically for convenience.
    this.nextSection("autocreated", DefaultSectionType.NORMAL, false);
  }

  // ── Config helpers ────────────────────────────────────────────────────────

  private _writeToMovie(): boolean {
    return this._config.writeToMovie !== false &&
      this._config.format !== "png" &&
      !this._config.dryRun;
  }

  private _isGifFormat(): boolean {
    const ext = this._config.movieFileExtension ?? ".mp4";
    const fmt = this._config.format ?? "";
    return ext === ".gif" || fmt === "gif";
  }

  private _isPngFormat(): boolean {
    const fmt = this._config.format ?? "";
    return fmt === "png";
  }

  private _getMovieFileExtension(): string {
    return this._config.movieFileExtension ?? ".mp4";
  }

  // ── Directory initialisation ──────────────────────────────────────────────

  /**
   * Initialise output directories from config.
   * Python: `SceneFileWriter.init_output_directories(scene_name)`
   */
  initOutputDirectories(sceneName: string): void {
    if (this._config.dryRun) return;

    const moduleName = this._config.moduleName ?? "";
    const ext = this._getMovieFileExtension();

    if (
      SceneFileWriter.forceOutputAsSceneName ||
      !this._config.outputFile ||
      this._config.writeAll
    ) {
      this.outputName = sceneName;
    } else {
      this.outputName = this._config.outputFile!;
    }

    const mediaDir = this._config.mediaDir;

    if (mediaDir) {
      const imageDir = guaranteeExistence(
        path.join(mediaDir, "images", moduleName, sceneName),
      );
      this.imageFilePath = path.join(
        imageDir,
        addExtensionIfNotPresent(this.outputName, ".png"),
      );
    }

    if (this._writeToMovie()) {
      const res = resolutionDir(this._config);
      const videoDir = guaranteeExistence(
        path.join(mediaDir, "videos", moduleName, res),
      );
      this.movieFilePath = path.join(
        videoDir,
        addExtensionIfNotPresent(this.outputName, ext),
      );

      this.sectionsOutputDir = "";
      if (this._config.saveSections) {
        this.sectionsOutputDir = guaranteeExistence(
          path.join(mediaDir, "videos", moduleName, res, "sections"),
        );
      }

      if (this._isGifFormat()) {
        let gifName = addExtensionIfNotPresent(this.outputName, ".gif");
        if (!this._config.outputFile) {
          gifName = addVersionBeforeExtension(gifName);
        }
        this.gifFilePath = path.join(videoDir, gifName);
      }

      this.partialMovieDirectory = guaranteeExistence(
        path.join(mediaDir, "videos", moduleName, res, "partial_movie_files", sceneName),
      );
    }
  }

  // ── Section management ────────────────────────────────────────────────────

  /** Delete current section if it is empty. */
  finishLastSection(): void {
    if (this.sections.length > 0 && this.sections[this.sections.length - 1].isEmpty()) {
      this.sections.pop();
    }
  }

  /**
   * Create a section boundary at this point.
   * Python: `SceneFileWriter.next_section(name, type_, skip_animations)`
   */
  nextSection(name: string, type_: string, skipAnimations: boolean): void {
    this.finishLastSection();

    let sectionVideo: string | null = null;
    if (
      !this._config.dryRun &&
      this._writeToMovie() &&
      this._config.saveSections &&
      !skipAnimations
    ) {
      const idx = String(this.sections.length).padStart(4, "0");
      sectionVideo = `${this.outputName}_${idx}_${name}${this._getMovieFileExtension()}`;
    }

    this.sections.push(new Section(type_, sectionVideo, name, skipAnimations));
  }

  /**
   * Add a new partial movie file (or null placeholder) to the tracking list.
   * Python: `SceneFileWriter.add_partial_movie_file(hash_animation)`
   */
  addPartialMovieFile(hashAnimation: string | null): void {
    if (!this.partialMovieDirectory || !this._writeToMovie()) return;

    if (hashAnimation === null) {
      this.partialMovieFiles.push(null);
      this.sections[this.sections.length - 1].partialMovieFiles.push(null);
    } else {
      const newFile = path.join(
        this.partialMovieDirectory,
        `${hashAnimation}${this._getMovieFileExtension()}`,
      );
      this.partialMovieFiles.push(newFile);
      this.sections[this.sections.length - 1].partialMovieFiles.push(newFile);
    }
  }

  /**
   * Get the name of the resolution sub-directory, e.g. `"480p15"`.
   * Python: `SceneFileWriter.get_resolution_directory()`
   */
  getResolutionDirectory(): string {
    return resolutionDir(this._config);
  }

  // ── Audio ─────────────────────────────────────────────────────────────────

  /** Prepare the writer for audio. Python: `SceneFileWriter.init_audio()` */
  initAudio(): void {
    this.includesSound = false;
  }

  /** Create an empty silent audio segment. */
  createAudioSegment(): void {
    this.audioSegment = AudioSegment.silent();
  }

  /**
   * Add an audio segment at a given timestamp.
   * Python: `SceneFileWriter.add_audio_segment(new_segment, time, gain_to_background)`
   */
  addAudioSegment(
    newSegment: AudioSegment,
    time?: number | null,
    gainToBackground?: number | null,
  ): void {
    if (!this.includesSound) {
      this.includesSound = true;
      this.createAudioSegment();
    }

    const segment = this.audioSegment;
    const currEnd = segment.duration_seconds;
    const t = time ?? currEnd;

    if (t < 0) {
      throw new Error("Adding sound at timestamp < 0");
    }

    const newEnd = t + newSegment.duration_seconds;
    const diff = newEnd - currEnd;

    let extended = segment;
    if (diff > 0) {
      extended = segment.append(
        AudioSegment.silent(Math.ceil(diff * 1000)),
        0,
      );
    }

    this.audioSegment = extended.overlay(newSegment, {
      position: Math.round(1000 * t),
      gain_during_overlay: gainToBackground,
    });
  }

  /**
   * Add sound from a file at a given timestamp.
   * Python: `SceneFileWriter.add_sound(sound_file, time, gain, **kwargs)`
   */
  async addSound(
    soundFile: StrPath,
    time?: number | null,
    gain?: number | null,
    options: { gainToBackground?: number | null } = {},
  ): Promise<void> {
    const ext = path.extname(soundFile).toLowerCase();
    let segment: AudioSegment;

    if (ext === ".wav" || ext === ".raw") {
      segment = AudioSegment.fromFile(soundFile);
    } else {
      // Convert to wav first
      const tmpWav = path.join(
        os.tmpdir(),
        `manim_audio_${Date.now()}.wav`,
      );
      convertAudio(soundFile, tmpWav, "pcm_s16le");
      segment = AudioSegment.fromFile(tmpWav);
      console.info(`Automatically converted ${soundFile} to .wav`);
      try { fs.unlinkSync(tmpWav); } catch { /* ignore */ }
    }

    if (gain != null) {
      segment = segment.applyGain(gain);
    }

    this.addAudioSegment(segment, time, options.gainToBackground);
  }

  // ── Animation stream control ──────────────────────────────────────────────

  /**
   * Begin streaming a partial animation to file.
   * Python: `SceneFileWriter.begin_animation(allow_write, file_path)`
   */
  beginAnimation(allowWrite: boolean = false, filePath?: StrPath | null): void {
    if (this._writeToMovie() && allowWrite) {
      this.openPartialMovieStream(filePath ?? undefined);
    }
  }

  /**
   * Stop streaming a partial animation.
   * Python: `SceneFileWriter.end_animation(allow_write)`
   */
  async endAnimation(allowWrite: boolean = false): Promise<void> {
    if (this._writeToMovie() && allowWrite) {
      await this.closePartialMovieStream();
    }
  }

  // ── Frame writing ─────────────────────────────────────────────────────────

  /**
   * Write a frame (or multiple copies) to the active stream.
   * Python: `SceneFileWriter.write_frame(frame_or_renderer, num_frames)`
   */
  async writeFrame(
    frameOrRenderer: PixelArray | SceneFileWriterRenderer,
    numFrames: number = 1,
  ): Promise<void> {
    if (this._writeToMovie()) {
      let frame: PixelArray;
      if (frameOrRenderer instanceof Uint8Array) {
        frame = frameOrRenderer;
      } else {
        frame = frameOrRenderer.getFrame?.() ?? new Uint8Array(0);
      }

      if (this._ffmpegProcess?.stdin?.writable) {
        for (let i = 0; i < numFrames; i++) {
          await new Promise<void>((resolve, reject) => {
            this._ffmpegProcess!.stdin!.write(frame, (err) => {
              if (err) reject(err); else resolve();
            });
          });
        }
      }
    }

    if (this._isPngFormat() && !this._config.dryRun) {
      let pixelData: PixelArray;
      if (frameOrRenderer instanceof Uint8Array) {
        pixelData = frameOrRenderer;
      } else {
        pixelData = frameOrRenderer.getImage?.() ?? new Uint8Array(0);
      }

      const targetDir = path.join(
        path.dirname(this.imageFilePath),
        path.basename(this.imageFilePath, path.extname(this.imageFilePath)),
      );
      const ext = path.extname(this.imageFilePath);
      await this.outputImage(pixelData, targetDir, ext, this._config.zeroPad ?? 0);
    }
  }

  /**
   * Save a single frame as an image file.
   * Python: `SceneFileWriter.output_image(image, target_dir, ext, zero_pad)`
   */
  async outputImage(
    pixelData: PixelArray,
    targetDir: string,
    ext: string,
    zeroPad: number,
  ): Promise<void> {
    const frameSuffix = zeroPad > 0
      ? String(this.frameCount).padStart(zeroPad, "0")
      : String(this.frameCount);

    const outPath = `${targetDir}${frameSuffix}${ext}`;

    await writePixelDataToFile(
      pixelData, this._config.pixelWidth, this._config.pixelHeight, outPath,
    );

    this.frameCount++;
  }

  /**
   * Save a still image to the default image directory.
   * Python: `SceneFileWriter.save_image(image)`
   */
  async saveImage(pixelData: PixelArray): Promise<void> {
    if (this._config.dryRun) return;

    let targetPath = this.imageFilePath;
    if (!this._config.outputFile) {
      targetPath = addVersionBeforeExtension(targetPath);
      this.imageFilePath = targetPath;
    }

    await writePixelDataToFile(
      pixelData, this._config.pixelWidth, this._config.pixelHeight, targetPath,
    );

    this.printFileReadyMessage(targetPath);
  }

  // ── Partial movie stream (frame-by-frame encoding) ────────────────────────

  /**
   * Open an ffmpeg child process to receive raw RGBA frames via stdin.
   * Python: `SceneFileWriter.open_partial_movie_stream(file_path)`
   */
  openPartialMovieStream(filePath?: StrPath): void {
    const fp =
      filePath ??
      (this.partialMovieFiles[this.renderer.numPlays] ?? undefined);

    if (fp == null) return;

    this.partialMovieFilePath = fp;

    const { num, denom } = toFfmpegFrameRate(this._config.frameRate);
    const fps = `${num}/${denom}`;
    const w = this._config.pixelWidth;
    const h = this._config.pixelHeight;
    const ext = this._getMovieFileExtension();

    let codec = "libx264";
    let pixFmt = "yuv420p";
    const extraArgs: string[] = [];

    if (ext === ".webm") {
      codec = "libvpx-vp9";
      extraArgs.push("-auto-alt-ref", "1");
      if (this._config.transparent) {
        pixFmt = "yuva420p";
      }
    } else if (this._config.transparent) {
      codec = "qtrle";
      pixFmt = "argb";
    }

    const args = [
      "-y",
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "-s", `${w}x${h}`,
      "-r", fps,
      "-i", "pipe:0",
      "-vcodec", codec,
      "-pix_fmt", pixFmt,
      "-crf", "23",
      "-an",
      ...extraArgs,
      fp,
    ];

    this._ffmpegProcess = spawn("ffmpeg", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this._ffmpegProcess.on("error", (err: Error) => {
      console.error(`ffmpeg error: ${err.message}`);
    });
  }

  /**
   * Close the active ffmpeg stream and wait for it to finish.
   * Python: `SceneFileWriter.close_partial_movie_stream()`
   */
  async closePartialMovieStream(): Promise<void> {
    if (!this._ffmpegProcess) return;

    const proc = this._ffmpegProcess;
    this._ffmpegProcess = null;

    await new Promise<void>((resolve, reject) => {
      proc.stdin?.end();
      proc.on("close", (code: number | null) => {
        if (code !== 0 && code !== null) {
          const msg = `ffmpeg exited with code ${code} while writing '${this.partialMovieFilePath}'`;
          console.warn(msg);
        }
        console.info(
          `Animation ${this.renderer.numPlays}: Partial movie file written in '${this.partialMovieFilePath}'`,
        );
        resolve();
      });
      proc.on("error", reject);
    });
  }

  // ── Cache management ──────────────────────────────────────────────────────

  /**
   * Check whether a partial movie for the given hash already exists.
   * Python: `SceneFileWriter.is_already_cached(hash_invocation)`
   */
  isAlreadyCached(hashInvocation: string): boolean {
    if (!this.partialMovieDirectory || !this._writeToMovie()) return false;

    const p = path.join(
      this.partialMovieDirectory,
      `${hashInvocation}${this._getMovieFileExtension()}`,
    );
    return fs.existsSync(p);
  }

  // ── Combining partial files ────────────────────────────────────────────────

  /**
   * Concatenate a list of partial movie files into a single output file.
   * Supports GIF creation and optional audio.
   *
   * Python: `SceneFileWriter.combine_files(...)`
   */
  async combineFiles(
    inputFiles: string[],
    outputFile: string,
    createGif: boolean = false,
    includesSound: boolean = false,
  ): Promise<void> {
    const fileListPath = path.join(
      this.partialMovieDirectory,
      "partial_movie_file_list.txt",
    );

    console.debug(
      `Partial movie files to combine (${inputFiles.length} files): ${inputFiles.slice(0, 5).join(", ")}`,
    );

    const lines = ["# This file is used internally by FFMPEG.\n"];
    for (const fp of inputFiles) {
      lines.push(`file 'file:${fp.replace(/\\/g, "/")}'\n`);
    }
    fs.writeFileSync(fileListPath, lines.join(""), "utf-8");

    return new Promise((resolve, reject) => {
      let cmd = ffmpegFluent()
        .input(fileListPath)
        .inputOptions(["-f", "concat", "-safe", "0"]);

      if (!includesSound) {
        cmd = cmd.noAudio();
      }

      if (createGif) {
        // Two-pass palette-based GIF encoding
        cmd = cmd.videoFilters(
          "split[s0][s1];" +
            "[s0]palettegen=stats_mode=diff[p];" +
            "[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
        );
      } else {
        cmd = cmd.videoCodec("copy");
        if (this._config.transparent && this._getMovieFileExtension() === ".webm") {
          cmd = cmd.outputOptions(["-pix_fmt yuva420p"]);
        }
      }

      cmd
        .outputOptions([`-metadata comment=Rendered with Manim Community v${MANIM_TS_VERSION}`])
        .output(outputFile)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });
  }

  /**
   * Combine all partial movie files into the final scene video.
   * Python: `SceneFileWriter.combine_to_movie()`
   */
  async combineToMovie(): Promise<void> {
    const partialFiles = this.partialMovieFiles.filter(
      (f): f is string => f !== null,
    );

    let moviePath = this.movieFilePath;
    if (this._isGifFormat()) {
      moviePath = this.gifFilePath;
    }

    if (partialFiles.length === 0) {
      console.info("No animations are contained in this scene.");
      return;
    }

    console.info("Combining to Movie file.");
    await this.combineFiles(
      partialFiles,
      moviePath,
      this._isGifFormat(),
      this.includesSound,
    );

    // Mix in audio if present
    if (this.includesSound && this._config.format !== "gif") {
      const soundFilePath = moviePath.replace(/\.[^.]+$/, ".wav");
      this.addAudioSegment(AudioSegment.silent(0));
      this.audioSegment.export(soundFilePath, { format: "wav", bitrate: "312k" });

      let finalSoundPath = soundFilePath;

      if (this._getMovieFileExtension() === ".webm") {
        const oggPath = soundFilePath.replace(/\.wav$/, ".ogg");
        convertAudio(soundFilePath, oggPath, "libvorbis");
        finalSoundPath = oggPath;
      } else if (this._getMovieFileExtension() === ".mp4") {
        const aacPath = soundFilePath.replace(/\.wav$/, ".aac");
        convertAudio(soundFilePath, aacPath, "aac");
        finalSoundPath = aacPath;
      }

      // Mux video + audio into a temp file then replace
      const tempPath = moviePath.replace(
        /(\.[^.]+)$/,
        `_temp$1`,
      );

      await new Promise<void>((resolve, reject) => {
        ffmpegFluent()
          .input(moviePath)
          .input(finalSoundPath)
          .outputOptions([
            "-shortest",
            `-metadata comment=Rendered with Manim Community v${MANIM_TS_VERSION}`,
          ])
          .output(tempPath)
          .on("end", () => resolve())
          .on("error", (err: Error) => reject(err))
          .run();
      });

      fs.renameSync(tempPath, moviePath);
      try { await fs.promises.unlink(finalSoundPath); } catch { /* ignore */ }
    }

    this.printFileReadyMessage(moviePath);

    if (this._writeToMovie()) {
      for (const fp of partialFiles) {
        modifyAtime(fp);
      }
    }
  }

  /**
   * Concatenate partial files for each section that has a video path.
   * Python: `SceneFileWriter.combine_to_section_videos()`
   */
  async combineToSectionVideos(): Promise<void> {
    this.finishLastSection();

    const sectionsIndex: Record<string, unknown>[] = [];

    for (const section of this.sections) {
      if (section.video !== null) {
        console.info(`Combining partial files for section '${section.name}'`);
        await this.combineFiles(
          section.getCleanPartialMovieFiles(),
          path.join(this.sectionsOutputDir, section.video),
        );
        sectionsIndex.push(await section.getDict(this.sectionsOutputDir));
      }
    }

    const indexPath = path.join(this.sectionsOutputDir, `${this.outputName}.json`);
    fs.writeFileSync(indexPath, JSON.stringify(sectionsIndex, null, 4), "utf-8");
  }

  // ── Cache cleanup ─────────────────────────────────────────────────────────

  /**
   * Remove the oldest cached partial movie files when the cache is over limit.
   * Python: `SceneFileWriter.clean_cache()`
   */
  cleanCache(): void {
    if (!this.partialMovieDirectory) return;

    const entries = fs
      .readdirSync(this.partialMovieDirectory)
      .filter((f) => f !== "partial_movie_file_list.txt")
      .map((f) => path.join(this.partialMovieDirectory, f));

    const maxFiles = this._config.maxFilesCached ?? 500;
    if (entries.length <= maxFiles) return;

    const toDelete = entries.length - maxFiles;
    const sorted = entries.sort(
      (a, b) => fs.statSync(a).atime.getTime() - fs.statSync(b).atime.getTime(),
    );

    for (let i = 0; i < toDelete; i++) {
      try { fs.unlinkSync(sorted[i]); } catch { /* ignore */ }
    }

    console.info(
      `The partial movie directory is full (> ${maxFiles} files). ` +
        `Removed ${toDelete} oldest file(s). ` +
        `You can change this behaviour by setting maxFilesCached in config.`,
    );
  }

  /**
   * Delete all cached partial movie files.
   * Python: `SceneFileWriter.flush_cache_directory()`
   */
  flushCacheDirectory(): void {
    if (!this.partialMovieDirectory) return;

    const entries = fs
      .readdirSync(this.partialMovieDirectory)
      .filter((f) => f !== "partial_movie_file_list.txt")
      .map((f) => path.join(this.partialMovieDirectory, f));

    for (const f of entries) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }

    console.info(
      `Cache flushed. ${entries.length} file(s) deleted in ${this.partialMovieDirectory}.`,
    );
  }

  // ── Subcaptions ───────────────────────────────────────────────────────────

  /**
   * Write the SRT subtitle file for collected subcaptions.
   * Python: `SceneFileWriter.write_subcaption_file()`
   */
  writeSubcaptionFile(): void {
    if (!this._config.outputFile) return;

    const srtPath = this._config.outputFile.replace(/\.[^.]+$/, ".srt");
    const content = composeSrt(this.subcaptions);
    fs.writeFileSync(srtPath, content, "utf-8");

    console.info(`Subcaption file has been written as ${srtPath}`);
  }

  // ── Finish ────────────────────────────────────────────────────────────────

  /**
   * Finalize output — combine partial files, clean cache, write subcaptions.
   * Python: `SceneFileWriter.finish()`
   */
  async finish(): Promise<void> {
    if (this._writeToMovie()) {
      await this.combineToMovie();
      if (this._config.saveSections) {
        await this.combineToSectionVideos();
      }
      if (this._config.flushCache) {
        this.flushCacheDirectory();
      } else {
        this.cleanCache();
      }
    } else if (this._isPngFormat() && !this._config.dryRun) {
      const targetDir = path.join(
        path.dirname(this.imageFilePath),
        path.basename(this.imageFilePath, path.extname(this.imageFilePath)),
      );
      console.info(`\n${this.frameCount} images ready at ${targetDir}\n`);
    }

    if (this.subcaptions.length > 0) {
      this.writeSubcaptionFile();
    }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Print (log) the "File ready" message.
   * Python: `SceneFileWriter.print_file_ready_message(file_path)`
   */
  printFileReadyMessage(filePath: StrPath): void {
    if (this._config.outputFile !== undefined) {
      // Mirror Python: config["output_file"] = file_path
      (this._config as { outputFile?: string }).outputFile = filePath;
    }
    console.info(`\nFile ready at '${filePath}'\n`);
  }
}
