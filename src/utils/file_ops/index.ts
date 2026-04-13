/**
 * Barrel export for utils/file_ops.
 *
 * Public API surface mirrors Python Manim's manim/utils/file_ops.py __all__:
 *   addExtensionIfNotPresent, guaranteeExistence, guaranteeEmptyExistence,
 *   seekFullPathFromDefaults, modifyAtime, openFile,
 *   isMP4Format, isGIFFormat, isPNGFormat, isWebMFormat, isMOVFormat,
 *   writeToMovie, ensureExecutable
 *
 * Additional exports:
 *   addVersionBeforeExtension, openMediaFile,
 *   getTemplateNames, getTemplatePath, addImportStatement, copyTemplateFiles,
 *   FileOpsConfig, ISceneFileWriterPaths, MANIM_VERSION
 */

export {
  MANIM_VERSION,
  // Types
  type FileOpsConfig,
  type ISceneFileWriterPaths,
  // Format predicates
  isMP4Format,
  isGIFFormat,
  isWebMFormat,
  isMOVFormat,
  isPNGFormat,
  writeToMovie,
  // Executable check
  ensureExecutable,
  // Path helpers
  addExtensionIfNotPresent,
  addVersionBeforeExtension,
  guaranteeExistence,
  guaranteeEmptyExistence,
  seekFullPathFromDefaults,
  modifyAtime,
  // File opening
  openFile,
  openMediaFile,
  // Template utilities
  getTemplateNames,
  getTemplatePath,
  addImportStatement,
  copyTemplateFiles,
} from "./file_ops.js";
