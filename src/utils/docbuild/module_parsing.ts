/**
 * Read and parse all TypeScript modules and extract documentation from them.
 * Mirrors manim/utils/docbuild/module_parsing.py — adapted for TypeScript source.
 *
 * Instead of Python's ast module, this implementation uses a line-by-line
 * parser with regex to extract type aliases, module-level attributes, and
 * (if present) TypeVar-like constructs from `.ts` files.
 *
 * TypeVar note: TypeScript has no runtime TypeVar equivalent. TYPEVAR_DICT
 * is always empty for TypeScript source files.
 */

import * as fs from "fs";
import * as path from "path";

// ─── Public type aliases (mirrors module_parsing.py exports) ──────────────────

/**
 * Dictionary with a `definition` key containing the definition of a type alias
 * as a string, and optionally a `doc` key with documentation.
 */
export type AliasInfo = { definition: string; doc?: string };

/**
 * Maps alias names to their info within a single category.
 * The key `""` holds uncategorized aliases.
 */
export type AliasCategoryDict = Map<string, AliasInfo>;

/**
 * Maps category names to their alias dicts for a single module.
 */
export type ModuleLevelAliasDict = Map<string, AliasCategoryDict>;

/**
 * Maps TypeVar-like names to their definition strings.
 * Always empty for TypeScript (no runtime TypeVar equivalent).
 */
export type ModuleTypeVarDict = Map<string, string>;

/**
 * Maps module names (dot-separated) to their type alias documentation.
 */
export type AliasDocsDict = Map<string, ModuleLevelAliasDict>;

/**
 * Maps module names to lists of documented module-level attribute names.
 */
export type DataDict = Map<string, string[]>;

/**
 * Maps module names to their TypeVar-like definitions (always empty for TS).
 */
export type TypeVarDict = Map<string, ModuleTypeVarDict>;

// ─── Module-level caches (mirrors Python module-level globals) ────────────────

let ALIAS_DOCS_DICT: AliasDocsDict = new Map();
let DATA_DICT: DataDict = new Map();
let TYPEVAR_DICT: TypeVarDict = new Map();

// ─── Root detection ───────────────────────────────────────────────────────────

/**
 * Find the project root by walking up from the given directory until
 * `package.json` is found, or until the filesystem root is reached.
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      // Reached filesystem root — fall back to startDir
      return startDir;
    }
    dir = parent;
  }
}

/** Project root (equivalent of MANIM_ROOT in the Python version). */
function getManimRoot(): string {
  // __dirname is not available in ESM; derive from process.cwd()
  return findProjectRoot(process.cwd());
}

// ─── File discovery ───────────────────────────────────────────────────────────

/**
 * Recursively collect all `.ts` files under `dir`, skipping `node_modules`
 * and `dist` directories.
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      results.push(...collectTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Convert an absolute file path inside `root` to a dot-separated module name,
 * stripping the `.ts` extension.
 *
 * Example: `<root>/src/utils/docbuild/module_parsing.ts`
 *   → `src.utils.docbuild.module_parsing`
 */
function pathToModuleName(filePath: string, root: string): string {
  const rel = path.relative(root, filePath);
  const parts = rel.split(path.sep);
  parts[parts.length - 1] = parts[parts.length - 1].replace(/\.ts$/, "");
  return parts.join(".");
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/** Collapse a multi-line type alias definition into a single-line string. */
function collapseDefinition(lines: string[], startIdx: number, startDef: string): string {
  // Count open/close brackets to know when the definition ends
  const openers = new Set(["{", "[", "("]);
  const closers = new Set(["}", "]", ")"]);
  let depth = 0;
  let result = startDef;

  function countDepth(s: string): void {
    for (const ch of s) {
      if (openers.has(ch)) depth++;
      else if (closers.has(ch)) depth--;
    }
  }

  countDepth(startDef);

  if (depth <= 0 && startDef.trimEnd().endsWith(";")) {
    return startDef.replace(/;$/, "").trim();
  }

  let i = startIdx + 1;
  while (i < lines.length && depth > 0) {
    const l = lines[i].trim();
    result += " " + l;
    countDepth(l);
    i++;
  }

  return result.replace(/;$/, "").trim();
}

/**
 * Extract a JSDoc comment ending just before `lineIdx`.
 * Returns the comment text as a single string, or `undefined`.
 */
function extractDocBefore(lines: string[], lineIdx: number): string | undefined {
  // Walk backwards to find `*/`
  let i = lineIdx - 1;
  while (i >= 0 && lines[i].trim() === "") i--;

  if (i < 0 || !lines[i].trimEnd().endsWith("*/")) return undefined;

  const docLines: string[] = [];
  while (i >= 0) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("/**") || trimmed === "/**") {
      // Remove leading `/**` and any trailing ` */`
      const inner = trimmed.replace(/^\/\*\*\s?/, "").replace(/\s*\*\/$/, "");
      if (inner) docLines.unshift(inner);
      break;
    } else if (trimmed.startsWith("*")) {
      docLines.unshift(trimmed.replace(/^\*\s?/, ""));
    } else {
      break;
    }
    i--;
  }

  const text = docLines.join("\n").trim();
  return text || undefined;
}

// ─── Per-file parser ──────────────────────────────────────────────────────────

/**
 * Parse one TypeScript file and populate ALIAS_DOCS_DICT, DATA_DICT, and
 * TYPEVAR_DICT with the information found.
 */
function parseFile(content: string, moduleName: string): void {
  const lines = content.split("\n");

  const moduleDict: ModuleLevelAliasDict = new Map();
  const dataList: string[] = [];

  let currentCategoryName: string | null = null;

  // Regex patterns
  const categoryRe = /^\s*\/\/\s*\[CATEGORY\]\s*(.*)/;
  const typeAliasRe = /^(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=\s*(.*)/;
  const moduleAttrRe = /^export\s+(?:const|let)\s+(\w+)\s*[:=]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Category marker ────────────────────────────────────────────────────
    const catMatch = trimmed.match(categoryRe);
    if (catMatch) {
      currentCategoryName = catMatch[1].trim();
      if (!moduleDict.has(currentCategoryName)) {
        moduleDict.set(currentCategoryName, new Map());
      }
      continue;
    }

    // ── Type alias ────────────────────────────────────────────────────────
    const taMatch = trimmed.match(typeAliasRe);
    if (taMatch) {
      const aliasName = taMatch[1];
      const defStart = taMatch[2];
      const definition = collapseDefinition(lines, i, defStart);

      const catName = currentCategoryName ?? "";
      if (!moduleDict.has(catName)) {
        moduleDict.set(catName, new Map());
      }
      const catDict = moduleDict.get(catName)!;

      const aliasInfo: AliasInfo = { definition };
      const doc = extractDocBefore(lines, i);
      if (doc !== undefined) {
        aliasInfo.doc = doc;
      }
      catDict.set(aliasName, aliasInfo);
      continue;
    }

    // ── Module-level exported const/let ───────────────────────────────────
    const attrMatch = trimmed.match(moduleAttrRe);
    if (attrMatch) {
      const attrName = attrMatch[1];
      // Only include if there is a JSDoc comment immediately above
      const doc = extractDocBefore(lines, i);
      if (doc !== undefined) {
        dataList.push(attrName);
      }
      continue;
    }
  }

  if (moduleDict.size > 0) {
    ALIAS_DOCS_DICT.set(moduleName, moduleDict);
  }
  if (dataList.length > 0) {
    DATA_DICT.set(moduleName, dataList);
  }
  // TYPEVAR_DICT: always empty for TypeScript (no runtime TypeVar)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read all TypeScript files under `src/`, generate parse trees from them, and
 * extract useful information about the type aliases defined in the files.
 *
 * Results are cached after the first call (equivalent to the Python version's
 * module-level mutable globals).
 *
 * @returns A tuple of `[AliasDocsDict, DataDict, TypeVarDict]`.
 */
export function parseModuleAttributes(): [AliasDocsDict, DataDict, TypeVarDict] {
  if (ALIAS_DOCS_DICT.size > 0 || DATA_DICT.size > 0 || TYPEVAR_DICT.size > 0) {
    return [ALIAS_DOCS_DICT, DATA_DICT, TYPEVAR_DICT];
  }

  const root = getManimRoot();
  const srcDir = path.join(root, "src");
  const files = collectTsFiles(srcDir);

  for (const filePath of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const moduleName = pathToModuleName(filePath, root);
    parseFile(content, moduleName);
  }

  return [ALIAS_DOCS_DICT, DATA_DICT, TYPEVAR_DICT];
}

/**
 * Reset the module-level caches. Useful for testing.
 */
export function _resetModuleCaches(): void {
  ALIAS_DOCS_DICT = new Map();
  DATA_DICT = new Map();
  TYPEVAR_DICT = new Map();
}

/**
 * Parse a single TypeScript source string (provided inline, not from a file)
 * and return the extracted alias/data/typevar dicts for that virtual module.
 * Useful for testing the parser without hitting the filesystem.
 */
export function parseModuleSource(
  content: string,
  moduleName: string = "__inline__",
): [ModuleLevelAliasDict, string[], ModuleTypeVarDict] {
  // Use fresh local maps so we don't pollute the global cache
  const savedAlias = ALIAS_DOCS_DICT;
  const savedData = DATA_DICT;
  const savedTypeVar = TYPEVAR_DICT;

  ALIAS_DOCS_DICT = new Map();
  DATA_DICT = new Map();
  TYPEVAR_DICT = new Map();

  parseFile(content, moduleName);

  const aliasResult = ALIAS_DOCS_DICT.get(moduleName) ?? new Map();
  const dataResult = DATA_DICT.get(moduleName) ?? [];
  const typeVarResult = TYPEVAR_DICT.get(moduleName) ?? new Map();

  ALIAS_DOCS_DICT = savedAlias;
  DATA_DICT = savedData;
  TYPEVAR_DICT = savedTypeVar;

  return [aliasResult, dataResult, typeVarResult];
}
