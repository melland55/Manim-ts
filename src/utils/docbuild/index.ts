/**
 * Utilities for building the Manim documentation.
 * Mirrors manim/utils/docbuild/__init__.py
 *
 * Sub-modules:
 * - autoaliasattr_directive — AliasAttrDocumenter for type-alias sections
 * - autocolor_directive     — ManimColorModuleDocumenter for color tables
 * - manim_directive         — ManimDirective for embedded rendered scenes
 * - module_parsing          — parseModuleAttributes, TypeScript AST parser
 */

export {
  AliasAttrDocumenter,
  smartReplace,
} from "./autoaliasattr_directive.js";
export type {
  DocumentNode as AliasDocumentNode,
  NodeTag,
  AliasAttrDocumenterOptions,
} from "./autoaliasattr_directive.js";

export {
  ManimColorModuleDocumenter,
  relativeLuminance,
  contrastFontColor,
} from "./autocolor_directive.js";
export type {
  ColorEntry,
  DocumentNode as ColorDocumentNode,
  ManimColorModuleDocumenterOptions,
} from "./autocolor_directive.js";

export {
  ManimDirective,
  SkipManimNode,
  processNameList,
  renderTemplate,
  writeRenderingStats,
  logRenderingTimes,
  deleteRenderingTimes,
  QUALITIES,
} from "./manim_directive.js";
export type {
  ManimDirectiveOptions,
  ManimDirectiveResult,
  QualityOption,
  QualityPreset,
  SetupMetadata,
  TemplateContext,
} from "./manim_directive.js";

export {
  parseModuleAttributes,
  parseModuleSource,
  _resetModuleCaches,
} from "./module_parsing.js";
export type {
  AliasInfo,
  AliasCategoryDict,
  ModuleLevelAliasDict,
  ModuleTypeVarDict,
  AliasDocsDict,
  DataDict,
  TypeVarDict,
} from "./module_parsing.js";
