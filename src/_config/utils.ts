/**
 * ManimConfig and ManimFrame implementations.
 * TypeScript port of manim/_config/utils.py.
 *
 * Provides the global configuration class, INI-based config parser,
 * and a read-only frame-dimension view.
 */

import * as fs from "fs";
import * as nodePath from "path";
import * as os from "os";
import { fileURLToPath } from "url";
import type { IColor, ManimConfig as IManimConfig } from "../core/types.js";
import type { Point3D } from "../core/types.js";
import { Color } from "../core/color/index.js";
import { QUALITIES, RendererType } from "../constants/index.js";
import { TexTemplate } from "../utils/tex/index.js";
import { np } from "../core/math/index.js";

// ─── Quality presets (compatible with IManimConfig interface) ─────────────────

export const QUALITY_PRESETS = {
  low: { pixelWidth: 854, pixelHeight: 480, frameRate: 15 },
  medium: { pixelWidth: 1280, pixelHeight: 720, frameRate: 30 },
  high: { pixelWidth: 1920, pixelHeight: 1080, frameRate: 60 },
  fourk: { pixelWidth: 3840, pixelHeight: 2160, frameRate: 60 },
} as const satisfies Record<string, { pixelWidth: number; pixelHeight: number; frameRate: number }>;

// ─── Local type aliases ───────────────────────────────────────────────────────

type QualityValue = "low" | "medium" | "high" | "fourk";
type VerbosityLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
type ProgressBarMode = "none" | "display" | "leave";
type MovieExtension = ".mp4" | ".mov" | ".webm";
type FormatType = "png" | "gif" | "mp4" | "mov" | "webm" | null;
type WindowSize = "default" | [number, number];

// ─── INI parser helpers ───────────────────────────────────────────────────────

function parseIniBoolean(val: string | undefined, fallback = false): boolean {
  if (val === undefined || val === null) return fallback;
  return ["true", "yes", "1", "on"].includes(val.toLowerCase());
}

function parseIniInt(val: string | undefined, fallback?: number): number {
  if (val === undefined || val === null) {
    if (fallback !== undefined) return fallback;
    throw new Error("Required int config value is missing");
  }
  const n = parseInt(val, 10);
  if (isNaN(n)) throw new Error(`Invalid int: ${val}`);
  return n;
}

function parseIniFloat(val: string | undefined, fallback?: number): number {
  if (val === undefined || val === null) {
    if (fallback !== undefined) return fallback;
    throw new Error("Required float config value is missing");
  }
  const f = parseFloat(val);
  if (isNaN(f)) throw new Error(`Invalid float: ${val}`);
  return f;
}

function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "DEFAULT";
  result[currentSection] = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) result[currentSection] = {};
      continue;
    }
    const kvMatch = line.match(/^([^=:]+)[=:](.*)$/);
    if (kvMatch) {
      result[currentSection][kvMatch[1].trim()] = kvMatch[2].trim();
    }
  }
  return result;
}

// ─── Config file paths ────────────────────────────────────────────────────────

/** Returns [library-wide, user-wide, folder-wide] config file paths. */
export function configFilePaths(): string[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = nodePath.dirname(__filename);
  const libraryWide = nodePath.resolve(__dirname, "default.cfg");
  const userWide =
    process.platform === "win32"
      ? nodePath.join(os.homedir(), "AppData", "Roaming", "Manim", "manim.cfg")
      : nodePath.join(os.homedir(), ".config", "manim", "manim.cfg");
  const folderWide = nodePath.join(process.cwd(), "manim.cfg");
  return [libraryWide, userWide, folderWide];
}

// ─── Parser types ─────────────────────────────────────────────────────────────

/** A parsed INI config: section → key → value (all strings). */
export interface ConfigParser {
  [section: string]: Record<string, string>;
}

/**
 * Create a ConfigParser with built-in Manim defaults, optionally merging
 * a custom .cfg file on top.
 */
export function makeConfigParser(customFile?: string): ConfigParser {
  const defaults: ConfigParser = {
    logger: {
      logging_keyword: "DEBUG",
      log_to_file: "False",
    },
    CLI: {
      verbosity: "WARNING",
      quality: "high_quality",
      pixel_width: "1920",
      pixel_height: "1080",
      frame_rate: "60",
      frame_width: "14.222",
      frame_height: "8.0",
      background_color: "#000000",
      background_opacity: "1.0",
      media_dir: "./media",
      log_dir: "{media_dir}/logs",
      video_dir: "{media_dir}/videos/{module_name}/{quality}",
      sections_dir: "{video_dir}/sections",
      images_dir: "{media_dir}/images/{module_name}",
      text_dir: "{media_dir}/texts",
      tex_dir: "{media_dir}/Tex",
      partial_movie_dir: "{video_dir}/partial_movie_files/{scene_name}",
      assets_dir: "",
      input_file: "",
      output_file: "",
      movie_file_extension: ".mp4",
      notify_outdated_version: "True",
      write_to_movie: "False",
      save_last_frame: "False",
      write_all: "False",
      save_pngs: "False",
      save_as_gif: "False",
      save_sections: "False",
      preview: "False",
      show_in_file_browser: "False",
      log_to_file: "False",
      disable_caching: "False",
      disable_caching_warning: "False",
      flush_cache: "False",
      custom_folders: "False",
      enable_gui: "False",
      fullscreen: "False",
      use_projection_fill_shaders: "False",
      use_projection_stroke_shaders: "False",
      enable_wireframe: "False",
      force_window: "False",
      no_latex_cleanup: "False",
      dry_run: "False",
      from_animation_number: "0",
      upto_animation_number: "-1",
      max_files_cached: "100",
      window_monitor: "0",
      zero_pad: "4",
      seed: "0",
      plugins: "",
      renderer: "cairo",
      window_position: "UR",
      window_size: "default",
      gui_location: "0,0",
      progress_bar: "display",
      preview_command: "",
      tex_template_file: "",
    },
    ffmpeg: {
      loglevel: "ERROR",
    },
    jupyter: {
      media_embed: "False",
      media_width: "100%",
    },
    CLI_CTX: {},
    custom_folders: {},
  };

  // Attempt to load library-wide default.cfg
  const paths = configFilePaths();
  const libraryWide = paths[0];
  if (fs.existsSync(libraryWide)) {
    try {
      const content = fs.readFileSync(libraryWide, "utf-8");
      const parsed = parseIni(content);
      for (const [section, values] of Object.entries(parsed)) {
        if (!defaults[section]) defaults[section] = {};
        Object.assign(defaults[section], values);
      }
    } catch {
      // Silently ignore read errors
    }
  }

  // Load user-wide config if it exists
  const userWide = paths[1];
  if (fs.existsSync(userWide)) {
    try {
      const content = fs.readFileSync(userWide, "utf-8");
      const parsed = parseIni(content);
      for (const [section, values] of Object.entries(parsed)) {
        if (!defaults[section]) defaults[section] = {};
        Object.assign(defaults[section], values);
      }
    } catch {
      // Silently ignore read errors
    }
  }

  // Load custom/folder-wide file
  const extraFile = customFile ?? paths[2];
  if (extraFile && fs.existsSync(extraFile)) {
    try {
      const content = fs.readFileSync(extraFile, "utf-8");
      const parsed = parseIni(content);
      for (const [section, values] of Object.entries(parsed)) {
        if (!defaults[section]) defaults[section] = {};
        Object.assign(defaults[section], values);
      }
    } catch {
      // Silently ignore read errors
    }
  }

  return defaults;
}

// ─── Quality helpers ──────────────────────────────────────────────────────────

/**
 * Resolve a quality flag string (e.g. "h", "l") to a quality name
 * (e.g. "high_quality", "low_quality") by checking QUALITIES flags.
 * Returns the original value if no flag matches.
 */
export function _determineQuality(qual: string | null | undefined): string | null {
  if (qual == null) return null;
  for (const [quality, values] of Object.entries(QUALITIES)) {
    if (values.flag !== null && values.flag === qual) {
      return quality;
    }
  }
  return qual;
}

/** Maps full Python quality names → simplified TS quality values. */
const QUALITY_NAME_MAP: Record<string, QualityValue> = {
  low_quality: "low",
  example_quality: "low",
  medium_quality: "medium",
  high_quality: "high",
  production_quality: "fourk",
  fourk_quality: "fourk",
};

// ─── ManimConfig storage key map ──────────────────────────────────────────────

/** Internal storage record type — all values may be null before first population. */
interface ConfigStorage {
  assetsDir: string;
  mediaDir: string;
  logDir: string;
  videoDir: string;
  sectionsDir: string;
  imagesDir: string;
  textDir: string;
  texDir: string;
  partialMovieDir: string;
  inputFile: string;
  outputFile: string;
  texTemplateFile: string | null;
  pixelWidth: number;
  pixelHeight: number;
  frameRate: number;
  frameWidth: number;
  frameHeight: number;
  backgroundColor: IColor;
  backgroundOpacity: number;
  preview: boolean;
  showInFileBrowser: boolean;
  logToFile: boolean;
  notifyOutdatedVersion: boolean;
  writeToMovie: boolean;
  saveLastFrame: boolean;
  writeAll: boolean;
  savePngs: boolean;
  saveAsGif: boolean;
  saveSections: boolean;
  disableCaching: boolean;
  disableCachingWarning: boolean;
  flushCache: boolean;
  customFolders: boolean;
  enableGui: boolean;
  fullscreen: boolean;
  useProjectionFillShaders: boolean;
  useProjectionStrokeShaders: boolean;
  enableWireframe: boolean;
  forceWindow: boolean;
  noLatexCleanup: boolean;
  dryRun: boolean;
  fromAnimationNumber: number;
  uptoAnimationNumber: number;
  maxFilesCached: number;
  windowMonitor: number;
  zeroPad: number;
  seed: number | null;
  verbosity: VerbosityLevel;
  progressBar: ProgressBarMode;
  ffmpegLoglevel: VerbosityLevel;
  movieFileExtension: MovieExtension;
  format: FormatType;
  previewCommand: string;
  renderer: RendererType;
  windowPosition: string;
  windowSize: WindowSize;
  guiLocation: [number, number];
  plugins: string[];
  sceneNames: string[];
  quality: QualityValue;
  mediaEmbed: boolean | null;
  mediaWidth: string;
}

// ─── ManimConfig ──────────────────────────────────────────────────────────────

/**
 * Dict-like class storing all Manim config options.
 * TypeScript port of Python's ManimConfig (manim/_config/utils.py).
 *
 * Implements the simplified IManimConfig interface from core/types.ts,
 * and adds the full Python-faithful API on top.
 */
export class ManimConfig implements IManimConfig {
  private _d: ConfigStorage;
  private _texTemplate: TexTemplate | null = null;
  /** Saved parser reference — used by digestArgs for custom_folders section. */
  private _parser: ConfigParser | null = null;

  constructor() {
    this._d = {
      assetsDir: "",
      mediaDir: "./media",
      logDir: "{media_dir}/logs",
      videoDir: "{media_dir}/videos/{module_name}/{quality}",
      sectionsDir: "{video_dir}/sections",
      imagesDir: "{media_dir}/images/{module_name}",
      textDir: "{media_dir}/texts",
      texDir: "{media_dir}/Tex",
      partialMovieDir: "{video_dir}/partial_movie_files/{scene_name}",
      inputFile: "",
      outputFile: "",
      texTemplateFile: null,
      pixelWidth: 1920,
      pixelHeight: 1080,
      frameRate: 60,
      frameWidth: 14.222,
      frameHeight: 8.0,
      backgroundColor: Color.fromHex("#000000"),
      backgroundOpacity: 1.0,
      preview: false,
      showInFileBrowser: false,
      logToFile: false,
      notifyOutdatedVersion: true,
      writeToMovie: false,
      saveLastFrame: false,
      writeAll: false,
      savePngs: false,
      saveAsGif: false,
      saveSections: false,
      disableCaching: false,
      disableCachingWarning: false,
      flushCache: false,
      customFolders: false,
      enableGui: false,
      fullscreen: false,
      useProjectionFillShaders: false,
      useProjectionStrokeShaders: false,
      enableWireframe: false,
      forceWindow: false,
      noLatexCleanup: false,
      dryRun: false,
      fromAnimationNumber: 0,
      uptoAnimationNumber: -1,
      maxFilesCached: 100,
      windowMonitor: 0,
      zeroPad: 4,
      seed: null,
      verbosity: "WARNING",
      progressBar: "display",
      ffmpegLoglevel: "ERROR",
      movieFileExtension: ".mp4",
      format: null,
      previewCommand: "",
      renderer: RendererType.CAIRO,
      windowPosition: "UR",
      windowSize: "default",
      guiLocation: [0, 0],
      plugins: [],
      sceneNames: [],
      quality: "high",
      mediaEmbed: null,
      mediaWidth: "100%",
    };
  }

  // ─── Validation helpers ───────────────────────────────────────────────────

  private _setFromList<T>(key: keyof ConfigStorage, val: T, values: T[]): void {
    if ((values as unknown[]).includes(val)) {
      (this._d as unknown as Record<string, unknown>)[key] = val;
    } else {
      throw new Error(
        `attempted to set ${key} to ${String(val)}; must be in ${JSON.stringify(values)}`,
      );
    }
  }

  private _setBoolean(key: keyof ConfigStorage, val: unknown): void {
    if (val === true || val === false) {
      (this._d as unknown as Record<string, unknown>)[key] = val;
    } else {
      throw new Error(`${key} must be boolean`);
    }
  }

  private _setStr(key: keyof ConfigStorage, val: unknown): void {
    if (typeof val === "string") {
      (this._d as unknown as Record<string, unknown>)[key] = val;
    } else if (!val) {
      (this._d as unknown as Record<string, unknown>)[key] = "";
    } else {
      throw new Error(`${key} must be string or falsy`);
    }
  }

  private _setBetween(
    key: keyof ConfigStorage,
    val: number,
    lo: number,
    hi: number,
  ): void {
    if (lo <= val && val <= hi) {
      (this._d as unknown as Record<string, unknown>)[key] = val;
    } else {
      throw new RangeError(`${key} must be ${lo} <= ${key} <= ${hi}`);
    }
  }

  private _setIntBetween(
    key: keyof ConfigStorage,
    val: number,
    lo: number,
    hi: number,
  ): void {
    if (Number.isInteger(val) && lo <= val && val <= hi) {
      (this._d as unknown as Record<string, unknown>)[key] = val;
    } else {
      throw new RangeError(
        `${key} must be an integer such that ${lo} <= ${key} <= ${hi}`,
      );
    }
  }

  private _setPosNumber(
    key: keyof ConfigStorage,
    val: number,
    allowInf: boolean,
  ): void {
    if (Number.isInteger(val) && val > -1) {
      (this._d as unknown as Record<string, unknown>)[key] = val;
    } else if (allowInf && (val === -1 || val === Infinity)) {
      (this._d as unknown as Record<string, unknown>)[key] = Infinity;
    } else {
      throw new RangeError(
        `${key} must be a non-negative integer (use -1 for infinity)`,
      );
    }
  }

  // ─── Dict-like interface ──────────────────────────────────────────────────

  /** Generic subscript-style read — mirrors Python config["key"]. */
  getOption(key: string): unknown {
    const self = this as unknown as Record<string, unknown>;
    if (key in self) return self[key];
    const dKey = key as keyof ConfigStorage;
    if (dKey in this._d) return this._d[dKey];
    throw new RangeError(`Unknown config key: ${key}`);
  }

  /** Generic subscript-style write — mirrors Python config["key"] = val. */
  setOption(key: string, value: unknown): void {
    const self = this as unknown as Record<string, unknown>;
    if (key in self && typeof Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(this), key
    )?.set === "function") {
      self[key] = value;
      return;
    }
    const dKey = key as keyof ConfigStorage;
    if (dKey in this._d) {
      (this._d as unknown as Record<string, unknown>)[dKey] = value;
      return;
    }
    throw new RangeError(`Unknown config key: ${key}`);
  }

  /** Iterate [key, value] pairs — mirrors Python dict.items(). */
  items(): [string, unknown][] {
    const result: [string, unknown][] = [];
    for (const key of Object.keys(this._d)) {
      result.push([key, this._d[key as keyof ConfigStorage]]);
    }
    return result;
  }

  /** Compatibility overload used by tempconfig and other code. */
  get<K extends keyof IManimConfig>(key: K): IManimConfig[K] {
    return (this as unknown as IManimConfig)[key];
  }

  /** Compatibility overload used by tempconfig and other code. */
  set<K extends keyof IManimConfig>(key: K, value: IManimConfig[K]): void {
    (this as unknown as IManimConfig)[key] = value;
  }

  // ─── copy / update ────────────────────────────────────────────────────────

  /** Deep copy this config — no shared references (except immutable colors). */
  copy(): ManimConfig {
    const c = new ManimConfig();
    // Copy all storage entries (colors are immutable so sharing is safe)
    for (const key of Object.keys(this._d) as Array<keyof ConfigStorage>) {
      const val = this._d[key];
      if (Array.isArray(val)) {
        (c._d as unknown as Record<string, unknown>)[key] = [...val];
      } else {
        (c._d as unknown as Record<string, unknown>)[key] = val;
      }
    }
    if (this._texTemplate) c._texTemplate = this._texTemplate;
    return c;
  }

  /** Update from another ManimConfig or a partial config object. */
  update(obj: ManimConfig | Partial<IManimConfig> | Record<string, unknown>): void {
    if (obj instanceof ManimConfig) {
      for (const key of Object.keys(obj._d) as Array<keyof ConfigStorage>) {
        const val = obj._d[key];
        if (Array.isArray(val)) {
          (this._d as unknown as Record<string, unknown>)[key] = [...val];
        } else {
          (this._d as unknown as Record<string, unknown>)[key] = val;
        }
      }
      if (obj._texTemplate) this._texTemplate = obj._texTemplate;
    } else {
      for (const [k, v] of Object.entries(obj)) {
        try {
          // Use the property setter if it exists (handles validation)
          const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), k);
          if (desc?.set) {
            (this as unknown as Record<string, unknown>)[k] = v;
          } else if (k in this._d) {
            (this._d as unknown as Record<string, unknown>)[k] = v;
          }
        } catch {
          // Ignore unknown keys
        }
      }
    }
  }

  toString(): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(this._d).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      parts.push(`${k}: ${String(v)}`);
    }
    return parts.join(", ");
  }

  // ─── Builder methods ──────────────────────────────────────────────────────

  /**
   * Ingest config values from a parsed INI ConfigParser object.
   * Mirrors Python ManimConfig.digest_parser().
   */
  digestParser(parser: ConfigParser): this {
    this._parser = parser;
    const cli = parser["CLI"] ?? {};

    // Boolean keys
    const boolPairs: Array<[keyof ConfigStorage, string]> = [
      ["notifyOutdatedVersion", "notify_outdated_version"],
      ["writeToMovie", "write_to_movie"],
      ["saveLastFrame", "save_last_frame"],
      ["writeAll", "write_all"],
      ["savePngs", "save_pngs"],
      ["saveAsGif", "save_as_gif"],
      ["saveSections", "save_sections"],
      ["preview", "preview"],
      ["showInFileBrowser", "show_in_file_browser"],
      ["logToFile", "log_to_file"],
      ["disableCaching", "disable_caching"],
      ["disableCachingWarning", "disable_caching_warning"],
      ["flushCache", "flush_cache"],
      ["customFolders", "custom_folders"],
      ["enableGui", "enable_gui"],
      ["fullscreen", "fullscreen"],
      ["useProjectionFillShaders", "use_projection_fill_shaders"],
      ["useProjectionStrokeShaders", "use_projection_stroke_shaders"],
      ["enableWireframe", "enable_wireframe"],
      ["forceWindow", "force_window"],
      ["noLatexCleanup", "no_latex_cleanup"],
      ["dryRun", "dry_run"],
    ];
    for (const [tsKey, pyKey] of boolPairs) {
      (this._d as unknown as Record<string, unknown>)[tsKey] = parseIniBoolean(
        cli[pyKey],
        false,
      );
    }

    // Int keys — pixel dimensions first (frame sizes depend on them)
    if (cli["pixel_height"] !== undefined)
      this._d.pixelHeight = parseIniInt(cli["pixel_height"], 1080);
    if (cli["pixel_width"] !== undefined)
      this._d.pixelWidth = parseIniInt(cli["pixel_width"], 1920);
    if (cli["from_animation_number"] !== undefined)
      this._d.fromAnimationNumber = parseIniInt(cli["from_animation_number"], 0);
    if (cli["upto_animation_number"] !== undefined)
      this._d.uptoAnimationNumber = parseIniInt(cli["upto_animation_number"], -1);
    if (cli["max_files_cached"] !== undefined)
      this._d.maxFilesCached = parseIniInt(cli["max_files_cached"], 100);
    if (cli["window_monitor"] !== undefined)
      this._d.windowMonitor = parseIniInt(cli["window_monitor"], 0);
    if (cli["zero_pad"] !== undefined)
      this._d.zeroPad = parseIniInt(cli["zero_pad"], 4);
    if (cli["seed"] !== undefined) {
      const sv = parseIniInt(cli["seed"], 0);
      this._d.seed = sv === 0 ? null : sv;
    }

    // String keys
    if (cli["assets_dir"] !== undefined) this._d.assetsDir = cli["assets_dir"];
    if (cli["verbosity"]) this._d.verbosity = cli["verbosity"] as VerbosityLevel;
    if (cli["media_dir"]) this._d.mediaDir = cli["media_dir"];
    if (cli["log_dir"]) this._d.logDir = cli["log_dir"];
    if (cli["video_dir"]) this._d.videoDir = cli["video_dir"];
    if (cli["sections_dir"]) this._d.sectionsDir = cli["sections_dir"];
    if (cli["images_dir"]) this._d.imagesDir = cli["images_dir"];
    if (cli["text_dir"]) this._d.textDir = cli["text_dir"];
    if (cli["tex_dir"]) this._d.texDir = cli["tex_dir"];
    if (cli["partial_movie_dir"]) this._d.partialMovieDir = cli["partial_movie_dir"];
    if (cli["input_file"] !== undefined) this._d.inputFile = cli["input_file"];
    if (cli["output_file"] !== undefined) this._d.outputFile = cli["output_file"];
    if (cli["movie_file_extension"])
      this._d.movieFileExtension = cli["movie_file_extension"] as MovieExtension;
    if (cli["background_color"])
      this._d.backgroundColor = Color.fromHex(cli["background_color"]);
    if (cli["renderer"])
      this._d.renderer = cli["renderer"].toLowerCase() as RendererType;
    if (cli["window_position"]) this._d.windowPosition = cli["window_position"];
    if (cli["preview_command"] !== undefined)
      this._d.previewCommand = cli["preview_command"];

    // Float keys
    if (cli["background_opacity"] !== undefined)
      this._d.backgroundOpacity = parseIniFloat(cli["background_opacity"], 1.0);
    if (cli["frame_rate"] !== undefined)
      this._d.frameRate = parseIniFloat(cli["frame_rate"], 60);

    // GUI location tuple
    if (cli["gui_location"]) {
      const parts = cli["gui_location"]
        .split(/[;,\-]/)
        .map((s) => parseInt(s, 10));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        this._d.guiLocation = [parts[0], parts[1]];
      }
    }

    // Window size — "default" or a "w,h" tuple
    const windowSize = cli["window_size"];
    if (windowSize !== undefined) {
      if (windowSize !== "default") {
        const parts = windowSize
          .split(/[;,\-]/)
          .map((s) => parseInt(s, 10));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          this._d.windowSize = [parts[0], parts[1]];
        }
      } else {
        this._d.windowSize = "default";
      }
    }

    // Plugins list
    const plugins = cli["plugins"] ?? "";
    this._d.plugins = plugins === "" ? [] : plugins.split(",");

    // Frame dimensions — AFTER pixel dimensions
    const fh = parseIniFloat(cli["frame_height"], 8.0);
    this._d.frameHeight = fh;
    const fwStr = cli["frame_width"];
    if (fwStr) {
      this._d.frameWidth = parseIniFloat(fwStr);
    } else {
      this._d.frameWidth = fh * this.aspectRatio;
    }

    // Tex template file
    if (cli["tex_template_file"]) {
      this.texTemplateFile = cli["tex_template_file"];
    }

    // Progress bar
    if (cli["progress_bar"]) {
      this._d.progressBar = cli["progress_bar"] as ProgressBarMode;
    }

    // ffmpeg log level
    const ffmpegSection = parser["ffmpeg"] ?? {};
    if (ffmpegSection["loglevel"])
      this._d.ffmpegLoglevel = ffmpegSection["loglevel"] as VerbosityLevel;

    // Jupyter settings
    const jupyterSection = parser["jupyter"] ?? {};
    if (jupyterSection["media_embed"])
      this._d.mediaEmbed = parseIniBoolean(jupyterSection["media_embed"]);
    if (jupyterSection["media_width"])
      this._d.mediaWidth = jupyterSection["media_width"];

    // Quality — LAST so it can override pixel dimensions
    const rawQuality = cli["quality"] ?? "";
    if (rawQuality) {
      const resolvedQuality = _determineQuality(rawQuality);
      if (resolvedQuality) this.quality = resolvedQuality;
    }

    return this;
  }

  /**
   * Ingest config values from a CLI argument object.
   * Mirrors Python ManimConfig.digest_args().
   */
  digestArgs(args: Record<string, unknown>): this {
    // Handle input file
    if (typeof args["file"] === "string") {
      if (args["file"].endsWith(".cfg")) {
        this.digestFile(args["file"]);
      } else if (args["file"] !== "-") {
        this._d.inputFile = nodePath.resolve(args["file"]);
      } else {
        this._d.inputFile = args["file"];
      }
    }

    if (typeof args["config_file"] === "string" && args["config_file"]) {
      this.digestFile(args["config_file"]);
    }

    const strArgs: Array<keyof ConfigStorage> = [
      "verbosity",
      "renderer",
      "windowPosition",
      "previewCommand",
      "outputFile",
    ];
    for (const key of strArgs) {
      if (args[key] !== undefined && args[key] !== null) {
        (this._d as unknown as Record<string, unknown>)[key] = args[key];
      }
    }

    const boolArgs: Array<keyof ConfigStorage> = [
      "preview",
      "showInFileBrowser",
      "writeToMovie",
      "saveLastFrame",
      "savePngs",
      "saveAsGif",
      "saveSections",
      "writeAll",
      "disableCaching",
      "flushCache",
      "enableGui",
      "fullscreen",
      "useProjectionFillShaders",
      "useProjectionStrokeShaders",
      "enableWireframe",
      "forceWindow",
      "dryRun",
      "noLatexCleanup",
      "notifyOutdatedVersion",
      "logToFile",
    ];
    for (const key of boolArgs) {
      if (args[key] !== undefined && args[key] !== null) {
        (this._d as unknown as Record<string, unknown>)[key] = args[key];
      }
    }

    if (args["sceneNames"] !== undefined)
      this._d.sceneNames = args["sceneNames"] as string[];
    if (args["backgroundColor"] !== undefined)
      this._d.backgroundColor = args["backgroundColor"] as IColor;
    if (args["mediaDir"] !== undefined)
      this._d.mediaDir = args["mediaDir"] as string;
    if (args["logDir"] !== undefined)
      this._d.logDir = args["logDir"] as string;
    if (args["seed"] !== undefined && args["seed"] !== null)
      this._d.seed = args["seed"] as number;
    if (args["zeroPad"] !== undefined)
      this._d.zeroPad = args["zeroPad"] as number;
    if (args["format"] !== undefined)
      this._d.format = args["format"] as FormatType;

    if (this._d.saveLastFrame) this._d.writeToMovie = false;

    if (args["fromAnimationNumber"] !== undefined)
      this._d.fromAnimationNumber = args["fromAnimationNumber"] as number;
    if (args["uptoAnimationNumber"] !== undefined)
      this._d.uptoAnimationNumber = args["uptoAnimationNumber"] as number;

    if (args["pixelWidth"] !== undefined)
      this._d.pixelWidth = args["pixelWidth"] as number;
    if (args["pixelHeight"] !== undefined)
      this._d.pixelHeight = args["pixelHeight"] as number;
    if (args["frameRate"] !== undefined)
      this._d.frameRate = args["frameRate"] as number;

    if (args["guiLocation"] !== undefined)
      this._d.guiLocation = args["guiLocation"] as [number, number];

    // Handle quality flag
    const qualityArg = args["quality"] as string | null | undefined;
    if (qualityArg !== undefined) {
      this.quality = qualityArg ?? "high";
    }

    // Handle custom_folders: override directory paths from parser section
    if (this._d.customFolders && this._parser) {
      const cfSection = this._parser["custom_folders"] ?? {};
      const dirKeys: Array<[keyof ConfigStorage, string]> = [
        ["mediaDir", "media_dir"],
        ["videoDir", "video_dir"],
        ["sectionsDir", "sections_dir"],
        ["imagesDir", "images_dir"],
        ["textDir", "text_dir"],
        ["texDir", "tex_dir"],
        ["logDir", "log_dir"],
        ["partialMovieDir", "partial_movie_dir"],
      ];
      for (const [tsKey, pyKey] of dirKeys) {
        const val = cfSection[pyKey];
        if (val)
          (this._d as unknown as Record<string, unknown>)[tsKey] = val;
      }
      // --media_dir still overrides custom_folders
      if (typeof args["mediaDir"] === "string" && args["mediaDir"])
        this._d.mediaDir = args["mediaDir"];
    }

    if (typeof args["tex_template"] === "string" && args["tex_template"])
      this._texTemplate = TexTemplate.fromFile(args["tex_template"]);

    if (
      this._d.renderer === RendererType.OPENGL &&
      args["write_to_movie"] === undefined
    ) {
      this._d.writeToMovie = false;
    }

    return this;
  }

  /**
   * Ingest config values from a .cfg file on disk.
   * Mirrors Python ManimConfig.digest_file().
   */
  digestFile(filename: string): this {
    if (!fs.existsSync(filename)) {
      throw new Error(
        `ENOENT: Error: --config_file could not find a valid config file: ${filename}`,
      );
    }
    return this.digestParser(makeConfigParser(filename));
  }

  // ─── Resolve movie file extension ──────────────────────────────────────────

  resolveMovieFileExtension(isTransparent: boolean): void {
    const prev = this._d.movieFileExtension;
    let next: MovieExtension;
    if (isTransparent) {
      next = this._d.format === "webm" ? ".webm" : ".mov";
    } else if (this._d.format === "webm") {
      next = ".webm";
    } else if (this._d.format === "mov") {
      next = ".mov";
    } else {
      next = ".mp4";
    }
    this._d.movieFileExtension = next;
    if (next !== prev) {
      console.warn(
        `Output format changed to '${next}' to support transparency`,
      );
    }
  }

  // ─── getDir ────────────────────────────────────────────────────────────────

  /**
   * Resolve a directory config option, expanding any {placeholder} tokens.
   * Mirrors Python ManimConfig.get_dir().
   */
  getDir(key: string, kwargs: Record<string, string> = {}): string {
    const validKeys = new Set<keyof ConfigStorage>([
      "assetsDir",
      "mediaDir",
      "videoDir",
      "sectionsDir",
      "imagesDir",
      "textDir",
      "texDir",
      "logDir",
      "inputFile",
      "outputFile",
      "partialMovieDir",
    ]);
    if (!validKeys.has(key as keyof ConfigStorage)) {
      throw new Error(
        "must pass one of: assetsDir, mediaDir, videoDir, sectionsDir, imagesDir, " +
          "textDir, texDir, logDir, inputFile, outputFile, partialMovieDir",
      );
    }

    const allArgs: Record<string, string> = {
      media_dir: this._d.mediaDir,
      video_dir: this._d.videoDir,
      sections_dir: this._d.sectionsDir,
      images_dir: this._d.imagesDir,
      text_dir: this._d.textDir,
      tex_dir: this._d.texDir,
      log_dir: this._d.logDir,
      assets_dir: this._d.assetsDir,
      input_file: this._d.inputFile,
      output_file: this._d.outputFile,
      partial_movie_dir: this._d.partialMovieDir,
      quality: `${this._d.pixelHeight}p${this._d.frameRate}`,
      ...kwargs,
    };

    let dirVal = this._d[key as keyof ConfigStorage] as string;
    let maxIter = 10;
    while (/{[^}]+}/.test(dirVal) && maxIter-- > 0) {
      dirVal = dirVal.replace(/{([^}]+)}/g, (match, placeholder: string) => {
        const resolved = allArgs[placeholder];
        if (resolved === undefined) {
          throw new Error(
            `${key} ${this._d[key as keyof ConfigStorage]} requires the following keyword arguments: ${placeholder}`,
          );
        }
        return resolved;
      });
    }
    return dirVal;
  }

  // ─── Properties ───────────────────────────────────────────────────────────

  // Directories
  get assetsDir(): string { return this._d.assetsDir; }
  set assetsDir(val: string) { this._d.assetsDir = val; }

  get mediaDir(): string { return this._d.mediaDir; }
  set mediaDir(val: string) { this._d.mediaDir = val; }

  get logDir(): string { return this._d.logDir; }
  set logDir(val: string) { this._d.logDir = val; }

  get videoDir(): string { return this._d.videoDir; }
  set videoDir(val: string) { this._d.videoDir = val; }

  get sectionsDir(): string { return this._d.sectionsDir; }
  set sectionsDir(val: string) { this._d.sectionsDir = val; }

  get imagesDir(): string { return this._d.imagesDir; }
  set imagesDir(val: string) { this._d.imagesDir = val; }

  get textDir(): string { return this._d.textDir; }
  set textDir(val: string) { this._d.textDir = val; }

  get texDir(): string { return this._d.texDir; }
  set texDir(val: string) { this._d.texDir = val; }

  get partialMovieDir(): string { return this._d.partialMovieDir; }
  set partialMovieDir(val: string) { this._d.partialMovieDir = val; }

  get inputFile(): string { return this._d.inputFile; }
  set inputFile(val: string) { this._d.inputFile = val; }

  get outputFile(): string { return this._d.outputFile; }
  set outputFile(val: string) { this._d.outputFile = val; }

  // Frame dimensions
  get pixelWidth(): number { return this._d.pixelWidth; }
  set pixelWidth(val: number) { this._setPosNumber("pixelWidth", val, false); }

  get pixelHeight(): number { return this._d.pixelHeight; }
  set pixelHeight(val: number) { this._setPosNumber("pixelHeight", val, false); }

  /** Aspect ratio (width / height) in pixels — read-only derived. */
  get aspectRatio(): number {
    return this._d.frameWidth / this._d.frameHeight;
  }

  get frameHeight(): number { return this._d.frameHeight; }
  set frameHeight(val: number) { this._d.frameHeight = val; }

  get frameWidth(): number { return this._d.frameWidth; }
  set frameWidth(val: number) { this._d.frameWidth = val; }

  /** Half the frame height. Setting this updates frameHeight. */
  get frameYRadius(): number { return this._d.frameHeight / 2; }
  set frameYRadius(val: number) {
    this._d.frameHeight = 2 * val;
  }

  /** Half the frame width. Setting this updates frameWidth. */
  get frameXRadius(): number { return this._d.frameWidth / 2; }
  set frameXRadius(val: number) {
    this._d.frameWidth = 2 * val;
  }

  get frameRate(): number { return this._d.frameRate; }
  set frameRate(val: number) { this._d.frameRate = val; }

  /** Shortcut tuple [pixelWidth, pixelHeight]. */
  get frameSize(): [number, number] {
    return [this._d.pixelWidth, this._d.pixelHeight];
  }
  set frameSize(val: [number, number]) {
    this._d.pixelWidth = val[0];
    this._d.pixelHeight = val[1];
  }

  // Computed frame-edge vectors (read-only)
  get top(): Point3D { return np.array([0, this.frameYRadius, 0]); }
  get bottom(): Point3D { return np.array([0, -this.frameYRadius, 0]); }
  get leftSide(): Point3D { return np.array([-this.frameXRadius, 0, 0]); }
  get rightSide(): Point3D { return np.array([this.frameXRadius, 0, 0]); }

  // Color / opacity
  get backgroundColor(): IColor { return this._d.backgroundColor; }
  set backgroundColor(val: IColor | string) {
    this._d.backgroundColor =
      typeof val === "string" ? Color.fromHex(val) : val;
  }

  get backgroundOpacity(): number { return this._d.backgroundOpacity; }
  set backgroundOpacity(val: number) {
    this._setBetween("backgroundOpacity", val, 0, 1);
    if (val < 1) this.resolveMovieFileExtension(true);
  }

  /** Whether the background is less than fully opaque. */
  get transparent(): boolean { return this._d.backgroundOpacity < 1.0; }
  set transparent(val: boolean) {
    this._d.backgroundOpacity = val ? 0.0 : 1.0;
    this.resolveMovieFileExtension(val);
  }

  // Quality
  get quality(): QualityValue {
    const pw = this._d.pixelWidth;
    const ph = this._d.pixelHeight;
    const fr = this._d.frameRate;
    for (const [name, preset] of Object.entries(QUALITY_PRESETS)) {
      if (
        preset.pixelWidth === pw &&
        preset.pixelHeight === ph &&
        preset.frameRate === fr
      ) {
        return name as QualityValue;
      }
    }
    return this._d.quality;
  }
  set quality(val: string | null) {
    if (val === null || val === undefined) return;
    const shortName = (QUALITY_NAME_MAP[val] ?? val) as QualityValue;
    if (!(shortName in QUALITY_PRESETS)) {
      throw new Error(
        `quality must be one of: ${Object.keys(QUALITY_PRESETS).join(", ")}`,
      );
    }
    const preset = QUALITY_PRESETS[shortName];
    this._d.quality = shortName;
    this._d.pixelWidth = preset.pixelWidth;
    this._d.pixelHeight = preset.pixelHeight;
    this._d.frameRate = preset.frameRate;
  }

  // Booleans
  get preview(): boolean {
    return this._d.preview || this._d.enableGui;
  }
  set preview(val: boolean) { this._setBoolean("preview", val); }

  get showInFileBrowser(): boolean { return this._d.showInFileBrowser; }
  set showInFileBrowser(val: boolean) {
    this._setBoolean("showInFileBrowser", val);
  }

  get logToFile(): boolean { return this._d.logToFile; }
  set logToFile(val: boolean) { this._setBoolean("logToFile", val); }

  get notifyOutdatedVersion(): boolean { return this._d.notifyOutdatedVersion; }
  set notifyOutdatedVersion(val: boolean) {
    this._setBoolean("notifyOutdatedVersion", val);
  }

  get writeToMovie(): boolean { return this._d.writeToMovie; }
  set writeToMovie(val: boolean) { this._setBoolean("writeToMovie", val); }

  get saveLastFrame(): boolean { return this._d.saveLastFrame; }
  set saveLastFrame(val: boolean) { this._setBoolean("saveLastFrame", val); }

  get writeAll(): boolean { return this._d.writeAll; }
  set writeAll(val: boolean) { this._setBoolean("writeAll", val); }

  get savePngs(): boolean { return this._d.savePngs; }
  set savePngs(val: boolean) { this._setBoolean("savePngs", val); }

  get saveAsGif(): boolean { return this._d.saveAsGif; }
  set saveAsGif(val: boolean) { this._setBoolean("saveAsGif", val); }

  get saveSections(): boolean { return this._d.saveSections; }
  set saveSections(val: boolean) { this._setBoolean("saveSections", val); }

  get enableWireframe(): boolean { return this._d.enableWireframe; }
  set enableWireframe(val: boolean) { this._setBoolean("enableWireframe", val); }

  get forceWindow(): boolean { return this._d.forceWindow; }
  set forceWindow(val: boolean) { this._setBoolean("forceWindow", val); }

  get noLatexCleanup(): boolean { return this._d.noLatexCleanup; }
  set noLatexCleanup(val: boolean) { this._setBoolean("noLatexCleanup", val); }

  get disableCaching(): boolean { return this._d.disableCaching; }
  set disableCaching(val: boolean) { this._setBoolean("disableCaching", val); }

  get disableCachingWarning(): boolean { return this._d.disableCachingWarning; }
  set disableCachingWarning(val: boolean) {
    this._setBoolean("disableCachingWarning", val);
  }

  get flushCache(): boolean { return this._d.flushCache; }
  set flushCache(val: boolean) { this._setBoolean("flushCache", val); }

  get customFolders(): boolean { return this._d.customFolders; }
  set customFolders(val: boolean) { this._setBoolean("customFolders", val); }

  get enableGui(): boolean { return this._d.enableGui; }
  set enableGui(val: boolean) { this._setBoolean("enableGui", val); }

  get fullscreen(): boolean { return this._d.fullscreen; }
  set fullscreen(val: boolean) { this._setBoolean("fullscreen", val); }

  get useProjectionFillShaders(): boolean {
    return this._d.useProjectionFillShaders;
  }
  set useProjectionFillShaders(val: boolean) {
    this._setBoolean("useProjectionFillShaders", val);
  }

  get useProjectionStrokeShaders(): boolean {
    return this._d.useProjectionStrokeShaders;
  }
  set useProjectionStrokeShaders(val: boolean) {
    this._setBoolean("useProjectionStrokeShaders", val);
  }

  get dryRun(): boolean { return this._d.dryRun; }
  set dryRun(val: boolean) {
    this._d.dryRun = val;
    if (val) {
      this._d.writeToMovie = false;
      this._d.writeAll = false;
      this._d.saveLastFrame = false;
      this._d.format = null;
    }
  }

  // Strings
  get verbosity(): VerbosityLevel { return this._d.verbosity; }
  set verbosity(val: string) {
    this._setFromList("verbosity", val as VerbosityLevel, [
      "DEBUG",
      "INFO",
      "WARNING",
      "ERROR",
      "CRITICAL",
    ]);
  }

  get progressBar(): ProgressBarMode { return this._d.progressBar; }
  set progressBar(val: string) {
    this._setFromList("progressBar", val as ProgressBarMode, [
      "none",
      "display",
      "leave",
    ]);
  }

  get format(): FormatType { return this._d.format; }
  set format(val: FormatType) {
    this._setFromList("format", val, [
      null,
      "png",
      "gif",
      "mp4",
      "mov",
      "webm",
    ]);
    this.resolveMovieFileExtension(this.transparent);
    if (val === "webm") {
      console.warn(
        "Output format set as webm, this can be slower than other formats",
      );
    }
  }

  get ffmpegLoglevel(): VerbosityLevel { return this._d.ffmpegLoglevel; }
  set ffmpegLoglevel(val: string) {
    this._setFromList("ffmpegLoglevel", val as VerbosityLevel, [
      "DEBUG",
      "INFO",
      "WARNING",
      "ERROR",
      "CRITICAL",
    ]);
  }

  get movieFileExtension(): MovieExtension { return this._d.movieFileExtension; }
  set movieFileExtension(val: string) {
    this._setFromList("movieFileExtension", val as MovieExtension, [
      ".mp4",
      ".mov",
      ".webm",
    ]);
  }

  get renderer(): RendererType { return this._d.renderer; }
  set renderer(val: string | RendererType) {
    const v = (typeof val === "string" ? val.toLowerCase() : val) as RendererType;
    this._d.renderer = v;
  }

  get windowPosition(): string { return this._d.windowPosition; }
  set windowPosition(val: string) { this._d.windowPosition = val; }

  get windowSize(): WindowSize { return this._d.windowSize; }
  set windowSize(val: WindowSize) { this._d.windowSize = val; }

  get previewCommand(): string { return this._d.previewCommand; }
  set previewCommand(val: string) { this._setStr("previewCommand", val); }

  get mediaEmbed(): boolean | null { return this._d.mediaEmbed; }
  set mediaEmbed(val: boolean | null) {
    if (val === null) {
      this._d.mediaEmbed = null;
    } else {
      this._setBoolean("mediaEmbed", val);
    }
  }

  get mediaWidth(): string { return this._d.mediaWidth; }
  set mediaWidth(val: string) { this._setStr("mediaWidth", val); }

  // Numerics
  get fromAnimationNumber(): number { return this._d.fromAnimationNumber; }
  set fromAnimationNumber(val: number) {
    this._d.fromAnimationNumber = val;
  }

  get uptoAnimationNumber(): number { return this._d.uptoAnimationNumber; }
  set uptoAnimationNumber(val: number) {
    this._setPosNumber("uptoAnimationNumber", val, true);
  }

  get maxFilesCached(): number { return this._d.maxFilesCached; }
  set maxFilesCached(val: number) {
    this._setPosNumber("maxFilesCached", val, true);
  }

  get windowMonitor(): number { return this._d.windowMonitor; }
  set windowMonitor(val: number) { this._setPosNumber("windowMonitor", val, true); }

  get zeroPad(): number { return this._d.zeroPad; }
  set zeroPad(val: number) { this._setIntBetween("zeroPad", val, 0, 9); }

  get seed(): number | null { return this._d.seed; }
  set seed(val: number | null) {
    if (val === null) return;
    this._setPosNumber("seed", val, false);
  }

  get guiLocation(): [number, number] { return this._d.guiLocation; }
  set guiLocation(val: [number, number]) {
    if (!Array.isArray(val) || val.length < 2)
      throw new Error("guiLocation must be a [number, number] tuple");
    this._d.guiLocation = [val[0], val[1]];
  }

  // Collections
  get plugins(): string[] { return this._d.plugins; }
  set plugins(val: string[]) { this._d.plugins = val; }

  get sceneNames(): string[] { return this._d.sceneNames; }
  set sceneNames(val: string[]) { this._d.sceneNames = val; }

  // Tex template
  get texTemplate(): TexTemplate {
    if (!this._texTemplate) {
      const fn = this._d.texTemplateFile;
      this._texTemplate = fn ? TexTemplate.fromFile(fn) : new TexTemplate();
    }
    return this._texTemplate;
  }
  set texTemplate(val: TexTemplate) {
    if (val instanceof TexTemplate) this._texTemplate = val;
  }

  get texTemplateFile(): string | null { return this._d.texTemplateFile; }
  set texTemplateFile(val: string | null) {
    if (!val) {
      this._d.texTemplateFile = null;
    } else {
      try {
        fs.accessSync(val, fs.constants.R_OK);
        this._d.texTemplateFile = val;
      } catch {
        console.warn(
          `Custom TeX template ${val} not found or not readable.`,
        );
      }
    }
  }
}

// ─── ManimFrame ───────────────────────────────────────────────────────────────

/**
 * Read-only view of frame dimensions from the active ManimConfig.
 * Also exposes standard direction constants (UP, DOWN, etc.).
 * Python: ManimFrame (manim/_config/utils.py)
 */
export class ManimFrame {
  private readonly _c: ManimConfig;

  constructor(c: ManimConfig) {
    if (!(c instanceof ManimConfig)) {
      throw new TypeError("argument must be instance of 'ManimConfig'");
    }
    this._c = c;
  }

  // Frame dimension accessors
  get pixelWidth(): number { return this._c.pixelWidth; }
  get pixelHeight(): number { return this._c.pixelHeight; }
  get aspectRatio(): number { return this._c.aspectRatio; }
  get frameHeight(): number { return this._c.frameHeight; }
  get frameWidth(): number { return this._c.frameWidth; }
  /** Alias for frameWidth (mirrors Python ManimFrame.width). */
  get width(): number { return this._c.frameWidth; }
  /** Alias for frameHeight (mirrors Python ManimFrame.height). */
  get height(): number { return this._c.frameHeight; }
  get frameRate(): number { return this._c.frameRate; }
  get frameYRadius(): number { return this._c.frameYRadius; }
  get frameXRadius(): number { return this._c.frameXRadius; }
  get top(): Point3D { return this._c.top; }
  get bottom(): Point3D { return this._c.bottom; }
  get leftSide(): Point3D { return this._c.leftSide; }
  get rightSide(): Point3D { return this._c.rightSide; }

  // Direction constants (read-only, mirrors ManimFrame._CONSTANTS in Python)
  get UP(): Point3D { return np.array([0.0, 1.0, 0.0]); }
  get DOWN(): Point3D { return np.array([0.0, -1.0, 0.0]); }
  get RIGHT(): Point3D { return np.array([1.0, 0.0, 0.0]); }
  get LEFT(): Point3D { return np.array([-1.0, 0.0, 0.0]); }
  get IN(): Point3D { return np.array([0.0, 0.0, -1.0]); }
  get OUT(): Point3D { return np.array([0.0, 0.0, 1.0]); }
  get ORIGIN(): Point3D { return np.array([0.0, 0.0, 0.0]); }
  get X_AXIS(): Point3D { return np.array([1.0, 0.0, 0.0]); }
  get Y_AXIS(): Point3D { return np.array([0.0, 1.0, 0.0]); }
  get Z_AXIS(): Point3D { return np.array([0.0, 0.0, 1.0]); }
  get UL(): Point3D { return np.array([-1.0, 1.0, 0.0]); }
  get UR(): Point3D { return np.array([1.0, 1.0, 0.0]); }
  get DL(): Point3D { return np.array([-1.0, -1.0, 0.0]); }
  get DR(): Point3D { return np.array([1.0, -1.0, 0.0]); }

  // Prevent mutation
  set pixelWidth(_: number) {
    throw new TypeError("'ManimFrame' object does not support item assignment");
  }
  set pixelHeight(_: number) {
    throw new TypeError("'ManimFrame' object does not support item assignment");
  }
  set frameHeight(_: number) {
    throw new TypeError("'ManimFrame' object does not support item assignment");
  }
  set frameWidth(_: number) {
    throw new TypeError("'ManimFrame' object does not support item assignment");
  }
}
