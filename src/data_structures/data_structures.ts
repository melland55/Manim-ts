/**
 * Data classes and other necessary data structures for use in Manim.
 * Python: manim.data_structures
 */

/** A callable method stored with its intended positional and keyword arguments,
 * to be invoked later via `method(...args, kwargs)`.
 */
export class MethodWithArgs {
  method: (...args: unknown[]) => unknown;
  args: unknown[];
  kwargs: Record<string, unknown>;

  constructor(
    method: (...args: unknown[]) => unknown,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ) {
    this.method = method;
    this.args = args;
    this.kwargs = kwargs;
  }

  /** Invoke the stored method with its args and kwargs. */
  call(...extraArgs: unknown[]): unknown {
    return this.method(...this.args, ...extraArgs, this.kwargs);
  }
}
