/**
 * Barrel export for the matrix module.
 * TypeScript port of manim/mobject/matrix.py
 */

export {
  Matrix,
  DecimalMatrix,
  IntegerMatrix,
  MobjectMatrix,
  matrixToTexString,
  matrixToMobject,
  getDetText,
} from "./matrix.js";

export type {
  MatrixOptions,
  DecimalMatrixOptions,
  IntegerMatrixOptions,
  MobjectMatrixOptions,
} from "./matrix.js";
