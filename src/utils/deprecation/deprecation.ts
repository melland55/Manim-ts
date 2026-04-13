/**
 * Decorators for deprecating classes, functions and function parameters.
 *
 * Python source: manim/utils/deprecation.py
 */

import { getLogger } from "../../_config/logger_utils/index.js";

const logger = getLogger("manim");

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyConstructor = new (...args: any[]) => unknown;
type Callable = AnyFunction | AnyConstructor;

export interface DeprecatedOptions {
  since?: string;
  until?: string;
  replacement?: string;
  message?: string;
}

export type Redirector =
  | [string, string]
  | ((...args: unknown[]) => Record<string, unknown>);

export interface DeprecatedParamsOptions {
  params?: string | Iterable<string>;
  since?: string;
  until?: string;
  message?: string;
  redirections?: Iterable<Redirector>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns [type, name] of a callable.
 * type is "class", "method", or "function".
 */
function _getCallableInfo(callable_: Callable): [string, string] {
  const name = callable_.name || "anonymous";
  const fnStr = callable_.toString().trimStart();
  let what: string;
  if (/^class[\s{]/.test(fnStr)) {
    what = "class";
  } else if (name.includes(".")) {
    what = "method";
  } else {
    what = "function";
  }
  return [what, name];
}

/**
 * Generates the text component used in deprecation messages.
 */
function _deprecationTextComponent(
  since?: string | null,
  until?: string | null,
  message?: string | null,
): string {
  const sinceStr = since ? `since ${since} ` : "";
  const untilStr = until
    ? `is expected to be removed after ${until}`
    : "may be removed in a later version";
  const msgStr = message ? " " + message : "";
  return `deprecated ${sinceStr}and ${untilStr}.${msgStr}`;
}

/**
 * Detects whether a function value is a class constructor.
 */
function _isClass(fn: Callable): fn is AnyConstructor {
  return /^\s*class[\s{]/.test(fn.toString());
}

/**
 * Extract parameter names from a function by inspecting its source string.
 * Mirrors Python's `inspect.signature(fn).parameters`.
 *
 * Works for arrow functions and regular functions in non-minified code.
 */
function _getParamNames(fn: (...args: unknown[]) => unknown): string[] {
  const fnStr = fn
    .toString()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "")
    .trim();

  // Arrow function with parens: (a, b = 1) => ...
  const arrowParens = fnStr.match(/^\(([^)]*)\)\s*=>/);
  // Arrow function without parens: a => ...
  const arrowSingle = fnStr.match(/^(\w+)\s*=>/);
  // Regular / async function: function name(a, b) or function(a, b)
  const regularFunc = fnStr.match(/^(?:async\s+)?function\s*\w*\s*\(([^)]*)\)/);

  let paramStr: string;
  if (arrowParens) {
    paramStr = arrowParens[1];
  } else if (arrowSingle) {
    const p = arrowSingle[1].trim();
    return p ? [p] : [];
  } else if (regularFunc) {
    paramStr = regularFunc[1];
  } else {
    return [];
  }

  return paramStr
    .split(",")
    .map((p) => p.trim().split("=")[0].trim().split(":")[0].trim())
    .filter((p) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p));
}

// ─── deprecated ───────────────────────────────────────────────────────────────

/**
 * Wrap `func` with deprecation warning logging and docstring annotation.
 * Internal implementation shared by all overloads.
 */
function _applyDeprecated<T extends Callable>(
  func: T,
  options: DeprecatedOptions,
): T {
  const { since, until, replacement, message = "" } = options;
  const [what, name] = _getCallableInfo(func);

  function warningMsg(forDocs = false): string {
    let msg: string = message;
    if (replacement != null) {
      let repl = replacement;
      if (forDocs) {
        const mapper: Record<string, string> = {
          class: "class",
          method: "meth",
          function: "func",
        };
        repl = `:${mapper[what]}:\`~.${replacement}\``;
      }
      msg = `Use ${repl} instead.${message ? " " + message : ""}`;
    }
    const dep = _deprecationTextComponent(since, until, msg || undefined);
    return `The ${what} ${name} has been ${dep}`;
  }

  if (_isClass(func)) {
    const OrigClass = func as AnyConstructor;

    // Wrap via a Proxy so instanceof checks and prototype chain are preserved
    const handler: ProxyHandler<AnyConstructor> = {
      construct(
        target: AnyConstructor,
        args: unknown[],
        newTarget: AnyConstructor,
      ): object {
        logger.warning(warningMsg());
        return Reflect.construct(target, args, newTarget) as object;
      },
    };

    const wrapped = new Proxy(OrigClass, handler);
    return wrapped as unknown as T;
  } else {
    const fn = func as AnyFunction;

    function wrapper(this: unknown, ...args: unknown[]): unknown {
      logger.warning(warningMsg());
      return fn.apply(this, args);
    }

    // Preserve name and length for introspection
    Object.defineProperty(wrapper, "name", { value: fn.name, configurable: true });
    Object.defineProperty(wrapper, "length", {
      value: fn.length,
      configurable: true,
    });

    // Adjust docstring (represented as a property for TypeScript purposes)
    const fnRecord = fn as unknown as Record<string, unknown>;
    const wrapperRecord = wrapper as unknown as Record<string, unknown>;
    const docString = fnRecord.__doc__ as string | undefined;
    const warning = warningMsg(true);
    wrapperRecord.__doc__ = `${docString ?? ""}\n\n.. attention:: Deprecated\n  ${warning}`;

    return wrapper as unknown as T;
  }
}

/**
 * Decorator to mark a callable as deprecated.
 *
 * The decorated callable will log a warning when invoked. Can be used:
 *   - directly:   `const wrapped = deprecated(myFn)`
 *   - as factory: `const wrapped = deprecated({ since: "v0.2" })(myFn)`
 *
 * @param funcOrOptions  The callable to wrap, or an options object (factory mode).
 * @param options        Deprecation options when `funcOrOptions` is a callable.
 */
export function deprecated<T extends Callable>(func: T): T;
export function deprecated<T extends Callable>(
  func: T,
  options: DeprecatedOptions,
): T;
export function deprecated(
  options?: DeprecatedOptions,
): <T extends Callable>(func: T) => T;
export function deprecated<T extends Callable>(
  funcOrOptions?: T | DeprecatedOptions,
  options?: DeprecatedOptions,
): T | ((func: T) => T) {
  if (typeof funcOrOptions === "function") {
    return _applyDeprecated(funcOrOptions as T, options ?? {});
  }
  // Factory mode: deprecated() or deprecated({ since: ... })
  const opts = (funcOrOptions as DeprecatedOptions | undefined) ?? {};
  return (func: T): T => _applyDeprecated(func, opts);
}

// ─── deprecated_params ────────────────────────────────────────────────────────

/**
 * Decorator to mark parameters of a callable as deprecated.
 *
 * Works with functions whose keyword arguments are passed as a single plain
 * object (the TypeScript equivalent of Python's `**kwargs` pattern).
 *
 * @param options  Configuration for the deprecated parameters.
 * @returns        A function that wraps the decorated callable.
 *
 * @example
 * ```typescript
 * const foo = deprecatedParams({ params: "a, b" })(
 *   (kwargs: Record<string, unknown>) => kwargs
 * );
 * foo({ x: 1 });       // no warning
 * foo({ a: 1, x: 2 }); // WARNING: parameter a ... deprecated
 * ```
 */
export function deprecatedParams<T extends AnyFunction>(
  options: DeprecatedParamsOptions,
): (func: T) => T {
  const { since, until, message = "", redirections: rawRedirections } = options;

  // Check that the decorator is not used without arguments
  if (typeof (options as unknown) === "function") {
    throw new Error("deprecatedParams requires arguments to be specified.");
  }

  // Build the list of deprecated param names
  let params: string[] = [];

  if (options.params == null) {
    params = [];
  } else if (typeof options.params === "string") {
    params = options.params.split(/[,\s]+/).filter((p) => p.length > 0);
  } else {
    params = Array.from(options.params as Iterable<string>);
  }

  // Build redirections list, inferring implicit deprecated params from function redirectors
  const redirections: Redirector[] = rawRedirections
    ? Array.from(rawRedirections as Iterable<Redirector>)
    : [];

  for (const redirector of redirections) {
    if (Array.isArray(redirector)) {
      params.push(redirector[0]);
    } else {
      params.push(..._getParamNames(redirector as AnyFunction));
    }
  }

  // Deduplicate while preserving order (mirrors Python dict.fromkeys)
  params = [...new Map(params.map((p) => [p, p])).keys()];

  // Validate that all param names are valid identifiers
  const identifier = /^[^\d\W]\w*$/u;
  if (!params.every((p) => identifier.test(p))) {
    throw new Error("Given parameter values are invalid.");
  }

  function warningMsg(func: AnyFunction, used: string[]): string {
    const [what, name] = _getCallableInfo(func);
    const plural = used.length > 1;
    const parameterS = plural ? "s" : "";
    const usedStr =
      plural
        ? used.slice(0, -1).join(", ") + " and " + used[used.length - 1]
        : used[0];
    const hasHaveBeen = plural ? "have been" : "has been";
    const dep = _deprecationTextComponent(since, until, message || undefined);
    return `The parameter${parameterS} ${usedStr} of ${what} ${name} ${hasHaveBeen} ${dep}`;
  }

  function redirectKwargs(
    kwargs: Record<string, unknown>,
    used: string[],
  ): void {
    for (const redirector of redirections) {
      if (Array.isArray(redirector)) {
        const [oldParam, newParam] = redirector as [string, string];
        if (used.includes(oldParam) && oldParam in kwargs) {
          kwargs[newParam] = kwargs[oldParam];
          delete kwargs[oldParam];
        }
      } else {
        const fn = redirector as AnyFunction;
        const redirectorParams = _getParamNames(fn);
        const redirectorArgs: Record<string, unknown> = {};
        for (const rp of redirectorParams) {
          if (used.includes(rp) && rp in kwargs) {
            redirectorArgs[rp] = kwargs[rp];
            delete kwargs[rp];
          }
        }
        if (Object.keys(redirectorArgs).length > 0) {
          const result = fn(...Object.values(redirectorArgs)) as Record<
            string,
            unknown
          >;
          Object.assign(kwargs, result);
        }
      }
    }
  }

  return function wrapWithDeprecatedParams(func: T): T {
    function wrapper(this: unknown, ...args: unknown[]): unknown {
      // Identify the kwargs object — last argument if it is a plain object,
      // or a new empty object appended to args if none exists.
      let kwargs: Record<string, unknown> | null = null;

      if (
        args.length > 0 &&
        args[args.length - 1] !== null &&
        typeof args[args.length - 1] === "object" &&
        !Array.isArray(args[args.length - 1])
      ) {
        kwargs = args[args.length - 1] as Record<string, unknown>;
      }

      if (kwargs !== null) {
        const used = params.filter((p) => p in kwargs!);
        if (used.length > 0) {
          logger.warning(warningMsg(func, used));
          redirectKwargs(kwargs, used);
        }
      }

      return func.apply(this, args);
    }

    Object.defineProperty(wrapper, "name", {
      value: func.name,
      configurable: true,
    });
    Object.defineProperty(wrapper, "length", {
      value: func.length,
      configurable: true,
    });

    return wrapper as unknown as T;
  };
}
