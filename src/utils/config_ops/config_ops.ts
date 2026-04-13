/**
 * Utilities for configuration dictionaries.
 * TypeScript port of manim/utils/config_ops.py
 */

export type AnyDict = Record<string, unknown>;

/**
 * Creates a dict whose keyset is the union of all input dictionaries.
 * The value for each key is based on the last dict in the list with that key.
 * Dicts later in the list have higher priority.
 * When values are plain objects, it is applied recursively.
 */
export function mergeDictsRecursively(...dicts: AnyDict[]): AnyDict {
  const result: AnyDict = {};
  for (const d of dicts) {
    for (const [key, value] of Object.entries(d)) {
      if (
        key in result &&
        isPlainObject(result[key]) &&
        isPlainObject(value)
      ) {
        result[key] = mergeDictsRecursively(
          result[key] as AnyDict,
          value as AnyDict
        );
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Updates `currentDict` in-place with the merged result of itself and all
 * subsequent dicts (later entries have higher priority).
 */
export function updateDictRecursively(
  currentDict: AnyDict,
  ...others: AnyDict[]
): void {
  const updated = mergeDictsRecursively(currentDict, ...others);
  for (const [key, value] of Object.entries(updated)) {
    currentDict[key] = value;
  }
}

/**
 * Wraps a plain dict so its keys are accessible as object properties.
 * Convenient for writing `obj.x` instead of `obj["x"]`.
 */
export class DictAsObject {
  [key: string]: unknown;

  constructor(dictin: Record<string, unknown>) {
    Object.assign(this, dictin);
  }
}

// ─── Descriptor helpers ──────────────────────────────────────────────────────

/**
 * Protocol for objects that hold a `data` bag of NDArray values.
 * Mirrors Python's `_HasData` protocol.
 */
export interface HasData {
  data: Record<string, unknown>;
}

/**
 * Descriptor that proxies `obj.attr` to/from `obj.data["attr"]`.
 * Mirrors Python's `_Data` generic descriptor.
 *
 * Usage:
 *   class Foo implements HasData {
 *     data: Record<string, unknown> = {};
 *     points = new DataDescriptor<NDArray>("points");
 *   }
 *
 * TypeScript doesn't support Python-style class-level descriptors natively,
 * so this is provided as a helper class that callers can use explicitly.
 */
export class DataDescriptor<T> {
  constructor(private readonly name: string) {}

  get(obj: HasData): T {
    return obj.data[this.name] as T;
  }

  set(obj: HasData, value: T): void {
    obj.data[this.name] = value;
  }
}

/**
 * Protocol for objects that hold a `uniforms` bag of float/tuple values.
 * Mirrors Python's `_HasUniforms` protocol.
 */
export interface HasUniforms {
  uniforms: Record<string, number | readonly number[]>;
}

/**
 * Descriptor that proxies `obj.attr` to/from `obj.uniforms["attr"]`.
 * Mirrors Python's `_Uniforms` generic descriptor.
 */
export class UniformsDescriptor<T extends number | readonly number[]> {
  constructor(private readonly name: string) {}

  get(obj: HasUniforms): T {
    return obj.uniforms[this.name] as T;
  }

  set(obj: HasUniforms, value: T): void {
    obj.uniforms[this.name] = value;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is AnyDict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
