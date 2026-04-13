/**
 * Test class factories for graphical unit tests.
 *
 * TypeScript port of manim/utils/testing/_test_class_makers.py.
 *
 * Provides helpers to create test Scene subclasses, test Renderer subclasses,
 * and a DummySceneFileWriter that intercepts frame writes for comparison.
 */

import { Scene } from "../../scene/scene/index.js";
import type { SceneOptions } from "../../scene/scene/index.js";
import {
  SceneFileWriter,
  type PixelArray,
  type SceneFileWriterConfig,
  type SceneFileWriterRenderer,
  type StrPath,
} from "../../scene/scene_file_writer/index.js";
import { CairoRenderer } from "../../renderer/cairo_renderer/index.js";
import type { OpenGLRenderer } from "../../renderer/opengl_renderer/index.js";
import type { _FramesTester } from "./_frames_testers.js";

// ─── Test Scene Factory ──────────────────────────────────────

/**
 * Create a Scene subclass that runs a test construct function.
 *
 * @param baseScene - The Scene class (or subclass) to extend.
 * @param constructTest - The test function to call as the scene's construct().
 * @param testRenderer - Optional renderer to use for the scene.
 * @returns A new Scene subclass.
 */
export function makeTestSceneClass(
  baseScene: typeof Scene,
  constructTest: (scene: Scene) => void | Promise<void>,
  testRenderer: CairoRenderer | OpenGLRenderer | null,
): typeof Scene {
  class TestedScene extends baseScene {
    constructor(options: SceneOptions = {}) {
      super(options);
      // If a test renderer is provided, we'd attach it here.
      // The current Scene API doesn't have a renderer property,
      // so this is a partial port — the renderer is managed externally.
    }

    override async construct(): Promise<void> {
      await constructTest(this);

      // Manim hack to render the very last frame
      // (normally the last frame is not the very end of the animation)
      if (this.animations !== null) {
        // TODO: Port updateToTime and renderer.render calls
        // when Scene has full renderer integration
      }
    }
  }

  return TestedScene as unknown as typeof Scene;
}

// ─── Test Renderer Factory ───────────────────────────────────

/**
 * Create a test renderer subclass from a base renderer class.
 *
 * @param fromRenderer - The renderer class to extend.
 * @returns A new renderer subclass for testing.
 */
export function makeTestRendererClass<T extends abstract new (...args: never[]) => unknown>(
  fromRenderer: T,
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class TestRenderer extends (fromRenderer as any) {
    constructor(...args: unknown[]) {
      super(...args);
    }
  }

  return TestRenderer as unknown as T;
}

// ─── DummySceneFileWriter ────────────────────────────────────

/**
 * A no-op SceneFileWriter used in tests.
 *
 * Overrides all file I/O methods to do nothing, allowing tests to
 * run without writing to disk. Only tracks the frame write count.
 */
export class DummySceneFileWriter extends SceneFileWriter {
  /** Count of frames written (for tracking purposes). */
  i: number = 0;

  constructor(
    renderer: SceneFileWriterRenderer,
    sceneName: string,
    config: SceneFileWriterConfig,
  ) {
    super(renderer, sceneName, config);
    this.i = 0;
  }

  override initOutputDirectories(_sceneName: string): void {
    // No-op: don't create directories in tests.
  }

  override addPartialMovieFile(_hashAnimation: string | null): void {
    // No-op.
  }

  override async beginAnimation(
    _allowWrite: boolean = true,
    _filePath: StrPath | null = null,
  ): Promise<void> {
    // No-op.
  }

  override async endAnimation(_allowWrite: boolean = false): Promise<void> {
    // No-op.
  }

  // No combine / clean methods in base class to override, but
  // the Python version had these as no-ops too.

  override async writeFrame(
    _frameOrRenderer: PixelArray | SceneFileWriterRenderer,
    _numFrames: number = 1,
  ): Promise<void> {
    this.i++;
  }
}

// ─── Test SceneFileWriter with Frame Checking ────────────────

/**
 * Create a SceneFileWriter subclass that checks each frame against
 * a _FramesTester during the test run.
 *
 * @param tester - The frame tester to delegate frame checks to.
 * @returns A SceneFileWriter subclass that validates frames on write.
 */
export function makeSceneFileWriterClass(
  tester: _FramesTester,
): typeof SceneFileWriter {
  class TestSceneFileWriter extends DummySceneFileWriter {
    override async writeFrame(
      frameOrRenderer: PixelArray | SceneFileWriterRenderer,
      numFrames: number = 1,
    ): Promise<void> {
      tester.checkFrame(this.i, frameOrRenderer as PixelArray);
      await super.writeFrame(frameOrRenderer, numFrames);
    }
  }

  return TestSceneFileWriter as unknown as typeof SceneFileWriter;
}
