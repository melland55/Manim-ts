import { readFileSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

interface TaskNode {
  module: string;
  pythonFiles: string[];
  dependsOn: string[];
  estimatedLines: number;
  layer: number;
  priority: number;
}

interface TaskGraph {
  sourceDir: string;
  packageName: string;
  totalModules: number;
  totalLayers: number;
  layers: { layer: number; modules: string[] }[];
  tasks: TaskNode[];
}

/**
 * Read the converted module's public API by scanning its index.ts
 */
function getConvertedAPI(module: string): string | null {
  const indexPath = join(ROOT, "src", ...module.split("."), "index.ts");
  try {
    return readFileSync(indexPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Read python source files for a task.
 * Truncates very large files to avoid exceeding context limits.
 */
function getPythonSource(task: TaskNode, sourceDir: string): string {
  const MAX_LINES_PER_FILE = 800;
  const chunks: string[] = [];

  for (const file of task.pythonFiles) {
    const fullPath = join(sourceDir, file);
    try {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      if (lines.length > MAX_LINES_PER_FILE) {
        const truncated = lines.slice(0, MAX_LINES_PER_FILE).join("\n");
        chunks.push(
          `\n### File: ${file} (truncated — ${lines.length} lines, showing first ${MAX_LINES_PER_FILE})\n\`\`\`python\n${truncated}\n\`\`\`\n\n> **Note:** This file was truncated. Focus on the public API (class definitions, method signatures, exported functions). Read the full file at \`${fullPath}\` if needed.`
        );
      } else {
        chunks.push(`\n### File: ${file}\n\`\`\`python\n${content}\n\`\`\``);
      }
    } catch {
      chunks.push(`\n### File: ${file}\n(could not read)`);
    }
  }
  return chunks.join("\n");
}

export function buildPrompt(task: TaskNode, taskGraph: TaskGraph): string {
  const conventions = readFileSync(join(ROOT, "CONVENTIONS.md"), "utf-8");
  const typeStubs = readFileSync(
    join(ROOT, "src", "core", "types.ts"),
    "utf-8"
  );

  // Gather already-converted dependency APIs
  const depAPIs: string[] = [];
  for (const dep of task.dependsOn) {
    const api = getConvertedAPI(dep);
    if (api) {
      depAPIs.push(`#### ${dep}\n\`\`\`typescript\n${api}\n\`\`\``);
    } else {
      depAPIs.push(
        `#### ${dep}\n(not yet converted — use interfaces from src/core/types.ts)`
      );
    }
  }

  const pythonSource = getPythonSource(task, taskGraph.sourceDir);
  const outputDir = `src/${task.module.replace(/\./g, "/")}`;
  const testDir = `tests/${task.module.replace(/\./g, "/")}`;

  return `# Task: Convert \`${task.module}\` to TypeScript

## Priority
Layer ${task.layer} — ${task.dependsOn.length === 0 ? "no dependencies, convert freely" : `depends on: ${task.dependsOn.join(", ")}`}

## Shared Conventions (READ CAREFULLY)

${conventions}

## Type Contracts

These are INTERFACES, not runtime classes. Your implementation must satisfy
the relevant interface. Import types with \`import type { ... }\`.

\`\`\`typescript
${typeStubs}
\`\`\`

## Already-Converted Dependencies

${depAPIs.length > 0 ? depAPIs.join("\n\n") : "None — this is a foundational module."}

## Python Source Files to Convert

${pythonSource}

## Instructions

1. Read ALL the Python source above before writing any TypeScript.
2. Create TypeScript files in \`./${outputDir}/\` mirroring the module structure.
3. Preserve ALL public API surface — class names, method names, function names.
4. **Use numpy-ts for all array/matrix math** — it mirrors NumPy's API almost exactly.
   Import via: \`import { np, array, zeros, dot, cross, linalg } from "../core/math/index.js"\`
   Most numpy code translates 1:1: \`np.array()\`, \`np.dot()\`, \`np.linalg.solve()\`, etc.
   Point3D is NDArray shape [3], Points3D is NDArray shape [n,3].
5. **numpy-ts returns union types** — cast when you need a plain number:
   \`const d = np.dot(a, b) as number;\`  \`const n = np.linalg.norm(v) as number;\`
6. Use Manim-specific helpers from \`core/math\` for things NOT in numpy:
   \`interpolate\`, \`bezier\`, \`smooth\`, \`rotateVector\`, \`angleOfVector\`, etc.
7. Import colors from \`src/core/color/index.ts\` — do NOT redefine color constants.
8. Use interfaces from \`src/core/types.ts\` for cross-module type references.
   These are interfaces (IMobject, IVMobject, IAnimation, IScene, etc.),
   NOT runtime classes. Your concrete classes should \`implements\` them.
9. Replace Python-specific patterns:
   - \`**kwargs\` → typed options objects
   - \`@property\` → get/set accessors
   - \`*args\` → rest parameters with explicit types
   - Mutable default arguments → create new instances in method body
   - \`isinstance()\` → TypeScript \`instanceof\` or type guards
   - List comprehensions → \`.map()\` / \`.filter()\` / \`.reduce()\`
   - \`dict\` → \`Map<K,V>\` or typed record, whichever is more natural
   - \`if TYPE_CHECKING:\` blocks → remove; use \`import type\` instead
   - Lazy imports (inside function bodies) → top-level imports
   - \`a + b\` on arrays → \`a.add(b)\`, \`a * scalar\` → \`a.multiply(scalar)\`
10. Create a barrel export \`index.ts\` that re-exports all public API.
11. After writing all files, run \`npm run typecheck\` and fix ALL type errors.
12. Run \`npm run test\` to verify any pre-existing tests for this module pass.
    If a test file exists at \`${testDir}.test.ts\`, ensure it passes.
    If no test file exists, write one with 5-10 tests covering:
    - Constructor defaults and options
    - Core method behavior (happy path)
    - Edge cases (empty input, zero values, boundary conditions)
    - Import the test helpers from \`tests/helpers/point-matchers.ts\` for
      point comparison: \`expect(point).toBeCloseToPoint(expected)\`
13. Do NOT convert rendering/Cairo/OpenGL code line-by-line.
    Mark with \`// TODO: Port from Cairo/OpenGL — needs manual rendering implementation\`
14. Do NOT modify files outside your module directory (\`./${outputDir}/\`).
    Never edit src/core/*, CONVENTIONS.md, or other modules' files.

## Output Location

Write all files to: \`./${outputDir}/\`
Write tests to: \`./tests/${task.module.replace(/\./g, "/")}.test.ts\`

## Quality Checklist (verify before finishing)

- [ ] No \`any\` types (use \`unknown\` + type guards if truly needed)
- [ ] No Python idioms (\`None\` → \`null/undefined\`, \`True\` → \`true\`, etc.)
- [ ] All numpy operations use numpy-ts via \`src/core/math/index.ts\`
- [ ] numpy-ts union return types cast to \`number\` where needed
- [ ] Method chaining preserved (mutating methods return \`this\`)
- [ ] Barrel \`index.ts\` exports everything public
- [ ] \`npm run typecheck\` passes
- [ ] \`npm run test\` passes (or no test failures introduced)
- [ ] No files modified outside ./${outputDir}/
`;
}
