/**
 * A directive for documenting colors in Manim.
 * Mirrors manim/utils/docbuild/autocolor_directive.py — adapted for TypeScript.
 *
 * Instead of Sphinx/docutils nodes, this returns an HTML string for the color
 * table, and a structured DocumentNode representation for programmatic use.
 */

import type { IColor } from "../../core/types.js";

// ─── Minimal DocumentNode (shared shape with autoaliasattr_directive) ─────────

export interface DocumentNode {
  tagName: string;
  attrs: Record<string, string | boolean | number>;
  children: DocumentNode[];
  text?: string;
}

function makeNode(
  tagName: string,
  text?: string,
  attrs: Record<string, string | boolean | number> = {},
): DocumentNode {
  return { tagName, attrs, children: [], text };
}

// ─── Color record used internally ────────────────────────────────────────────

export interface ColorEntry {
  name: string;
  hexCode: string;
  fontColor: "black" | "white";
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Compute the relative luminance of a color given its RGB values in [0, 1].
 * Used to pick a readable font color (black vs white) for color swatches.
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Choose `"black"` or `"white"` font color based on background luminance.
 */
export function contrastFontColor(luminance: number): "black" | "white" {
  return luminance > 0.5 ? "black" : "white";
}

// ─── ManimColorModuleDocumenter ───────────────────────────────────────────────

/** Options for ManimColorModuleDocumenter. */
export interface ManimColorModuleDocumenterOptions {
  /**
   * Number of color columns to display per table row.
   * Default is 2 (matching the Python original).
   */
  numColorCols?: number;
}

/**
 * Documenter that generates a color-swatch table for a module that exports
 * `IColor` (ManimColor) constants.
 *
 * Mirrors `ManimColorModuleDocumenter` from `autocolor_directive.py`.
 * The `run()` method accepts a plain record of exported color values and
 * returns both a `DocumentNode[]` tree and a convenience `toHtml()` method.
 */
export class ManimColorModuleDocumenter {
  static readonly objtype = "automanimcolormodule";

  private readonly numColorCols: number;

  constructor(options: ManimColorModuleDocumenterOptions = {}) {
    this.numColorCols = options.numColorCols ?? 2;
  }

  /**
   * Collect all `IColor` entries from a module export record.
   *
   * @param moduleExports A `Record<string, unknown>` of a module's named exports.
   * @returns             An array of `ColorEntry` objects.
   */
  collectColorEntries(moduleExports: Record<string, unknown>): ColorEntry[] {
    const entries: ColorEntry[] = [];
    for (const [name, value] of Object.entries(moduleExports)) {
      if (value !== null && typeof value === "object" && this._isIColor(value)) {
        const color = value as IColor;
        const [r, g, b] = color.toArray();
        const lum = relativeLuminance(r, g, b);
        const hexCode = color.toHex();
        entries.push({ name, hexCode, fontColor: contrastFontColor(lum) });
      }
    }
    return entries;
  }

  /** Run the documenter on a module export record and return DocumentNodes. */
  run(moduleExports: Record<string, unknown>): DocumentNode[] {
    const colorEntries = this.collectColorEntries(moduleExports);
    const cols = this.numColorCols;

    const table = makeNode("table", undefined, { align: "center" });
    const tgroup = makeNode("tgroup", undefined, { cols: cols * 2 });
    table.children.push(tgroup);

    // Column specs
    for (let i = 0; i < cols * 2; i++) {
      tgroup.children.push(makeNode("colspec", undefined, { colwidth: 1 }));
    }

    // Header
    const thead = makeNode("thead");
    const headerRow = makeNode("row");
    for (let i = 0; i < cols; i++) {
      headerRow.children.push(makeNode("entry", undefined));
      const h1 = makeNode("paragraph", "Color Name");
      const h2 = makeNode("paragraph", "RGB Hex Code");
      headerRow.children[headerRow.children.length - 1].children.push(h1);
      headerRow.children.push(makeNode("entry", undefined));
      headerRow.children[headerRow.children.length - 1].children.push(h2);
    }
    thead.children.push(headerRow);
    tgroup.children.push(thead);

    // Body
    const tbody = makeNode("tbody");
    for (let baseI = 0; baseI < colorEntries.length; baseI += cols) {
      const row = makeNode("row");
      for (let idx = baseI; idx < baseI + cols; idx++) {
        if (idx < colorEntries.length) {
          const { name, hexCode, fontColor } = colorEntries[idx];
          const nameEntry = makeNode("entry", undefined);
          nameEntry.children.push(makeNode("literal", name));
          const swatchEntry = makeNode("entry", undefined);
          swatchEntry.children.push(
            makeNode("raw", this._colorSwatchHtml(hexCode, fontColor), { format: "html" }),
          );
          row.children.push(nameEntry, swatchEntry);
        } else {
          row.children.push(makeNode("entry", undefined));
          row.children.push(makeNode("entry", undefined));
        }
      }
      tbody.children.push(row);
    }
    tgroup.children.push(tbody);

    return [table];
  }

  /**
   * Render the color table directly to an HTML string.
   * Useful for standalone documentation generation without a full Sphinx build.
   */
  toHtml(moduleExports: Record<string, unknown>): string {
    const colorEntries = this.collectColorEntries(moduleExports);
    const cols = this.numColorCols;
    const colWidth = `${Math.floor(100 / (cols * 2))}%`;

    const headerCells = Array.from({ length: cols })
      .map(
        () =>
          `<th style="width:${colWidth}">Color Name</th>` +
          `<th style="width:${colWidth}">RGB Hex Code</th>`,
      )
      .join("");

    const bodyRows: string[] = [];
    for (let baseI = 0; baseI < colorEntries.length; baseI += cols) {
      let cells = "";
      for (let idx = baseI; idx < baseI + cols; idx++) {
        if (idx < colorEntries.length) {
          const { name, hexCode, fontColor } = colorEntries[idx];
          cells +=
            `<td><code>${name}</code></td>` +
            `<td>${this._colorSwatchHtml(hexCode, fontColor)}</td>`;
        } else {
          cells += "<td></td><td></td>";
        }
      }
      bodyRows.push(`<tr>${cells}</tr>`);
    }

    return (
      `<table align="center">` +
      `<thead><tr>${headerCells}</tr></thead>` +
      `<tbody>${bodyRows.join("")}</tbody>` +
      `</table>`
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private _colorSwatchHtml(hexCode: string, fontColor: "black" | "white"): string {
    return (
      `<div style="background-color:${hexCode};padding:0.25rem 0;` +
      `border-radius:8px;margin:0.5rem 0.2rem">` +
      `<code style="color:${fontColor};">${hexCode}</code>` +
      `</div>`
    );
  }

  private _isIColor(value: object): boolean {
    return (
      typeof (value as Record<string, unknown>)["toHex"] === "function" &&
      typeof (value as Record<string, unknown>)["toArray"] === "function" &&
      typeof (value as Record<string, unknown>)["r"] === "number"
    );
  }
}
