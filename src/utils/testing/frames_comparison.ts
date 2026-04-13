/**
 * Frame comparison utilities for graphical unit tests.
 *
 * TypeScript port of manim/utils/testing/frames_comparison.py.
 *
 * The Python version is tightly coupled to pytest fixtures, decorators, and
 * CLI flags (--set_test, --show_diff).  The TS port adapts this for vitest:
 *
 * - `framesComparison()` returns a test runner function instead of a pytest decorator.
 * - Config overrides are applied via `tempconfig()`.
 * - Control data paths follow the same convention: `control_data/<module>/<test>.json`.
 *
 * Usage in vitest:
 * ```typescript
 * import { framesComparison } from "../src/utils/testing/index.js";
 *
 * it("renders correctly", async () => {
 *   await framesComparison({
 *     moduleName: "geometry",
 *     testName: "square_render",
 *     construct: (scene) => { scene.add(new Square()); },
 *   });
 * });
 * ```
 */

import * as fs from "fs";
import * as path from "path";
import { tempconfig, config } from "../../_config/index.js";
import type { ManimConfig } from "../../_config/index.js";
import { Scene } from "../../scene/scene/index.js";
import { CairoRenderer } from "../../renderer/cairo_renderer/index.js";
import type { OpenGLRenderer } from "../../renderer/opengl_renderer/index.js";
import { ThreeDScene } from "../../scene/three_d_scene/index.js";
import { ThreeDCamera } from "../../camera/three_d_camera/index.js";
import { _FramesTester, _ControlDataWriter } from "./_frames_testers.js";
import {
  DummySceneFileWriter,
  makeSceneFileWriterClass,
  makeTestRendererClass,
  makeTestSceneClass,
} from "./_test_class_makers.js";

// ─── Constants ───────────────────────────────────────────────

export const SCENE_PARAMETER_NAME = "scene";

/**
 * Default root directory for control data.
 * Mirrors Python's `_tests_root_dir_path / "control_data" / "graphical_units_data"`.
 */
const PATH_CONTROL_DATA = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
  "..",
  "..",
  "..",
  "tests",
  "control_data",
  "graphical_units_data",
);

// ─── Options ─────────────────────────────────────────────────

export interface FramesComparisonOptions {
  /** The module name for control data directory structure. */
  moduleName: string;
  /** The test name for control data file naming. */
  testName: string;
  /** The construct function to run in the test scene. */
  construct: (scene: Scene) => void | Promise<void>;
  /** Whether to only test the last frame (default: true). */
  lastFrame?: boolean;
  /** The renderer class to use (default: CairoRenderer). */
  rendererClass?: typeof CairoRenderer;
  /** The base scene class to use (default: Scene). */
  baseScene?: typeof Scene;
  /** Whether to generate new control data instead of comparing (default: false). */
  setTestData?: boolean;
  /** Whether to show visual diffs on mismatch (default: false). */
  showDiff?: boolean;
  /** Custom config overrides for the test. */
  customConfig?: Partial<Record<string, unknown>>;
  /** Frame size as [height, width] (default: from config). */
  sizeFrame?: [number, number];
  /** Path to the test file (for resolving control data location). */
  testFilePath?: string;
}

// ─── Main entry point ────────────────────────────────────────

/**
 * Run a graphical frame comparison test.
 *
 * Renders a scene and compares the output frames against stored control data.
 * If `setTestData` is true, writes new control data instead.
 *
 * @param options - Configuration for the frame comparison test.
 */
export async function framesComparison(
  options: FramesComparisonOptions,
): Promise<void> {
  const {
    moduleName,
    testName,
    construct,
    lastFrame = true,
    rendererClass = CairoRenderer,
    baseScene = Scene,
    setTestData = false,
    showDiff = false,
    customConfig = {},
    testFilePath,
  } = options;

  const configTests = configTest(lastFrame);

  if (lastFrame) {
    (configTests as Record<string, unknown>)["frameRate"] = 1;
  }

  const sizeFrame = options.sizeFrame ?? [
    (configTests as Record<string, unknown>)["pixelHeight"] as number ?? config.pixelHeight,
    (configTests as Record<string, unknown>)["pixelWidth"] as number ?? config.pixelWidth,
  ];

  const filePath = controlDataPath(
    testFilePath ?? null,
    moduleName,
    testName,
    setTestData,
  );

  const realTest = makeTestComparingFrames({
    filePath,
    baseScene,
    construct,
    rendererClass,
    isSetTestDataTest: setTestData,
    lastFrame,
    showDiff,
    sizeFrame,
  });

  await tempconfig(
    { ...configTests, ...customConfig } as Partial<Record<string, unknown>>,
    realTest,
  );
}

// ─── Internal helpers ────────────────────────────────────────

interface MakeTestOptions {
  filePath: string;
  baseScene: typeof Scene;
  construct: (scene: Scene) => void | Promise<void>;
  rendererClass: typeof CairoRenderer;
  isSetTestDataTest: boolean;
  lastFrame: boolean;
  showDiff: boolean;
  sizeFrame: [number, number];
}

/**
 * Create the test function that compares frames.
 *
 * @returns An async function that runs the test.
 */
function makeTestComparingFrames(opts: MakeTestOptions): () => Promise<void> {
  const {
    filePath,
    baseScene,
    construct,
    rendererClass,
    isSetTestDataTest,
    lastFrame,
    showDiff,
    sizeFrame,
  } = opts;

  let framesTester: _FramesTester;
  if (isSetTestDataTest) {
    framesTester = new _ControlDataWriter(filePath, sizeFrame);
  } else {
    framesTester = new _FramesTester(filePath, showDiff);
  }

  return async () => {
    framesTester.loadFrames();

    const TestRendererClass = makeTestRendererClass(rendererClass);

    const SceneTested = makeTestSceneClass(
      baseScene,
      construct,
      null, // Renderer is managed by Scene internally
    );

    const scene = new SceneTested({ skipAnimations: true });
    await scene.render();

    if (lastFrame) {
      // Check the last frame
      // TODO: Get frame from renderer when Scene has full renderer integration
      // framesTester.checkFrame(-1, scene.renderer.getFrame());
    }

    if (isSetTestDataTest && framesTester instanceof _ControlDataWriter) {
      framesTester.saveControlData();
    } else {
      framesTester.assertAllFramesCompared();
    }
  };
}

/**
 * Resolve the path to control data for a given test.
 *
 * @param testFilePath - Path to the test file (for relative resolution).
 * @param moduleName - The module name subdirectory.
 * @param testName - The test name (becomes the filename).
 * @param settingTest - Whether we are generating new control data.
 * @returns The resolved path to the control data file.
 */
function controlDataPath(
  testFilePath: string | null,
  moduleName: string,
  testName: string,
  settingTest: boolean,
): string {
  let basePath: string;

  if (testFilePath !== null) {
    basePath = path.join(
      path.dirname(path.resolve(testFilePath)),
      "control_data",
      moduleName,
    );
  } else {
    basePath = path.join(PATH_CONTROL_DATA, moduleName);
  }

  if (settingTest) {
    fs.mkdirSync(basePath, { recursive: true });
  } else if (!fs.existsSync(basePath)) {
    throw new Error(
      `The control frames directory can't be found in ${basePath}`,
    );
  }

  const filePath = path.join(basePath, `${testName}.json`);

  if (!settingTest && !fs.existsSync(filePath)) {
    throw new Error(
      `The control frame for the test ${testName} cannot be found in ${basePath}. ` +
        `Make sure you generated the control frames first.`,
    );
  }

  return filePath;
}

/**
 * Generate a test config based on whether we're testing the last frame only.
 *
 * In Python this reads from .cfg files; here we return sensible defaults.
 */
function configTest(lastFrame: boolean): Partial<Record<string, unknown>> {
  if (lastFrame) {
    return {
      pixelWidth: 410,
      pixelHeight: 308,
      frameRate: 1,
      quality: "low" as const,
    };
  }
  return {
    pixelWidth: 410,
    pixelHeight: 308,
    frameRate: 15,
    quality: "low" as const,
  };
}
