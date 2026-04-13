/**
 * Utilities for processing LaTeX templates.
 * Port of manim/utils/tex.py
 */

import { readFileSync } from "fs";

export { TexTemplate };
export { texcodeForEnvironment as _texcodeForEnvironment };

const _DEFAULT_PREAMBLE = `\\usepackage[english]{babel}
\\usepackage{amsmath}
\\usepackage{amssymb}`;

const _BEGIN_DOCUMENT = "\\begin{document}";
const _END_DOCUMENT = "\\end{document}";

interface TexTemplateOptions {
  texCompiler?: string;
  description?: string;
  outputFormat?: string;
  documentclass?: string;
  preamble?: string;
  placeholderText?: string;
  postDocCommands?: string;
}

/**
 * TeX templates are used to create `Tex` and `MathTex` objects.
 */
class TexTemplate {
  private _body: string = "";

  /** The TeX compiler to be used, e.g. `latex`, `pdflatex` or `lualatex`. */
  texCompiler: string;

  /** A description of the template. */
  description: string;

  /** The output format resulting from compilation, e.g. `.dvi` or `.pdf`. */
  outputFormat: string;

  /** The command defining the documentclass. */
  documentclass: string;

  /**
   * The document's preamble, i.e. the part between `\documentclass` and
   * `\begin{document}`.
   */
  preamble: string;

  /**
   * Text in the document that will be replaced by the expression to be
   * rendered.
   */
  placeholderText: string;

  /**
   * Text (definitions, commands) to be inserted right after
   * `\begin{document}`.
   */
  postDocCommands: string;

  constructor(options: TexTemplateOptions = {}) {
    this.texCompiler = options.texCompiler ?? "latex";
    this.description = options.description ?? "";
    this.outputFormat = options.outputFormat ?? ".dvi";
    this.documentclass =
      options.documentclass ?? "\\documentclass[preview]{standalone}";
    this.preamble = options.preamble ?? _DEFAULT_PREAMBLE;
    this.placeholderText = options.placeholderText ?? "YourTextHere";
    this.postDocCommands = options.postDocCommands ?? "";
  }

  /** The entire TeX template. */
  get body(): string {
    return (
      this._body ||
      [
        this.documentclass,
        this.preamble,
        _BEGIN_DOCUMENT,
        this.postDocCommands,
        this.placeholderText,
        _END_DOCUMENT,
      ]
        .filter((s) => s.length > 0)
        .join("\n")
    );
  }

  set body(value: string) {
    this._body = value;
  }

  /**
   * Create an instance by reading the content of a file.
   *
   * Using `addToPreamble` and `addToDocument` on this instance will have no
   * effect, as the body is read from the file.
   */
  static fromFile(file: string = "tex_template.tex", options: TexTemplateOptions = {}): TexTemplate {
    const instance = new TexTemplate(options);
    instance.body = readFileSync(file, "utf-8");
    return instance;
  }

  /**
   * Adds text to the TeX template's preamble (e.g. definitions, packages).
   * Text can be inserted at the beginning or at the end of the preamble.
   *
   * @param txt - String containing the text to be added.
   * @param prepend - Whether to add it at the beginning of the preamble.
   *   Defaults to appending at the end.
   */
  addToPreamble(txt: string, prepend: boolean = false): this {
    if (this._body) {
      console.warn(
        "This TeX template was created with a fixed body, trying to add text the preamble will have no effect."
      );
    }
    if (prepend) {
      this.preamble = txt + "\n" + this.preamble;
    } else {
      this.preamble += "\n" + txt;
    }
    return this;
  }

  /**
   * Adds text to the TeX template just after `\begin{document}`.
   *
   * @param txt - String containing the text to be added.
   */
  addToDocument(txt: string): this {
    if (this._body) {
      console.warn(
        "This TeX template was created with a fixed body, trying to add text the document will have no effect."
      );
    }
    this.postDocCommands += txt;
    return this;
  }

  /**
   * Inserts expression verbatim into TeX template.
   *
   * @param expression - The string containing the expression to be typeset,
   *   e.g. `$\sqrt{2}$`.
   * @returns LaTeX code based on current template, containing the given
   *   expression and ready for typesetting.
   */
  getTexcodeForExpression(expression: string): string {
    return this.body.replace(this.placeholderText, expression);
  }

  /**
   * Inserts expression into TeX template wrapped in `\begin{environment}`
   * and `\end{environment}`.
   *
   * @param expression - The string containing the expression to be typeset.
   * @param environment - The string containing the environment in which the
   *   expression should be typeset, e.g. `align*`.
   * @returns LaTeX code based on template, containing the given expression
   *   inside its environment, ready for typesetting.
   */
  getTexcodeForExpressionInEnv(expression: string, environment: string): string {
    const [begin, end] = texcodeForEnvironment(environment);
    return this.body.replace(
      this.placeholderText,
      [begin, expression, end].join("\n")
    );
  }

  /** Create a deep copy of the TeX template instance. */
  copy(): TexTemplate {
    const clone = new TexTemplate({
      texCompiler: this.texCompiler,
      description: this.description,
      outputFormat: this.outputFormat,
      documentclass: this.documentclass,
      preamble: this.preamble,
      placeholderText: this.placeholderText,
      postDocCommands: this.postDocCommands,
    });
    clone._body = this._body;
    return clone;
  }
}

/**
 * Processes the `environment` string to return the correct
 * `\begin{environment}[extra]{extra}` and `\end{environment}` strings.
 *
 * Acceptable formats include:
 * `{align*}`, `align*`, `{tabular}[t]{cccl}`, `tabular}{cccl`,
 * `\begin{tabular}[t]{cccl}`.
 *
 * @returns A pair `[begin, end]` representing the opening and closing of
 *   the tex environment.
 */
function texcodeForEnvironment(environment: string): [string, string] {
  environment = environment
    .replace(/^\\begin/, "")
    .replace(/^\{/, "");

  // The \begin command takes everything and closes with a brace
  let begin = "\\begin{" + environment;
  // If it doesn't end on } or ], assume missing }
  if (!begin.endsWith("}") && !begin.endsWith("]")) {
    begin += "}";
  }

  // The \end command terminates at the first closing brace
  const splitAtBrace = environment.split("}");
  const end = "\\end{" + splitAtBrace[0] + "}";

  return [begin, end];
}
