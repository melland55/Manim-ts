/**
 * A directive for including Manim videos in a documentation page.
 * Mirrors manim/utils/docbuild/manim_directive.py — adapted for TypeScript.
 *
 * When rendering the HTML documentation, the `ManimDirective` allows rendered
 * videos or images to be embedded alongside source code examples.
 *
 * Scene rendering is delegated to the TypeScript Manim pipeline; see the
 * TODO notes below for the parts that still require a full scene executor.
 */

import * as fs from "fs";
import * as path from "path";
import * as csv from "node:readline"; // Used only for type reference; actual CSV uses fs

// ─── Quality presets (mirrors manim.constants.QUALITIES) ─────────────────────

export interface QualityPreset {
  frameRate: number;
  pixelHeight: number;
  pixelWidth: number;
}

/** Quality presets matching Manim's QUALITIES dict. */
export const QUALITIES: Record<string, QualityPreset> = {
  low_quality: { frameRate: 15, pixelHeight: 480, pixelWidth: 854 },
  medium_quality: { frameRate: 30, pixelHeight: 720, pixelWidth: 1280 },
  high_quality: { frameRate: 60, pixelHeight: 1080, pixelWidth: 1920 },
  fourk_quality: { frameRate: 60, pixelHeight: 2160, pixelWidth: 3840 },
  example_quality: { frameRate: 30, pixelHeight: 480, pixelWidth: 854 },
};

// ─── TypedDict equivalents ────────────────────────────────────────────────────

export interface SetupMetadata {
  parallelReadSafe: boolean;
  parallelWriteSafe: boolean;
}

// ─── SkipManimNode ────────────────────────────────────────────────────────────

/**
 * Auxiliary node used when scene rendering is skipped (e.g. `skip-manim` tag
 * or gettext builder). Outputs a placeholder block instead of a rendered scene.
 */
export class SkipManimNode {
  readonly type = "skip-manim" as const;
  readonly className: string;
  readonly sourceLines: string[];

  constructor(className: string, sourceLines: string[]) {
    this.className = className;
    this.sourceLines = sourceLines;
  }

  /**
   * Render the placeholder as a reStructuredText string.
   * Mirrors the Python version's `visit`/`depart` pair.
   */
  toRst(): string {
    const indented = this.sourceLines.map((l) => `    ${l}`).join("\n");
    return [
      `.. admonition:: Example Placeholder`,
      ``,
      `    Placeholder block for \`\`${this.className}\`\`.`,
      ``,
      `    .. code-block:: python`,
      ``,
      indented,
      ``,
      `    .. raw:: html`,
      ``,
      `        <pre data-manim-binder data-manim-classname="${this.className}">`,
      indented,
      `        </pre>`,
    ].join("\n");
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Reformat a space-separated list of names as Sphinx cross-reference strings.
 *
 * @example
 * processNameList("Tex TexTemplate", "class")
 * // → [':class:`~.Tex`', ':class:`~.TexTemplate`']
 */
export function processNameList(optionInput: string, referenceType: string): string[] {
  return optionInput.split(/\s+/).map((name) => `:${referenceType}:\`~.${name}\``);
}

// ─── Rendering stats ──────────────────────────────────────────────────────────

const renderingTimesFilePath = path.resolve("../rendering_times.csv");

/**
 * Append a row to the rendering-times CSV log.
 * Mirrors `_write_rendering_stats` from the Python version.
 */
export function writeRenderingStats(
  sceneName: string,
  runTime: number,
  fileName: string,
): void {
  const cleanName = fileName.replace(/^(reference\/|manim\.)/, "");
  const row = `${cleanName},${sceneName},${runTime.toFixed(3)}\n`;
  try {
    fs.appendFileSync(renderingTimesFilePath, row, "utf-8");
  } catch {
    // Non-fatal — stats logging is best-effort
  }
}

/**
 * Print a summary of all recorded rendering times.
 * Mirrors `_log_rendering_times` from the Python version.
 */
export function logRenderingTimes(): void {
  if (!fs.existsSync(renderingTimesFilePath)) return;

  const raw = fs.readFileSync(renderingTimesFilePath, "utf-8");
  const rows = raw
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split(","));

  if (rows.length === 0) return;

  console.log("\nRendering Summary\n-----------------\n");

  const maxFileLen = Math.max(...rows.map((r) => r[0].length));

  // Group by file name
  const groups = new Map<string, string[][]>();
  for (const row of rows) {
    const key = row[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  for (const [key, group] of groups) {
    const paddedKey = key.padEnd(maxFileLen + 1, ".");
    if (group.length === 1) {
      const row = group[0];
      console.log(`${paddedKey}${row[2].padStart(7, ".")}s ${row[1]}`);
    } else {
      const timeSum = group.reduce((acc, r) => acc + parseFloat(r[2]), 0);
      console.log(
        `${paddedKey}${timeSum.toFixed(3).padStart(7, ".")}s  => ${group.length} EXAMPLES`,
      );
      for (const row of group) {
        console.log(`${" ".repeat(maxFileLen)} ${row[2].padStart(7)}s ${row[1]}`);
      }
    }
  }
  console.log("");
}

/**
 * Delete the rendering-times CSV file if it exists.
 * Mirrors `_delete_rendering_times` from the Python version.
 */
export function deleteRenderingTimes(): void {
  if (fs.existsSync(renderingTimesFilePath)) {
    fs.unlinkSync(renderingTimesFilePath);
  }
}

// ─── Jinja2-equivalent HTML template ─────────────────────────────────────────

export interface TemplateContext {
  clsname: string;
  clsnameLowercase: string;
  hideSource: boolean;
  filesrcRel: string;
  noAutoplay: boolean;
  outputFile: string;
  saveLastFrame: boolean;
  saveAsGif: boolean;
  sourceBlock: string;
  refBlock: string;
}

/**
 * Render the documentation template to an RST string.
 * Mirrors the TEMPLATE Jinja2 string from the Python version.
 */
export function renderTemplate(ctx: TemplateContext): string {
  const parts: string[] = [];

  if (!ctx.hideSource) {
    parts.push(
      `\n.. raw:: html\n\n` +
        `    <div id="${ctx.clsnameLowercase}" class="admonition admonition-manim-example">\n` +
        `    <p class="admonition-title">Example: ${ctx.clsname} ` +
        `<a class="headerlink" href="#${ctx.clsnameLowercase}">¶</a></p>\n`,
    );
  }

  if (!ctx.saveAsGif && !ctx.saveLastFrame) {
    parts.push(
      `\n.. raw:: html\n\n` +
        `    <video\n` +
        `        class="manim-video"\n` +
        `        controls\n` +
        `        loop\n` +
        `        ${ctx.noAutoplay ? "" : "autoplay"}\n` +
        `        src="./${ctx.outputFile}.mp4">\n` +
        `    </video>\n`,
    );
  } else if (ctx.saveAsGif) {
    parts.push(`\n.. image:: /${ctx.filesrcRel}\n    :align: center\n`);
  } else if (ctx.saveLastFrame) {
    parts.push(`\n.. image:: /${ctx.filesrcRel}\n    :align: center\n`);
  }

  if (!ctx.hideSource) {
    parts.push(`\n${ctx.sourceBlock}\n`);
    parts.push(`\n${ctx.refBlock}\n`);
    parts.push(`\n.. raw:: html\n\n    </div>\n`);
  }

  return parts.join("");
}

// ─── Directive options ────────────────────────────────────────────────────────

export type QualityOption = "low" | "medium" | "high" | "fourk";

export interface ManimDirectiveOptions {
  hideSource?: boolean;
  noAutoplay?: boolean;
  quality?: QualityOption;
  saveAsGif?: boolean;
  saveLastFrame?: boolean;
  refModules?: string[];
  refClasses?: string[];
  refFunctions?: string[];
  refMethods?: string[];
}

// ─── ManimDirective ───────────────────────────────────────────────────────────

/** Counter for tracking duplicate class names in a documentation build. */
const classnameDict = new Map<string, number>();

export interface ManimDirectiveResult {
  /** RST/HTML content to be inserted into the documentation. */
  content: string;
  /** Skipped-render placeholder, present only when rendering was skipped. */
  skipNode?: SkipManimNode;
}

/**
 * Directive that renders a Manim scene and embeds it in documentation.
 *
 * Mirrors `ManimDirective` from `manim_directive.py`.
 *
 * In Python this extends Sphinx's `Directive` and executes `exec()` to
 * render the scene in-process. In TypeScript, the scene execution is
 * delegated to the rendering pipeline (see the TODO below).
 */
export class ManimDirective {
  static readonly hasContent = true;
  static readonly requiredArguments = 1;

  private readonly className: string;
  private readonly content: string[];
  private readonly options: ManimDirectiveOptions;

  constructor(className: string, content: string[], options: ManimDirectiveOptions = {}) {
    this.className = className;
    this.content = content;
    this.options = options;
  }

  /**
   * Process the directive and return the rendered documentation content.
   *
   * @param skipRendering When `true`, returns a placeholder block without
   *                      executing the scene. Pass `true` during gettext
   *                      builds or when the `skip-manim` tag is active.
   */
  async run(skipRendering = false): Promise<ManimDirectiveResult> {
    const clsname = this.className;

    if (skipRendering) {
      return {
        content: "",
        skipNode: new SkipManimNode(clsname, this.content),
      };
    }

    // Track duplicate class names (mirrors classnamedict in Python)
    const prev = classnameDict.get(clsname) ?? 0;
    classnameDict.set(clsname, prev + 1);
    const count = classnameDict.get(clsname)!;

    const hideSource = this.options.hideSource === true;
    const noAutoplay = this.options.noAutoplay === true;
    const saveAsGif = this.options.saveAsGif === true;
    const saveLastFrame = this.options.saveLastFrame === true;

    if (saveAsGif && saveLastFrame) {
      throw new Error("Cannot set both saveAsGif and saveLastFrame.");
    }

    const refContent = [
      ...(this.options.refModules ?? []),
      ...(this.options.refClasses ?? []),
      ...(this.options.refFunctions ?? []),
      ...(this.options.refMethods ?? []),
    ];
    const refBlock = refContent.length > 0 ? `References: ${refContent.join(" ")}` : "";

    const qualityKey = this.options.quality
      ? `${this.options.quality}_quality`
      : "example_quality";
    const preset = QUALITIES[qualityKey] ?? QUALITIES.example_quality;

    const outputFile = `${clsname}-${count}`;

    // Build the code block for display
    let userCode = this.content.slice();
    if (userCode[0]?.startsWith(">>> ")) {
      userCode = userCode
        .filter((l) => l.startsWith(">>> ") || l.startsWith("... "))
        .map((l) => l.slice(4));
    }

    const sourceBlockLines: string[] = [
      ".. code-block:: typescript",
      "",
      "    import { Scene } from '@manim/scene';",
      ...userCode.map((l) => `    ${l}`),
      "",
      ".. raw:: html",
      "",
      `    <pre data-manim-binder data-manim-classname="${clsname}">`,
      ...userCode.map((l) => `    ${l}`),
      "    </pre>",
    ];
    const sourceBlock = sourceBlockLines.join("\n");

    // TODO: Execute the TypeScript scene and capture the output file.
    // In Python this calls exec() with the scene code + tempconfig.
    // In TypeScript, use the scene rendering pipeline:
    //   import { Scene } from '../../scene/index.js';
    //   const scene = new (<SceneClass>)();
    //   await scene.render({ frameRate: preset.frameRate, ... });
    // For now, return the RST template with a placeholder path.
    const filesrcRel = `media/videos/${qualityKey}/${outputFile}.mp4`;

    const rendered = renderTemplate({
      clsname,
      clsnameLowercase: clsname.toLowerCase(),
      hideSource,
      filesrcRel,
      noAutoplay,
      outputFile,
      saveLastFrame,
      saveAsGif,
      sourceBlock,
      refBlock,
    });

    return { content: rendered };
  }

  /**
   * Reset the class-name counter.
   * Useful between documentation builds or in tests.
   */
  static resetClassnameDict(): void {
    classnameDict.clear();
  }

  /** Expose the current class-name dict for inspection. */
  static getClassnameDict(): ReadonlyMap<string, number> {
    return classnameDict;
  }
}
