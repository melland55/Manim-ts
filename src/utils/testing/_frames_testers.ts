/**
 * Frame comparison testers for graphical unit tests.
 *
 * TypeScript port of manim/utils/testing/_frames_testers.py.
 *
 * Provides _FramesTester (reads and compares against saved control frames)
 * and _ControlDataWriter (captures frames to create new control data).
 *
 * In Python these use numpy .npz files for frame storage.  In the TS port
 * we use JSON-based storage since numpy-ts does not support .npz I/O.
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "../../_config/index.js";
import { showDiffHelper } from "./_show_diff.js";

/** Raw RGBA pixel data for one frame (width × height × 4 bytes). */
type PixelArray = Uint8Array;

/** Absolute tolerance for pixel value comparison. */
export const FRAME_ABSOLUTE_TOLERANCE = 1.01;

/** Ratio of mismatched pixels below which we still accept the frame. */
export const FRAME_MISMATCH_RATIO_TOLERANCE = 1e-5;

/**
 * Compares rendered frames against previously stored control data.
 *
 * Usage:
 * ```typescript
 * const tester = new _FramesTester(filePath);
 * tester.loadFrames();
 * // ... render scene ...
 * tester.checkFrame(0, renderedFrame);
 * tester.assertAllFramesCompared();
 * ```
 */
export class _FramesTester {
  protected _filePath: string;
  protected _showDiff: boolean;
  protected _frames: PixelArray[] = [];
  protected _numberFrames: number = 0;
  protected _framesCompared: number = 0;

  constructor(filePath: string, showDiff: boolean = false) {
    this._filePath = filePath;
    this._showDiff = showDiff;
  }

  /**
   * Load control frame data from disk.
   *
   * The control data is stored as a JSON file with base64-encoded frame buffers.
   * Each frame is an RGBA Uint8Array.
   */
  loadFrames(): void {
    if (!fs.existsSync(this._filePath)) {
      throw new Error(
        `Control data file not found: ${this._filePath}. ` +
          `Generate control frames first using setTestData mode.`,
      );
    }

    const raw = fs.readFileSync(this._filePath, "utf-8");
    const data = JSON.parse(raw) as {
      frames: string[];
      width: number;
      height: number;
    };

    this._frames = data.frames.map((b64) => {
      const buf = Buffer.from(b64, "base64");
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    });

    this._numberFrames = this._frames.length;
    logger.debug(
      `Loaded ${this._numberFrames} control frames from ${this._filePath}`,
    );
  }

  /**
   * Assert that exactly all control frames were compared.
   * Called at the end of a test run.
   */
  assertAllFramesCompared(): void {
    if (this._framesCompared !== this._numberFrames) {
      throw new Error(
        `The scene tested contained ${this._framesCompared} frames, ` +
          `when there are ${this._numberFrames} control frames for this test.`,
      );
    }
  }

  /**
   * Compare a rendered frame against the control frame at the given index.
   *
   * Tolerates small pixel mismatches (below FRAME_MISMATCH_RATIO_TOLERANCE).
   *
   * @param frameNumber - Index of the frame to compare.
   * @param frame - The rendered frame data (RGBA Uint8Array).
   */
  checkFrame(frameNumber: number, frame: PixelArray): void {
    // Support negative indices (e.g. -1 for last frame)
    const idx = frameNumber < 0 ? this._numberFrames + frameNumber : frameNumber;

    if (idx < 0 || idx >= this._numberFrames) {
      throw new Error(
        `The tested scene is at frame number ${frameNumber} ` +
          `when there are ${this._numberFrames} control frames.`,
      );
    }

    const controlFrame = this._frames[idx];

    // Quick allclose check
    if (framesAllClose(frame, controlFrame, FRAME_ABSOLUTE_TOLERANCE)) {
      this._framesCompared++;
      return;
    }

    // Count mismatches
    const totalPixelValues = frame.length;
    let mismatchCount = 0;
    for (let i = 0; i < totalPixelValues; i++) {
      if (Math.abs(frame[i] - controlFrame[i]) > FRAME_ABSOLUTE_TOLERANCE) {
        mismatchCount++;
      }
    }

    if (mismatchCount / totalPixelValues < FRAME_MISMATCH_RATIO_TOLERANCE) {
      // Tolerable mismatch
      this._framesCompared++;
      console.warn(
        `Mismatch of ${mismatchCount} pixel values in frame ${frameNumber} ` +
          `against control data in ${this._filePath}. Below error threshold, continuing...`,
      );
      return;
    }

    // Significant mismatch — show diff if requested, then throw
    if (this._showDiff) {
      showDiffHelper(
        frameNumber,
        frame,
        controlFrame,
        path.basename(this._filePath),
      );
    }

    throw new Error(
      `Frame ${frameNumber} does not match control data. ` +
        `${mismatchCount} pixel value mismatches out of ${totalPixelValues}. ` +
        `You can enable showDiff to visually inspect the difference.`,
    );
  }
}

/**
 * Writes control frame data to disk for later comparison.
 *
 * Used when generating new reference data (equivalent to pytest --set_test).
 */
export class _ControlDataWriter extends _FramesTester {
  private _writtenFrames: PixelArray[] = [];
  private _numberFramesWritten: number = 0;
  private _width: number;
  private _height: number;

  constructor(filePath: string, sizeFrame: [number, number]) {
    super(filePath, false);
    this._height = sizeFrame[0];
    this._width = sizeFrame[1];
  }

  /**
   * Capture a frame for writing (overrides checkFrame to collect instead of compare).
   */
  override checkFrame(_index: number, frame: PixelArray): void {
    this._writtenFrames.push(new Uint8Array(frame));
    this._numberFramesWritten++;
  }

  /**
   * No-op for writer — loading frames is not needed when writing.
   */
  override loadFrames(): void {
    // No-op: we are creating frames, not loading them.
  }

  /**
   * No-op for writer — all frames check is not relevant when writing.
   */
  override assertAllFramesCompared(): void {
    // No-op: we are writing, not comparing.
  }

  /**
   * Save the collected control data to disk.
   */
  saveControlData(): void {
    const dir = path.dirname(this._filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      width: this._width,
      height: this._height,
      frames: this._writtenFrames.map((f) =>
        Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString("base64"),
      ),
    };

    fs.writeFileSync(this._filePath, JSON.stringify(data), "utf-8");
    logger.info(
      `${this._numberFramesWritten} control frames saved in ${this._filePath}`,
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Check if two frame buffers are element-wise close within tolerance.
 */
function framesAllClose(
  a: PixelArray,
  b: PixelArray,
  atol: number,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > atol) return false;
  }
  return true;
}
