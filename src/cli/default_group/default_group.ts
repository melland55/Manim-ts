/**
 * ``DefaultGroup`` allows a subcommand to act as the main command.
 *
 * In particular, this class is what allows ``manim`` to act as ``manim render``.
 *
 * Vendored port of https://github.com/click-contrib/click-default-group/
 * under the BSD 3-Clause "New" or "Revised" License.
 */

import { deprecated } from "../../utils/deprecation/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Represents a CLI subcommand registered with a {@link DefaultGroup}.
 *
 * Mirrors Click's `Command` class at the surface level used by DefaultGroup.
 */
export interface Command {
  /** The command name as it appears on the CLI, or ``null`` if anonymous. */
  name: string | null;
  /** The callback invoked when this command is executed. */
  callback?: (...args: unknown[]) => unknown;
}

/**
 * Minimal CLI context, used to carry transient state between routing steps.
 *
 * Mirrors Click's ``Context`` at the surface level used by DefaultGroup
 * (specifically the ``meta`` dictionary for cross-step data).
 */
export interface Context {
  /**
   * Arbitrary metadata dictionary.  DefaultGroup writes ``arg0`` here when
   * it redirects an unrecognised token to the default command.
   */
  meta: Record<string, unknown>;
}

/** Constructor options for {@link DefaultGroup}. */
export interface DefaultGroupOptions {
  /**
   * Name of the default command.  If set, unrecognised CLI tokens will be
   * routed to this command instead of raising an error.
   */
  default?: string;
  /**
   * When ``true``, invoking the group with no arguments will automatically
   * forward to the default command.  Default: ``false``.
   */
  defaultIfNoArgs?: boolean;
  /**
   * Must not be ``false``; DefaultGroup always accepts unknown options so it
   * can forward them to the default subcommand.  Passing ``false`` throws.
   */
  ignoreUnknownOptions?: boolean;
}

/** Options for the deprecated {@link DefaultGroup.command} factory. */
export interface CommandOptions {
  /** When ``true``, register the decorated function as the default command. */
  default?: boolean;
  /** Any other options forwarded to the underlying command factory. */
  [key: string]: unknown;
}

// ─── DefaultGroup ─────────────────────────────────────────────────────────────

/**
 * A command group that invokes a subcommand marked as default when no
 * recognised subcommand is supplied on the CLI.
 *
 * @example
 * ```typescript
 * const cli = new DefaultGroup({ default: "render", defaultIfNoArgs: true });
 * cli.addCommand({ name: "render", callback: renderFn });
 * cli.addCommand({ name: "cfg",    callback: cfgFn });
 *
 * const ctx: Context = { meta: {} };
 * // "manim my-scene.py" → routes to "render" with arg0="my-scene.py"
 * const [name, cmd, rest] = cli.resolveCommand(ctx, ["my-scene.py"]);
 * ```
 */
export class DefaultGroup {
  /** Registered subcommands, keyed by name. */
  readonly commands: Map<string, Command>;

  /** Name of the default command, or ``null`` if none is configured. */
  defaultCmdName: string | null;

  /**
   * When ``true``, invoking the group with an empty argument list forwards
   * to the default command.
   */
  defaultIfNoArgs: boolean;

  /** Always ``true`` — DefaultGroup must accept unknown options. */
  readonly ignoreUnknownOptions: boolean;

  constructor(options: DefaultGroupOptions = {}) {
    if (options.ignoreUnknownOptions === false) {
      throw new Error("Default group accepts unknown options");
    }
    this.ignoreUnknownOptions = true;
    this.defaultCmdName = options.default ?? null;
    this.defaultIfNoArgs = options.defaultIfNoArgs ?? false;
    this.commands = new Map();
  }

  // ── Command registry ──────────────────────────────────────────────────────

  /**
   * Register a command with this group.
   * Commands whose ``name`` is ``null`` are silently ignored.
   *
   * @param command - The command to register.
   */
  addCommand(command: Command): void {
    if (command.name !== null) {
      this.commands.set(command.name, command);
    }
  }

  /**
   * Register a command **and** mark it as the default.
   *
   * @param command - The command to set as default.
   */
  setDefaultCommand(command: Command): void {
    this.addCommand(command);
    this.defaultCmdName = command.name;
  }

  // ── Routing ───────────────────────────────────────────────────────────────

  /**
   * Preprocess the argument list before command resolution.
   *
   * If the argument list is empty and {@link DefaultGroup.defaultIfNoArgs} is
   * ``true``, the default command name is inserted at the front so that
   * subsequent resolution can proceed normally.
   *
   * @param ctx  - The CLI context.
   * @param args - Raw CLI arguments (mutated in-place when prepending).
   * @returns The (possibly modified) argument list.
   */
  parseArgs(ctx: Context, args: string[]): string[] {
    if (args.length === 0 && this.defaultIfNoArgs && this.defaultCmdName) {
      args.unshift(this.defaultCmdName);
    }
    return args;
  }

  /**
   * Look up a subcommand by name.
   *
   * If ``cmdName`` does not match any registered command and a default
   * command is configured, the original token is saved to ``ctx.meta.arg0``
   * and the default command is returned instead.
   *
   * @param ctx     - The CLI context.
   * @param cmdName - Token from the CLI to look up.
   * @returns The matching command, or ``null`` if not found.
   */
  getCommand(ctx: Context, cmdName: string): Command | null {
    if (!this.commands.has(cmdName) && this.defaultCmdName !== null) {
      ctx.meta["arg0"] = cmdName;
      cmdName = this.defaultCmdName;
    }
    return this.commands.get(cmdName) ?? null;
  }

  /**
   * Resolve the first element of ``args`` to a subcommand.
   *
   * If a token was redirected to the default command (i.e. ``ctx.meta.arg0``
   * was set by {@link DefaultGroup.getCommand}), the original token is
   * re-inserted at the front of the returned argument list so that the
   * default command can inspect it.
   *
   * @param ctx  - The CLI context.
   * @param args - CLI arguments whose first element is the command token.
   * @returns A ``[cmdName, cmd, remainingArgs]`` triple.
   */
  resolveCommand(
    ctx: Context,
    args: string[],
  ): [string | null, Command | null, string[]] {
    const [cmdName, cmd, remaining] = this._baseResolveCommand(ctx, args);
    if ("arg0" in ctx.meta) {
      remaining.unshift(ctx.meta["arg0"] as string);
      if (cmd !== null) {
        return [cmd.name, cmd, remaining];
      }
    }
    return [cmdName, cmd, remaining];
  }

  /**
   * Base resolution logic: pops the first arg, looks up the command.
   * @internal
   */
  private _baseResolveCommand(
    ctx: Context,
    args: string[],
  ): [string | null, Command | null, string[]] {
    if (args.length === 0) {
      return [null, null, []];
    }
    const [token, ...remaining] = args;
    const cmd = this.getCommand(ctx, token);
    return [token, cmd, remaining];
  }

  // ── Deprecated API ────────────────────────────────────────────────────────

  /**
   * Return a decorator that registers any function as a subcommand.
   *
   * @deprecated Use the ``default`` constructor option or
   *   {@link DefaultGroup.setDefaultCommand} instead.
   *
   * @param options - Options, notably ``default: true`` to mark as default.
   * @returns A decorator that wraps its input in a {@link Command} and
   *   registers it with this group.
   */
  command(
    options: CommandOptions = {},
  ): (fn: (...args: unknown[]) => unknown) => Command {
    const isDefault = options.default === true;
    const self = this;

    const factory = (fn: (...args: unknown[]) => unknown): Command => {
      const cmd: Command = {
        name: fn.name || null,
        callback: fn,
      };
      if (isDefault) {
        self.setDefaultCommand(cmd);
      } else {
        self.addCommand(cmd);
      }
      return cmd;
    };

    return factory;
  }
}

// Wrap the `command` method with the deprecation decorator post-definition so
// that calling `group.command(...)` always emits a deprecation warning.
// We patch the prototype rather than using a class field to preserve the
// method's identity on the prototype chain.
DefaultGroup.prototype.command = deprecated(
  DefaultGroup.prototype.command,
) as typeof DefaultGroup.prototype.command;
