/**
 * OpenGL utility functions for manim-ts.
 * TypeScript port of manim/utils/opengl.py.
 *
 * Provides projection, transformation, and view matrix helpers
 * for use with OpenGL/WebGL rendering pipelines.
 */

import { np, linalg } from "../../core/math/index.js";
import type { NDArray } from "../../core/math/index.js";
import { config } from "../../_config/index.js";

import type { MatrixMN, Point3D } from "../../typing/index.js";

export const depth = 20;

/**
 * A 4x4 matrix flattened column-major into a 16-element tuple,
 * suitable for passing to a shader uniform.
 */
export type FlattenedMatrix4x4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

/**
 * Transpose and flatten a matrix into shader-compatible column-major format.
 * Mirrors Python: `tuple(matrix.T.ravel())`
 */
export function matrixToShaderInput(matrix: MatrixMN): FlattenedMatrix4x4 {
  // matrix.T may return ArrayStorage; wrap with np.array() to get NDArray methods
  const transposed = np.array(matrix.T);
  const flat = transposed.flatten().toArray() as number[];
  return flat as unknown as FlattenedMatrix4x4;
}

/**
 * Build an orthographic projection matrix.
 *
 * @param width  - Logical frame width (defaults to config.frameWidth)
 * @param height - Logical frame height (defaults to config.frameHeight)
 * @param near   - Near clipping plane distance (default 1)
 * @param far    - Far clipping plane distance (default depth + 1)
 * @param format_ - If true, returns a flattened FlattenedMatrix4x4; otherwise raw NDArray
 */
export function orthographicProjectionMatrix(
  width: number | null = null,
  height: number | null = null,
  near: number = 1,
  far: number = depth + 1,
  format_: boolean = true,
): MatrixMN | FlattenedMatrix4x4 {
  const w = width ?? config.frameWidth;
  const h = height ?? config.frameHeight;

  const projectionMatrix = np.array([
    [2 / w, 0, 0, 0],
    [0, 2 / h, 0, 0],
    [0, 0, -2 / (far - near), -(far + near) / (far - near)],
    [0, 0, 0, 1],
  ]);

  if (format_) {
    return matrixToShaderInput(projectionMatrix);
  }
  return projectionMatrix;
}

/**
 * Build a perspective projection matrix.
 *
 * @param width  - Logical frame width / 6 (defaults to config.frameWidth / 6)
 * @param height - Logical frame height / 6 (defaults to config.frameHeight / 6)
 * @param near   - Near clipping plane (default 2)
 * @param far    - Far clipping plane (default 50)
 * @param format_ - If true, returns a flattened FlattenedMatrix4x4; otherwise raw NDArray
 */
export function perspectiveProjectionMatrix(
  width: number | null = null,
  height: number | null = null,
  near: number = 2,
  far: number = 50,
  format_: boolean = true,
): MatrixMN | FlattenedMatrix4x4 {
  const w = width ?? config.frameWidth / 6;
  const h = height ?? config.frameHeight / 6;

  const projectionMatrix = np.array([
    [2 * near / w, 0, 0, 0],
    [0, 2 * near / h, 0, 0],
    [0, 0, (far + near) / (near - far), (2 * far * near) / (near - far)],
    [0, 0, -1, 0],
  ]);

  if (format_) {
    return matrixToShaderInput(projectionMatrix);
  }
  return projectionMatrix;
}

/**
 * Build a 4x4 translation matrix.
 */
export function translationMatrix(x: number = 0, y: number = 0, z: number = 0): MatrixMN {
  return np.array([
    [1, 0, 0, x],
    [0, 1, 0, y],
    [0, 0, 1, z],
    [0, 0, 0, 1],
  ]);
}

/**
 * Build a 4x4 rotation matrix around the X axis.
 *
 * @param x - Rotation angle in radians
 */
export function xRotationMatrix(x: number = 0): MatrixMN {
  return np.array([
    [1, 0, 0, 0],
    [0, Math.cos(x), -Math.sin(x), 0],
    [0, Math.sin(x), Math.cos(x), 0],
    [0, 0, 0, 1],
  ]);
}

/**
 * Build a 4x4 rotation matrix around the Y axis.
 *
 * @param y - Rotation angle in radians
 */
export function yRotationMatrix(y: number = 0): MatrixMN {
  return np.array([
    [Math.cos(y), 0, Math.sin(y), 0],
    [0, 1, 0, 0],
    [-Math.sin(y), 0, Math.cos(y), 0],
    [0, 0, 0, 1],
  ]);
}

/**
 * Build a 4x4 rotation matrix around the Z axis.
 *
 * @param z - Rotation angle in radians
 */
export function zRotationMatrix(z: number = 0): MatrixMN {
  return np.array([
    [Math.cos(z), -Math.sin(z), 0, 0],
    [Math.sin(z), Math.cos(z), 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ]);
}

/**
 * Build a combined rotation matrix for Euler angles (X → Y → Z order).
 *
 * @param x - Rotation around X axis in radians
 * @param y - Rotation around Y axis in radians
 * @param z - Rotation around Z axis in radians
 */
export function rotationMatrix(x: number = 0, y: number = 0, z: number = 0): MatrixMN {
  // np.matmul(np.matmul(xR, yR), zR)
  const xy = np.matmul(xRotationMatrix(x), yRotationMatrix(y)) as NDArray;
  return np.matmul(xy, zRotationMatrix(z)) as NDArray;
}

/**
 * Build a matrix that rotates a point around its current position.
 *
 * TODO: When rotating around the x axis, rotation eventually stops.
 *
 * @param initialPosition - The pivot point
 * @param x - Rotation around X axis in radians
 * @param y - Rotation around Y axis in radians
 * @param z - Rotation around Z axis in radians
 */
export function rotateInPlaceMatrix(
  initialPosition: Point3D,
  x: number = 0,
  y: number = 0,
  z: number = 0,
): MatrixMN {
  const pos = initialPosition.toArray() as number[];
  const negPos = translationMatrix(-pos[0], -pos[1], -pos[2]);
  const rot = rotationMatrix(x, y, z);
  const posT = translationMatrix(pos[0], pos[1], pos[2]);

  // translate_to_origin @ rotate @ translate_back
  const inner = np.matmul(rot, posT) as NDArray;
  return np.matmul(negPos, inner) as NDArray;
}

/**
 * Build a uniform scale matrix.
 *
 * @param scaleFactor - Uniform scale (default 1)
 */
export function scaleMatrix(scaleFactor: number = 1): NDArray {
  return np.array([
    [scaleFactor, 0, 0, 0],
    [0, scaleFactor, 0, 0],
    [0, 0, scaleFactor, 0],
    [0, 0, 0, 1],
  ]);
}

/**
 * Build a view matrix (the inverse of the model matrix).
 *
 * The view matrix transforms world coordinates into camera/eye space.
 *
 * @param translation - Camera position in world space
 * @param xRotation   - Rotation around X axis in radians
 * @param yRotation   - Rotation around Y axis in radians
 * @param zRotation   - Rotation around Z axis in radians
 */
export function viewMatrix(
  translation: Point3D | null = null,
  xRotation: number = 0,
  yRotation: number = 0,
  zRotation: number = 0,
): FlattenedMatrix4x4 {
  const trans = translation ?? np.array([0, 0, depth / 2 + 1]);
  const transArr = trans.toArray() as number[];

  const tMat = translationMatrix(transArr[0], transArr[1], transArr[2]);
  const rMat = rotationMatrix(xRotation, yRotation, zRotation);
  const sMat = scaleMatrix();

  // model = translation @ rotation @ scale
  const tr = np.matmul(tMat, rMat) as NDArray;
  const modelMatrix = np.matmul(tr, sMat) as NDArray;

  // view = inv(model).T.ravel()  → column-major shader input
  // linalg.inv returns ArrayStorage; wrap with np.array() to get NDArray methods
  const inv = np.array(linalg.inv(modelMatrix));
  const flat = np.array(inv.T).flatten().toArray() as number[];
  return flat as unknown as FlattenedMatrix4x4;
}
