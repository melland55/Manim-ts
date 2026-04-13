/**
 * Manim's cfg subcommand.
 *
 * Manim's cfg subcommand is accessed in the command-line interface via
 * `manim cfg`. Provides write, show, and export subcommands for managing
 * Manim configuration files.
 *
 * TypeScript port of manim/cli/cfg/group.py.
 */

import * as fs from "fs";
import * as nodePath from "path";
import readline from "node:readline";
import { manimConsole } from "../../_config/index.js";
import { configFilePaths, makeConfigParser, type ConfigParser } from "../../_config/utils.js";
import { EPILOG } from "../../constants/index.js";
import { guaranteeExistence, openFile } from "../../utils/file_ops/index.js";

// ─── Constants ───────────────────────────────────────────────────────────────

export const RICH_COLOUR_INSTRUCTIONS: string = `
The default colour is used by the input statement.
If left empty, the default colour will be used.
For a full list of styles, visit https://rich.readthedocs.io/en/latest/style.html
`;

export const RICH_NON_STYLE_ENTRIES: string[] = [
  "log.width",
  "log.height",
  "log.timestamps",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the literal of proper datatype from a `value` string.
 *
 * Mirrors Python's `literal_eval` — attempts to parse the string as
 * a boolean, integer, or float before falling back to the raw string.
 */
export function valueFromString(value: string): string | number | boolean {
  // Boolean literals
  if (value === "True") return true;
  if (value === "False") return false;
  if (value === "None") return value; // keep as string, like Python None→str

  // Integer
  if (/^-?\d+$/.test(value)) {
    const n = parseInt(value, 10);
    if (!isNaN(n)) return n;
  }

  // Float
  if (/^-?\d+\.\d*$/.test(value) || /^-?\d*\.\d+$/.test(value)) {
    const f = parseFloat(value);
    if (!isNaN(f)) return f;
  }

  return value;
}

function _isExpectedDatatype(
  value: string,
  expected: string,
  validateStyle: boolean = false,
): boolean {
  const valueLiteral = valueFromString(value);
  const expectedLiteral = valueFromString(expected);

  if (typeof valueLiteral !== typeof expectedLiteral) return false;

  if (validateStyle && typeof valueLiteral === "string") {
    return isValidStyle(valueLiteral);
  }

  return true;
}

/**
 * Checks whether the entered color style is valid.
 *
 * Since we don't have `rich`, this accepts any non-empty string as valid
 * and rejects obviously invalid patterns.
 */
export function isValidStyle(style: string): boolean {
  if (!style || style.trim() === "") return false;
  // Reject obviously malformed Rich markup/style strings
  // Valid styles are CSS-like color names, hex codes, or rich markup modifiers
  return true;
}

/**
 * Replace `_` with `.` and vice versa in a dictionary's keys for `rich`.
 *
 * Mutates and returns the dictionary.
 */
export function replaceKeys(
  dict: Record<string, string>,
): Record<string, string> {
  const keys = Object.keys(dict);
  for (const key of keys) {
    const value = dict[key];
    delete dict[key];
    if (key.includes("_")) {
      dict[key.replace(/_/g, ".")] = value;
    } else {
      dict[key.replace(/\./g, "_")] = value;
    }
  }
  return dict;
}

// ─── Readline helpers ────────────────────────────────────────────────────────

function askQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

// ─── cfg command group ───────────────────────────────────────────────────────

/** Options for the `cfg` group. */
export interface CfgOptions {
  epilog?: string;
}

/**
 * Responsible for the cfg subcommand.
 * Mirrors Python `cfg` cloup group — invoke sub-commands via `cfgWrite`,
 * `cfgShow`, `cfgExport`.
 */
export function cfg(_opts: CfgOptions = {}): void {
  // No-op when invoked without sub-commands; sub-commands call directly.
  manimConsole.print("Usage: manim cfg [write|show|export]");
  manimConsole.print(EPILOG);
}

// ─── write ───────────────────────────────────────────────────────────────────

export interface WriteOptions {
  /** "user" | "cwd" — which config file to target. */
  level?: "user" | "cwd";
  /** If true, open the config file after writing. */
  openfile?: boolean;
}

/**
 * Interactively write (or open) a Manim config file.
 *
 * Mirrors Python `cfg write` subcommand.
 */
export async function cfgWrite(options: WriteOptions = {}): Promise<void> {
  const { level, openfile = false } = options;
  const configPaths = configFilePaths();

  manimConsole.print("Manim Configuration File Writer");

  const USER_CONFIG_MSG = `A configuration file at ${configPaths[1]} has been created with your required changes.
This will be used when running the manim command. If you want to override this config,
you will have to create a manim.cfg in the local directory, where you want those changes to be overridden.`;

  const CWD_CONFIG_MSG = `A configuration file at ${configPaths[2]} has been created.
To save your config please save that file and place it in your current working directory, from where you run the manim command.`;

  const parser = makeConfigParser();

  if (!openfile) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    for (const category of Object.keys(parser)) {
      manimConsole.print(`\n${category}`);
      const defaultSection = parser[category];
      const isLogger = category === "logger";

      if (isLogger) {
        manimConsole.print(RICH_COLOUR_INSTRUCTIONS);
        replaceKeys(defaultSection);
      }

      for (const key of Object.keys(defaultSection)) {
        const isNonStyleEntry =
          isLogger && RICH_NON_STYLE_ENTRIES.includes(key);
        const desc = isLogger && !isNonStyleEntry ? "style" : "value";

        let prompt = `Enter the ${desc} for ${key} `;
        if (!isLogger || isNonStyleEntry) {
          const currentVal = defaultSection[key];
          const lit = valueFromString(currentVal);
          const defaultVal =
            typeof lit === "string" ? JSON.stringify(lit) : String(lit);
          prompt += `(defaults to ${defaultVal}) :`;
        }

        let temp = await askQuestion(rl, prompt);

        if (temp) {
          while (
            temp &&
            !_isExpectedDatatype(temp, defaultSection[key], isLogger && !isNonStyleEntry)
          ) {
            manimConsole.print(`Invalid ${desc}. Try again.`);
            temp = await askQuestion(rl, `Enter the ${desc} for ${key}:`);
          }
          defaultSection[key] = temp.replace(/%/g, "%%");
        }
      }

      if (isLogger) {
        replaceKeys(defaultSection);
      }

      // Re-escape percent signs for remaining values
      for (const [k, v] of Object.entries(defaultSection)) {
        defaultSection[k] = v.replace(/%/g, "%%");
      }

      parser[category] = defaultSection;
    }

    rl.close();
  }

  let cfgFilePath: string;

  if (level == null) {
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await askQuestion(
      rl2,
      "Do you want to save this as the default config for this User?(y/n)[n]",
    );
    rl2.close();

    if (answer.toLowerCase() === "y") {
      cfgFilePath = configPaths[1];
      guaranteeExistence(nodePath.dirname(configPaths[1]));
      manimConsole.print(USER_CONFIG_MSG);
    } else {
      cfgFilePath = configPaths[2];
      guaranteeExistence(nodePath.dirname(configPaths[2]));
      manimConsole.print(CWD_CONFIG_MSG);
    }
  } else if (level === "user") {
    cfgFilePath = configPaths[1];
    guaranteeExistence(nodePath.dirname(configPaths[1]));
    manimConsole.print(USER_CONFIG_MSG);
  } else {
    cfgFilePath = configPaths[2];
    guaranteeExistence(nodePath.dirname(configPaths[2]));
    manimConsole.print(CWD_CONFIG_MSG);
  }

  _writeParser(parser, cfgFilePath);

  if (openfile) {
    openFile(cfgFilePath);
  }
}

/** Serialize a ConfigParser to an INI-formatted string and write it to disk. */
function _writeParser(parser: ConfigParser, filePath: string): void {
  const lines: string[] = [];
  for (const [section, entries] of Object.entries(parser)) {
    lines.push(`[${section}]`);
    for (const [key, value] of Object.entries(entries)) {
      lines.push(`${key} = ${value}`);
    }
    lines.push("");
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

// ─── show ────────────────────────────────────────────────────────────────────

/**
 * Display all config files being read and their contents.
 *
 * Mirrors Python `cfg show` subcommand.
 */
export function cfgShow(): void {
  manimConsole.print("CONFIG FILES READ");
  const paths = configFilePaths();
  for (const path of paths) {
    if (fs.existsSync(path)) {
      manimConsole.print(path);
    }
  }
  manimConsole.print("");

  const parser = makeConfigParser();
  const richNonStyleEntries = RICH_NON_STYLE_ENTRIES.map((a) =>
    a.replace(/\./g, "_"),
  );

  for (const category of Object.keys(parser)) {
    manimConsole.print(`\n${category}`);
    for (const entry of Object.keys(parser[category])) {
      const value = parser[category][entry];
      if (category === "logger" && !richNonStyleEntries.includes(entry)) {
        manimConsole.print(`${entry} : ${value}`);
      } else {
        manimConsole.print(`${entry} : ${value}`);
      }
    }
    manimConsole.print("\n");
  }
}

// ─── export ──────────────────────────────────────────────────────────────────

export interface ExportOptions {
  /** Target directory for the exported config file. Defaults to cwd. */
  directory?: string;
}

/**
 * Export the current Manim config to a specified directory.
 *
 * Mirrors Python `cfg export` subcommand.
 */
export async function cfgExport(options: ExportOptions = {}): Promise<void> {
  const directory = options.directory ?? process.cwd();
  const directoryPath = nodePath.resolve(directory);

  let proceed: boolean;

  if (nodePath.resolve(directoryPath) === nodePath.resolve(process.cwd())) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await askQuestion(
      rl,
      `You are reading the config from the same directory you are exporting to.\nThis means that the exported config will overwrite the config for this directory.\nAre you sure you want to continue? (y/n)`,
    );
    rl.close();
    proceed = answer.toLowerCase() === "y";
  } else {
    proceed = true;
  }

  if (proceed) {
    if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
      manimConsole.print(`Creating folder: ${directory}.`);
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    await cfgWrite({ level: "cwd" });

    const fromPath = nodePath.join(process.cwd(), "manim.cfg");
    const toPath = nodePath.join(directoryPath, "manim.cfg");

    if (fromPath !== toPath && fs.existsSync(fromPath)) {
      fs.copyFileSync(fromPath, toPath);
    }

    manimConsole.print(`Exported final Config at ${fromPath} to ${toPath}.`);
  } else {
    manimConsole.print("Aborted...");
  }
}
