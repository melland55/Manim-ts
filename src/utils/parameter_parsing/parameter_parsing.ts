/**
 * Utility functions for parsing and normalizing parameters.
 * Python: manim.utils.parameter_parsing
 */

/**
 * Flattens an iterable of parameters into a flat array.
 *
 * Each element in `args` may itself be iterable (array, generator, etc.),
 * in which case its contents are spread into the result. Non-iterable
 * elements are appended as-is.
 *
 * @param args - The iterable of parameters to flatten one level deep.
 * @returns A flat array of all parameters.
 */
export function flattenIterableParameters<T>(
  args: Iterable<T | Iterable<T>>
): T[] {
  const result: T[] = [];
  for (const arg of args) {
    if (isIterable(arg)) {
      for (const item of arg as Iterable<T>) {
        result.push(item);
      }
    } else {
      result.push(arg as T);
    }
  }
  return result;
}

/**
 * Type guard: returns true if `value` is a non-string iterable object.
 * Strings are excluded because iterating a string yields characters,
 * which is never the intended behaviour in Manim parameter contexts.
 */
function isIterable<T>(value: T | Iterable<T>): value is Iterable<T> {
  return (
    value !== null &&
    value !== undefined &&
    typeof value !== "string" &&
    typeof (value as Iterable<T>)[Symbol.iterator] === "function"
  );
}
