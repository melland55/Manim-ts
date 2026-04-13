/**
 * Visual diff helper for frame comparison tests.
 *
 * TypeScript port of manim/utils/testing/_show_diff.py.
 *
 * In Python Manim this uses matplotlib to display frame differences.
 * In the TS port we write a simple PNG diff image using sharp instead,
 * since matplotlib is not available in Node.js.
 */

import { logger } from "../../_config/index.js";

/** Raw RGBA pixel data. */
type PixelArray = Uint8Array;

/**
 * Visually show differences between a generated frame and the expected frame.
 *
 * In the Python version this opens a matplotlib window; here we log the
 * mismatch details. A full visual diff would require a rendering library —
 * mark as a TODO for optional sharp-based image output.
 *
 * @param frameNumber - The frame index that mismatched.
 * @param frameData - The rendered frame (RGBA Uint8Array).
 * @param expectedFrameData - The expected control frame (RGBA Uint8Array).
 * @param controlDataFilename - Name of the control data file for labelling.
 */
export function showDiffHelper(
  frameNumber: number,
  frameData: PixelArray,
  expectedFrameData: PixelArray,
  controlDataFilename: string,
): void {
  // Count mismatched pixels
  let mismatchCount = 0;
  const totalPixels = Math.min(frameData.length, expectedFrameData.length) / 4;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    if (
      frameData[offset] !== expectedFrameData[offset] ||
      frameData[offset + 1] !== expectedFrameData[offset + 1] ||
      frameData[offset + 2] !== expectedFrameData[offset + 2] ||
      frameData[offset + 3] !== expectedFrameData[offset + 3]
    ) {
      mismatchCount++;
    }
  }

  const mismatchPercent = totalPixels > 0 ? (mismatchCount / totalPixels) * 100 : 0;

  logger.warning(
    `Frame ${frameNumber} diff summary for ${controlDataFilename}: ` +
      `${mismatchCount}/${totalPixels} pixels differ (${mismatchPercent.toFixed(3)}%). ` +
      `Use a visual diff tool to inspect the control data file.`,
  );

  // TODO: Port visual diff — optionally write a composite PNG via sharp
  // showing generated / expected / diff side by side.
}
