/**
 * Barrel export for cli/init.
 *
 * TypeScript port of manim/cli/init/__init__.py and commands.py.
 *
 * Public API mirrors Python's __all__:
 *   selectResolution, updateCfg, project, scene, init
 */

export {
  CFG_DEFAULTS,
  selectResolution,
  updateCfg,
  project,
  scene,
  init,
} from "./commands.js";

export type { ProjectOptions, SceneOptions } from "./commands.js";
