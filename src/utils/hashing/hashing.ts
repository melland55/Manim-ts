/**
 * Utilities for scene caching.
 * Mirrors manim/utils/hashing.py
 */

import { performance } from "perf_hooks";
import type { IAnimation, ICamera, IMobject, IScene } from "../../core/types.js";
import { config, logger } from "../../_config/index.js";

// ─── Public constants ──────────────────────────────────────────────────────

/**
 * Keys filtered out during hashing because they are either too long or
 * run-dependent.
 */
export const KEYS_TO_FILTER_OUT = new Set<string>([
  "original_id",
  "background",
  "pixel_array",
  "pixel_array_to_cairo_context",
]);

// ─── CRC32 ────────────────────────────────────────────────────────────────

const _CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = (_CRC32_TABLE[(crc ^ (buffer[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Object identity tracking ─────────────────────────────────────────────

const _objectIdMap = new WeakMap<object, number>();
let _nextObjectId = 0;

function getObjectId(obj: object): number {
  if (!_objectIdMap.has(obj)) {
    _objectIdMap.set(obj, _nextObjectId++);
  }
  return _objectIdMap.get(obj)!;
}

// ─── NDArray duck-typing ───────────────────────────────────────────────────

interface NDArrayLike {
  shape: number[];
  size: number;
  toString(): string;
}

function isNDArray(obj: unknown): obj is NDArrayLike {
  if (obj === null || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    Array.isArray(o["shape"]) &&
    typeof o["size"] === "number" &&
    typeof o["toArray"] === "function"
  );
}

// ─── _Memoizer ────────────────────────────────────────────────────────────

/**
 * Implements memoization logic to optimize hashing and prevent processing
 * circular references within iterable objects.
 *
 * Keeps a record of all processed objects and returns ALREADY_PROCESSED_PLACEHOLDER
 * when the same object is encountered again. Uses object identity (WeakMap-based IDs)
 * for non-primitive types.
 *
 * Mirrors Python manim/utils/hashing.py _Memoizer.
 */
export class _Memoizer {
  private static _alreadyProcessed = new Set<number | string>();

  /** Placeholder returned for already-processed objects. */
  static readonly ALREADY_PROCESSED_PLACEHOLDER = "AP";
  /** Warn when this many objects have been processed. */
  static readonly THRESHOLD_WARNING = 170_000;

  /** Reset the processed-objects tracking set. */
  static resetAlreadyProcessed(): void {
    _Memoizer._alreadyProcessed.clear();
  }

  /**
   * Returns a function wrapper that checks whether the argument has already
   * been processed, returning ALREADY_PROCESSED_PLACEHOLDER if so.
   *
   * @param isMethod - Whether to preserve `this` binding.
   */
  static checkAlreadyProcessedDecorator(
    isMethod = false,
  ): (func: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown {
    return (func) => {
      if (isMethod) {
        return function (this: unknown, obj: unknown): unknown {
          return _Memoizer._handleAlreadyProcessed(obj, (o) =>
            func.call(this, o),
          );
        };
      }
      return (obj: unknown): unknown =>
        _Memoizer._handleAlreadyProcessed(obj, func as (o: unknown) => unknown);
    };
  }

  /**
   * Returns the object if it has not been processed yet, or
   * ALREADY_PROCESSED_PLACEHOLDER if it has. Marks as processed on first visit.
   */
  static checkAlreadyProcessed(obj: unknown): unknown {
    return _Memoizer._handleAlreadyProcessed(obj, (x) => x);
  }

  /**
   * Marks an object as processed without returning a value.
   */
  static markAsProcessed(obj: unknown): void {
    _Memoizer._handleAlreadyProcessed(obj, (x) => x);
  }

  private static _handleAlreadyProcessed(
    obj: unknown,
    defaultFunction: (obj: unknown) => unknown,
  ): unknown {
    // Primitive types bypass memoization (they cannot cause cycles)
    if (
      (typeof obj === "number" ||
        typeof obj === "string" ||
        typeof obj === "boolean") &&
      obj !== _Memoizer.ALREADY_PROCESSED_PLACEHOLDER
    ) {
      return obj;
    }

    // Objects and functions: use identity-based tracking
    if (
      obj !== null &&
      obj !== undefined &&
      (typeof obj === "object" || typeof obj === "function")
    ) {
      const id = getObjectId(obj as object);
      if (_Memoizer._alreadyProcessed.has(id)) {
        return _Memoizer.ALREADY_PROCESSED_PLACEHOLDER;
      }
      if (
        !config.disableCachingWarning &&
        _Memoizer._alreadyProcessed.size === _Memoizer.THRESHOLD_WARNING
      ) {
        logger.warning(
          "It looks like the scene contains a lot of sub-mobjects. Caching " +
            "is sometimes not suited to handle such large scenes, you might " +
            "consider disabling caching with --disable_caching to potentially " +
            "speed up the rendering process.",
        );
        logger.warning(
          "You can disable this warning by setting disable_caching_warning " +
            "to True in your config file.",
        );
      }
      _Memoizer._alreadyProcessed.add(id);
      return defaultFunction(obj);
    }

    // null / undefined — use fixed sentinel keys
    const key = obj === null ? "__null__" : "__undefined__";
    if (_Memoizer._alreadyProcessed.has(key)) {
      return _Memoizer.ALREADY_PROCESSED_PLACEHOLDER;
    }
    _Memoizer._alreadyProcessed.add(key);
    return defaultFunction(obj);
  }
}

// ─── _CustomEncoder ───────────────────────────────────────────────────────

/**
 * Custom JSON encoder that handles Manim-specific types.
 *
 * Mirrors Python _CustomEncoder(json.JSONEncoder):
 *  - Functions/methods → {code, nonlocals}
 *  - NDArrays → string repr (truncated if > 1000 elements)
 *  - Objects with properties → their enumerable own-property dict
 *  - Circular references → replaced with ALREADY_PROCESSED_PLACEHOLDER
 *
 * Note: JavaScript does not expose closure variables, so `nonlocals` is always
 * an empty object (unlike the Python implementation which can introspect closures).
 */
class _CustomEncoder {
  /**
   * Serialize `obj` to a JSON string.
   *
   * Marks the top-level object as processed, then delegates to the appropriate
   * serializer based on the object's type.
   */
  encode(obj: unknown): string {
    _Memoizer.markAsProcessed(obj);

    let serialized: unknown;
    if (Array.isArray(obj)) {
      serialized = this._processArray(obj);
    } else if (typeof obj === "object" && obj !== null && !isNDArray(obj)) {
      serialized = this._processObject(obj as Record<string, unknown>);
    } else {
      serialized = this._defaultConvert(obj);
    }

    return JSON.stringify(serialized);
  }

  /**
   * Convert a value to a JSON-serializable form.
   *
   * Handles functions, NDArrays, and objects with enumerable properties.
   * Primitives and null are passed through unchanged.
   */
  private _defaultConvert(obj: unknown): unknown {
    if (obj === null || obj === undefined) return null;

    if (
      typeof obj === "number" ||
      typeof obj === "boolean" ||
      typeof obj === "string"
    ) {
      return obj;
    }

    if (typeof obj === "bigint") {
      return Number(obj);
    }

    if (typeof obj === "function") {
      let code = "";
      try {
        code = (obj as (...args: unknown[]) => unknown).toString();
      } catch {
        // Functions defined in native code may throw
      }
      // JavaScript does not expose closure variables at runtime
      const nonlocals: Record<string, unknown> = {};
      return this._processObject({ code, nonlocals });
    }

    if (isNDArray(obj)) {
      const arr = obj as NDArrayLike;
      if (arr.size > 1000) {
        return `TRUNCATED ARRAY: ${arr.toString()}`;
      }
      return arr.toString();
    }

    if (typeof obj === "object") {
      return this._processObject(obj as Record<string, unknown>);
    }

    // Symbol, unknown types
    return String(typeof obj);
  }

  /**
   * Process an array, applying memoizer checks to each element and recursing
   * into nested arrays and objects.
   */
  private _processArray(lst: unknown[]): unknown[] {
    const result: unknown[] = new Array(lst.length) as unknown[];
    for (let i = 0; i < lst.length; i++) {
      const el = lst[i];
      const checked = _Memoizer.checkAlreadyProcessed(el);

      if (checked === _Memoizer.ALREADY_PROCESSED_PLACEHOLDER) {
        result[i] = _Memoizer.ALREADY_PROCESSED_PLACEHOLDER;
        continue;
      }

      if (Array.isArray(el)) {
        result[i] = this._processArray(el);
      } else if (isNDArray(el)) {
        result[i] = this._defaultConvert(el);
      } else if (typeof el === "object" && el !== null) {
        result[i] = this._processObject(el as Record<string, unknown>);
      } else {
        result[i] = this._defaultConvert(el);
      }
    }
    return result;
  }

  /**
   * Process a dict-like object:
   * - Skips keys in KEYS_TO_FILTER_OUT
   * - Converts non-JSON-safe keys to their CRC32 hash
   * - Applies memoizer checks to each value
   * - Recurses into nested objects and arrays
   */
  private _processObject(
    dct: Record<string, unknown>,
  ): Record<string | number, unknown> {
    const result: Record<string | number, unknown> = {};

    for (const [k, v] of Object.entries(dct)) {
      if (KEYS_TO_FILTER_OUT.has(k)) continue;

      // Memoize-check the value
      const checked = _Memoizer.checkAlreadyProcessed(v);

      // JSON requires string/number/boolean/null keys; hash anything else
      const key: string | number =
        typeof k === "string" ||
        typeof k === "number" ||
        typeof k === "boolean" ||
        k === null
          ? (k as string | number)
          : this._keyToHash(k);

      let newValue: unknown;
      if (checked === _Memoizer.ALREADY_PROCESSED_PLACEHOLDER) {
        newValue = _Memoizer.ALREADY_PROCESSED_PLACEHOLDER;
      } else if (Array.isArray(v)) {
        newValue = this._processArray(v);
      } else if (isNDArray(v)) {
        newValue = this._defaultConvert(v);
      } else if (typeof v === "object" && v !== null) {
        newValue = this._processObject(v as Record<string, unknown>);
      } else {
        newValue = this._defaultConvert(v);
      }

      result[key] = newValue;
    }

    return result;
  }

  /**
   * Compute a CRC32 hash of the key's JSON representation.
   * Used when a dict key cannot be represented as a JSON primitive.
   */
  private _keyToHash(key: unknown): number {
    const json = new _CustomEncoder().encode(key);
    return crc32(Buffer.from(json, "utf-8"));
  }
}

// ─── Public functions ──────────────────────────────────────────────────────

/**
 * Recursively serialize `obj` to JSON using the custom encoder.
 *
 * Handles Manim-specific types (functions, NDArrays, custom objects) and
 * detects circular references, replacing them with ALREADY_PROCESSED_PLACEHOLDER.
 *
 * Mirrors Python `manim.utils.hashing.get_json`.
 *
 * @param obj - The object to serialize.
 * @returns A JSON string.
 */
export function getJson(obj: unknown): string {
  return new _CustomEncoder().encode(obj);
}

/**
 * Compute a cache hash for a `scene.play(...)` call.
 *
 * Serializes the camera, animations (sorted by string representation), and
 * current mobjects, then computes a CRC32 hash of each serialized form.
 * Returns a string of the form `"{cameraHash}_{animationsHash}_{mobjectsHash}"`.
 *
 * Mirrors Python `manim.utils.hashing.get_hash_from_play_call`.
 *
 * @param sceneObject          The scene — marked as processed so it is excluded
 *                             from the hash computation.
 * @param cameraObject         The camera object used in the scene.
 * @param animationsList       The list of animations to play.
 * @param currentMobjectsList  The mobjects currently on the scene.
 * @returns A hash string.
 */
export function getHashFromPlayCall(
  sceneObject: IScene,
  cameraObject: ICamera,
  animationsList: Iterable<IAnimation>,
  currentMobjectsList: Iterable<IMobject>,
): string {
  logger.debug("Hashing ...");
  const tStart = performance.now();

  // Exclude the scene object itself from hashing
  _Memoizer.markAsProcessed(sceneObject);

  const cameraJson = getJson(cameraObject);

  const animationsSorted = [...animationsList].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
  const animationsListJson = animationsSorted.map((x) => getJson(x));

  const currentMobjectsListJson = [...currentMobjectsList].map((x) =>
    getJson(x),
  );

  const hashCamera = crc32(Buffer.from(repr(cameraJson), "utf-8"));
  const hashAnimations = crc32(Buffer.from(repr(animationsListJson), "utf-8"));
  const hashCurrentMobjects = crc32(
    Buffer.from(repr(currentMobjectsListJson), "utf-8"),
  );

  const hashComplete = `${hashCamera}_${hashAnimations}_${hashCurrentMobjects}`;

  const tEnd = performance.now();
  const elapsedSec = ((tEnd - tStart) / 1000).toFixed(6).slice(0, 8);
  logger.debug("Hashing done in %(time)s s.", { time: elapsedSec });

  // Reset memoizer state after hashing
  _Memoizer.resetAlreadyProcessed();

  logger.debug("Hash generated :  %(h)s", { h: hashComplete });
  return hashComplete;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Python-style repr for computing hashes of JSON values.
 *
 * Python's `repr(json_val)` on a string wraps it in single quotes; on a list
 * it uses square brackets with repr of each element. We approximate this for
 * the purpose of consistent hash computation.
 */
function repr(value: unknown): string {
  if (typeof value === "string") {
    // Mirror Python's repr(str): wrap in single quotes, escape single quotes
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  if (Array.isArray(value)) {
    return `[${(value as unknown[]).map(repr).join(", ")}]`;
  }
  return String(value);
}
