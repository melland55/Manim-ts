/**
 * Barrel export for the __main__ module.
 *
 * TypeScript port of manim/__main__.py.
 *
 * Public API mirrors the Python surface:
 *   showSplash, printVersionAndExit, mainGroup, main
 */

export { showSplash, printVersionAndExit, mainGroup, main } from "./main.js";

// ─── CLI entry point ──────────────────────────────────────────────────────────

// Run `main()` when this file is executed directly.
// Mirrors Python's `if __name__ == "__main__": main()`
import { main } from "./main.js";
main().catch((err: unknown) => {
  process.stderr.write(
    err instanceof Error ? err.message + "\n" : String(err) + "\n",
  );
  process.exit(1);
});
