/**
 * A directive for documenting type aliases and other module-level attributes.
 * Mirrors manim/utils/docbuild/autoaliasattr_directive.py — adapted for
 * TypeScript (no Sphinx/docutils runtime; uses a minimal DocumentNode tree).
 */

import {
  parseModuleAttributes,
  type AliasDocsDict,
  type DataDict,
  type TypeVarDict,
} from "./module_parsing.js";

// ─── Minimal doc-node types (replaces docutils.nodes) ────────────────────────

/** Tag names used in the documentation AST. */
export type NodeTag =
  | "container"
  | "section"
  | "rubric"
  | "title"
  | "class"
  | "parsed-literal"
  | "autosummary"
  | "paragraph"
  | "raw";

/** A minimal documentation AST node (replaces docutils.nodes.Element). */
export interface DocumentNode {
  tagName: NodeTag | string;
  attrs: Record<string, string | boolean | number>;
  children: DocumentNode[];
  text?: string;
}

/** Create a DocumentNode with optional initial text and attributes. */
function makeNode(
  tagName: NodeTag | string,
  text?: string,
  attrs: Record<string, string | boolean | number> = {},
): DocumentNode {
  return { tagName, attrs, children: [], text };
}

// ─── Module-level data ────────────────────────────────────────────────────────

// Populated lazily on first use (mirrors Python module-level initialisation)
let _aliasDocs: AliasDocsDict | null = null;
let _dataDict: DataDict | null = null;
let _typeVarDict: TypeVarDict | null = null;
let _aliasList: string[] | null = null;

function ensureLoaded(): void {
  if (_aliasDocs !== null) return;
  [_aliasDocs, _dataDict, _typeVarDict] = parseModuleAttributes();
  _aliasList = [];
  for (const moduleDict of _aliasDocs.values()) {
    for (const categoryDict of moduleDict.values()) {
      for (const aliasName of categoryDict.keys()) {
        _aliasList.push(aliasName);
      }
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Auxiliary function for substituting type aliases into a base string when
 * there are overlaps between the aliases themselves.
 *
 * @param base         The string in which type aliases will be located and replaced.
 * @param alias        The substring to be substituted.
 * @param substitution The string that will replace every occurrence of `alias`.
 * @returns            The new string after the alias substitution.
 */
export function smartReplace(base: string, alias: string, substitution: string): string {
  const lenAlias = alias.length;
  const lenBase = base.length;
  const occurrences: number[] = [];

  function isWordBoundary(ch: string): boolean {
    return !/[a-zA-Z0-9_]/.test(ch);
  }

  let start = 0;
  while (true) {
    const i = base.indexOf(alias, start);
    if (i === -1) break;
    const beforeOk = i === 0 || isWordBoundary(base[i - 1]);
    const afterOk = i + lenAlias === lenBase || isWordBoundary(base[i + lenAlias]);
    if (beforeOk && afterOk) {
      occurrences.push(i);
    }
    start = i + lenAlias;
  }

  // Replace in reverse order so indices remain valid
  for (const o of occurrences.reverse()) {
    base = base.slice(0, o) + substitution + base.slice(o + lenAlias);
  }

  return base;
}

// ─── AliasAttrDocumenter ──────────────────────────────────────────────────────

/** Options for AliasAttrDocumenter.run(). */
export interface AliasAttrDocumenterOptions {
  /** The fully-qualified module name, e.g. `"manim.utils.color"`. */
  moduleName: string;
}

/**
 * Documenter that replaces Sphinx's Autosummary for module-level attributes.
 * It manually crafts a "Type Aliases" section, a "TypeVar's" section, and a
 * "Module Attributes" section.
 *
 * Mirrors `AliasAttrDocumenter` from `autoaliasattr_directive.py`.
 * In Python this extends `Directive`; here it is a standalone class whose
 * `run()` method returns a `DocumentNode[]` tree instead of RST nodes.
 */
export class AliasAttrDocumenter {
  static readonly objtype = "autoaliasattr";

  private readonly moduleName: string;

  constructor(options: AliasAttrDocumenterOptions) {
    this.moduleName = options.moduleName;
  }

  /**
   * Generate the documentation tree for the module.
   * Returns a list of top-level DocumentNodes (one container per section).
   */
  run(): DocumentNode[] {
    ensureLoaded();
    const aliasDocs = _aliasDocs!;
    const dataDict = _dataDict!;
    const typeVarDict = _typeVarDict!;
    const aliasList = _aliasList!;

    // Strip leading "manim." prefix, mirroring the Python version
    const moduleKey = this.moduleName.replace(/^manim\./, "");

    const moduleAliasDict = aliasDocs.get(moduleKey) ?? null;
    const moduleAttrsList = dataDict.get(moduleKey) ?? null;
    const moduleTypevars = typeVarDict.get(moduleKey) ?? null;

    const content = makeNode("container");

    // ── Type Aliases section ───────────────────────────────────────────────
    if (moduleAliasDict !== null) {
      const aliasSection = makeNode("section", undefined, {
        ids: `${moduleKey}.alias`,
      });
      content.children.push(aliasSection);
      aliasSection.children.push(makeNode("rubric", "Type Aliases"));

      for (const [categoryName, categoryDict] of moduleAliasDict) {
        const catSection = makeNode("section", undefined, {
          ids: categoryName.toLowerCase().replace(/\s+/g, "_"),
        });
        aliasSection.children.push(catSection);

        if (categoryName) {
          catSection.children.push(makeNode("title", categoryName));
        }

        const catContainer = makeNode("container");
        catSection.children.push(catContainer);

        for (const [aliasName, aliasInfo] of categoryDict) {
          // Replace type alias occurrences in the definition
          let aliasDef = aliasInfo.definition;
          for (const a of aliasList) {
            aliasDef = smartReplace(aliasDef, a, `:class:\`~.${a}\``);
          }

          const classNode = makeNode("class", undefined, { name: aliasName });
          const parsedLiteral = makeNode("parsed-literal", aliasDef);
          classNode.children.push(parsedLiteral);

          if (aliasInfo.doc !== undefined) {
            let aliasDoc = aliasInfo.doc;
            // Replace alias occurrences in doc
            for (const a of aliasList) {
              aliasDoc = aliasDoc.replace(
                new RegExp("`" + a + "`", "g"),
                `:class:\`~.${a}\``,
              );
            }
            // Hyperlink TypeVars from this module
            if (moduleTypevars !== null) {
              for (const t of moduleTypevars.keys()) {
                aliasDoc = aliasDoc.replace(
                  new RegExp("`" + t + "`", "g"),
                  `:class:\`${t}\``,
                );
              }
            }
            classNode.children.push(makeNode("paragraph", aliasDoc));
          }

          catContainer.children.push(classNode);
        }
      }
    }

    // ── TypeVar's section ──────────────────────────────────────────────────
    if (moduleTypevars !== null) {
      const typeVarSection = makeNode("section", undefined, {
        ids: `${moduleKey}.typevars`,
      });
      content.children.push(typeVarSection);
      typeVarSection.children.push(makeNode("rubric", "TypeVar's"));

      for (const [name, definition] of moduleTypevars) {
        const classNode = makeNode("class", undefined, { name });
        classNode.children.push(makeNode("parsed-literal", definition));
        typeVarSection.children.push(classNode);
      }
    }

    // ── Module Attributes section ──────────────────────────────────────────
    if (moduleAttrsList !== null) {
      const attrsSection = makeNode("section", undefined, {
        ids: `${moduleKey}.data`,
      });
      content.children.push(attrsSection);
      attrsSection.children.push(makeNode("rubric", "Module Attributes"));

      const autoSummary = makeNode("autosummary");
      for (const attr of moduleAttrsList) {
        autoSummary.children.push(makeNode("paragraph", attr));
      }
      attrsSection.children.push(autoSummary);
    }

    return [content];
  }
}
