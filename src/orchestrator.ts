#!/usr/bin/env npx tsx
/**
 * Manim-TS Conversion Orchestrator
 *
 * Reads task-graph.json, spawns Claude Code agents layer-by-layer,
 * validates output with tsc, and queues fix-ups for failures.
 *
 * Usage:
 *   npx tsx src/orchestrator.ts [options]
 *
 * Scheduling: dependency-aware — starts any module as soon as its deps
 * are done, filling all agent slots across layers simultaneously.
 *
 * Auto-scaling: modules ≥1000 lines auto-upgrade to opus; modules ≥500
 * lines get an extended timeout (minimum 900s).
 *
 * Options:
 *   --max-parallel=N     Max concurrent agents (default: 5)
 *   --start-layer=N      Resume from layer N (default: 0)
 *   --only=module.name   Only convert a specific module
 *   --dry-run            Print plan without executing
 *   --skip-typecheck     Skip typecheck gate
 *   --timeout=N          Per-agent timeout in seconds (default: 600)
 *   --model=MODEL        Base model (default: sonnet; large modules auto-upgrade to opus)
 *   --gaps               Run gap-filling tasks (missing classes/modules) instead of main conversion
 *   --three-js           Run the three.js migration swarm (renderer + text/math backend)
 */

import { spawn, exec, ChildProcess } from "child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  appendFileSync,
  cpSync,
  rmSync,
} from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { buildPrompt } from "./prompt-builder.js";

// ─── Process Tracking (for cleanup on Ctrl+C) ──────────────

const activeProcesses: Set<ChildProcess> = new Set();

function killProcess(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    if (process.platform === "win32") {
      // taskkill /T kills the entire process tree on Windows
      exec(`taskkill /PID ${proc.pid} /T /F`, () => {});
    } else {
      // Kill process group on Unix
      process.kill(-proc.pid!, "SIGKILL");
    }
  } catch {
    // Process may have already exited
  }
}

process.on("SIGINT", () => {
  console.log(`\n\x1b[33m⚠ Interrupted — killing ${activeProcesses.size} active agents...\x1b[0m`);
  for (const proc of activeProcesses) {
    killProcess(proc);
  }
  process.exit(130);
});

// ─── Types ───────────────────────────────────────────────────

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

interface AgentResult {
  module: string;
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

type LogLevel = "info" | "warn" | "error" | "success";

// ─── Config ──────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TASK_GRAPH_PATH = join(ROOT, "task-graph.json");
const BRIEFS_DIR = join(ROOT, "briefs");
const LOG_FILE = join(ROOT, "orchestrator.log");
const RESULTS_FILE = join(ROOT, "results.json");
const STAGING_DIR = join(ROOT, ".staging");

const args = process.argv.slice(2);

function getArg(name: string, fallback: string): string {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.substring(arg.indexOf("=") + 1) : fallback;
}

const MAX_PARALLEL = parseInt(getArg("max-parallel", "5"));
const START_LAYER = parseInt(getArg("start-layer", "0"));
const ONLY_MODULE = getArg("only", "");
const DRY_RUN = args.includes("--dry-run");
const SKIP_TYPECHECK = args.includes("--skip-typecheck");
const TIMEOUT_SEC = parseInt(getArg("timeout", "600"));
const MODEL = getArg("model", "sonnet");
const RUN_GAPS = args.includes("--gaps");
const RUN_THREE_JS = args.includes("--three-js");
const RUN_RENDERER_MODE = args.includes("--renderer-mode");

// ─── Auto-scaling thresholds ────────────────────────────────
// Modules above these line counts get upgraded automatically.
const OPUS_LINE_THRESHOLD = 1000;   // use opus for modules ≥1000 lines
const LONG_TIMEOUT_THRESHOLD = 500; // extend timeout for modules ≥500 lines
const LONG_TIMEOUT_SEC = Math.max(TIMEOUT_SEC, 900); // at least 15 min for large modules

/** Pick model and timeout for a task based on its size. */
function getAgentConfig(task: TaskNode): { model: string; timeout: number } {
  const lines = task.estimatedLines;
  const model = lines >= OPUS_LINE_THRESHOLD ? "opus" : MODEL;
  const timeout = lines >= LONG_TIMEOUT_THRESHOLD ? LONG_TIMEOUT_SEC : TIMEOUT_SEC;
  return { model, timeout };
}

// ─── Logging ─────────────────────────────────────────────────

const COLORS = {
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  success: "\x1b[32m",
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

function log(level: LogLevel, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const color = COLORS[level];
  const prefix =
    level === "success"
      ? "✓"
      : level === "error"
        ? "✗"
        : level === "warn"
          ? "⚠"
          : "→";
  console.log(
    `${COLORS.dim}${ts}${COLORS.reset} ${color}${prefix}${COLORS.reset} ${msg}`
  );
  appendFileSync(LOG_FILE, `${new Date().toISOString()} [${level}] ${msg}\n`);
}

// ─── Completed Module Tracker ────────────────────────────────

function loadCompletedModules(): Set<string> {
  if (!existsSync(RESULTS_FILE)) return new Set();
  try {
    const results: AgentResult[] = JSON.parse(
      readFileSync(RESULTS_FILE, "utf-8")
    );
    return new Set(results.filter((r) => r.success).map((r) => r.module));
  } catch {
    return new Set();
  }
}

// ─── Staging / Rollback ─────────────────────────────────────

function moduleOutputDir(module: string): string {
  return join(ROOT, "src", ...module.split("."));
}

function snapshotModule(module: string): string | null {
  const dir = moduleOutputDir(module);
  if (!existsSync(dir)) return null;
  const snapshotDir = join(STAGING_DIR, "snapshots", module.replace(/\./g, "_"));
  mkdirSync(dirname(snapshotDir), { recursive: true });
  cpSync(dir, snapshotDir, { recursive: true });
  return snapshotDir;
}

function rollbackModule(module: string, snapshotDir: string | null): void {
  const dir = moduleOutputDir(module);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (snapshotDir && existsSync(snapshotDir)) {
    mkdirSync(dirname(dir), { recursive: true });
    cpSync(snapshotDir, dir, { recursive: true });
  }
}

// ─── Agent Runner ────────────────────────────────────────────

function runAgentWithPrompt(
  task: TaskNode,
  prompt: string
): Promise<AgentResult> {
  const startTime = Date.now();
  const { model, timeout } = getAgentConfig(task);

  // Write brief to disk for debugging / re-runs
  const briefPath = join(BRIEFS_DIR, `${task.module.replace(/\./g, "_")}.md`);
  writeFileSync(briefPath, prompt);

  if (DRY_RUN) {
    log(
      "info",
      `[DRY RUN] Would convert: ${task.module} (${task.estimatedLines} lines, model=${model}, timeout=${timeout}s)`
    );
    return Promise.resolve({
      module: task.module,
      success: true,
      duration: 0,
      stdout: "(dry run)",
      stderr: "",
      exitCode: 0,
    });
  }

  return new Promise((resolvePromise) => {
    const modelTag = model !== MODEL ? ` ${COLORS.warn}[${model}]${COLORS.reset}` : "";
    const timeoutTag = timeout !== TIMEOUT_SEC ? ` ${COLORS.dim}(${timeout}s timeout)${COLORS.reset}` : "";
    log(
      "info",
      `Starting agent for ${COLORS.bold}${task.module}${COLORS.reset} (~${task.estimatedLines} lines)${modelTag}${timeoutTag}`
    );

    // Snapshot existing output for rollback
    const snapshot = snapshotModule(task.module);

    let stdout = "";
    let stderr = "";
    let settled = false;

    // Spawn claude with prompt piped via stdin (avoids OS arg length limits).
    // Use shell: true for Windows compatibility (resolves .cmd wrappers).
    const proc: ChildProcess = spawn(
      "npx",
      [
        "@anthropic-ai/claude-code",
        "-p",                // read prompt from stdin, print result
        "--output-format", "text",
        "--model", model,
        "--dangerously-skip-permissions",
      ],
      {
        cwd: ROOT,
        shell: true,
        env: {
          ...process.env,
          TMPDIR: join(ROOT, ".tmp", task.module.replace(/\./g, "_")),
        },
      }
    );

    // Track for cleanup on Ctrl+C
    activeProcesses.add(proc);

    // Pipe the prompt via stdin instead of CLI argument
    proc.stdin?.write(prompt);
    proc.stdin?.end();

    // Manual timeout — use taskkill on Windows for reliable tree kill
    const timer = setTimeout(() => {
      log("warn", `${task.module} timed out after ${timeout}s — killing`);
      killProcess(proc);
    }, timeout * 1000);

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeProcesses.delete(proc);

      const duration = (Date.now() - startTime) / 1000;
      const success = exitCode === 0;

      if (success) {
        log("success", `${task.module} completed in ${duration.toFixed(1)}s`);
      } else {
        log(
          "error",
          `${task.module} failed (exit ${exitCode}) after ${duration.toFixed(1)}s — rolling back`
        );
        // Rollback: restore snapshot or delete partial writes for new modules
        const dir = moduleOutputDir(task.module);
        if (snapshot) {
          rollbackModule(task.module, snapshot);
        } else if (existsSync(dir)) {
          // No snapshot means module didn't exist before — clean up partial writes
          log("info", `Cleaning partial output for ${task.module}`);
          rmSync(dir, { recursive: true, force: true });
        }
      }

      resolvePromise({
        module: task.module,
        success,
        duration,
        stdout,
        stderr,
        exitCode,
      });
    };

    proc.on("close", (code) => finish(code));
    proc.on("error", (err) => {
      stderr += `\nProcess error: ${err.message}`;
      finish(1);
    });
  });
}

function runAgent(task: TaskNode, taskGraph: TaskGraph): Promise<AgentResult> {
  const prompt = buildPrompt(task, taskGraph);
  return runAgentWithPrompt(task, prompt);
}

// ─── Type Check Gate ─────────────────────────────────────────

async function runTypeCheck(): Promise<{ pass: boolean; errors: string }> {
  return new Promise((resolvePromise) => {
    // Use shell: true so npx.cmd resolves on Windows
    const proc = spawn("npx", ["tsc", "--noEmit", "--pretty"], {
      cwd: ROOT,
      shell: true,
    });

    let output = "";
    const timer = setTimeout(() => proc.kill("SIGTERM"), 120_000);

    proc.stdout?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ pass: code === 0, errors: output });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolvePromise({ pass: false, errors: err.message });
    });
  });
}

// ─── Fix-Up Agent ────────────────────────────────────────────

function filterErrorsForModule(allErrors: string, module: string): string {
  const modulePath = `src/${module.replace(/\./g, "/")}`;
  return allErrors
    .split("\n")
    .filter((line) => line.includes(modulePath) || /^\s/.test(line))
    .join("\n")
    .trim();
}

function getConvertedAPI(module: string): string | null {
  const indexPath = join(ROOT, "src", ...module.split("."), "index.ts");
  try {
    return readFileSync(indexPath, "utf-8");
  } catch {
    return null;
  }
}

async function runFixUp(
  task: TaskNode,
  typeErrors: string,
  _taskGraph: TaskGraph
): Promise<AgentResult> {
  const moduleErrors = filterErrorsForModule(typeErrors, task.module);
  if (!moduleErrors) {
    return {
      module: task.module,
      success: true,
      duration: 0,
      stdout: "(no errors for this module)",
      stderr: "",
      exitCode: 0,
    };
  }

  // Gather dependency APIs so fix-up agent can resolve imports
  const depAPIs: string[] = [];
  for (const dep of task.dependsOn) {
    const api = getConvertedAPI(dep);
    if (api) {
      depAPIs.push(`#### ${dep}\n\`\`\`typescript\n${api}\n\`\`\``);
    }
  }

  const typeStubs = readFileSync(join(ROOT, "src", "core", "types.ts"), "utf-8");

  const fixPrompt = `# Fix TypeScript Errors in \`${task.module}\`

The initial conversion of this module produced type errors. Fix them.

## Type Errors (filtered to this module only)
\`\`\`
${moduleErrors}
\`\`\`

## Type Contracts
\`\`\`typescript
${typeStubs}
\`\`\`

## Already-Converted Dependencies
${depAPIs.length > 0 ? depAPIs.join("\n\n") : "None."}

## Conventions
${readFileSync(join(ROOT, "CONVENTIONS.md"), "utf-8")}

## Instructions
1. Read the type errors carefully
2. Read the existing code in src/${task.module.replace(/\./g, "/")} to understand context
3. Fix each error — use dependency APIs above to resolve import issues
4. Run \`npm run typecheck\` to verify your fixes
5. Do NOT change the public API — only fix internal implementation
6. Do NOT modify files outside this module's directory
`;

  return runAgentWithPrompt(task, fixPrompt);
}

// ─── Dependency-Aware Scheduler ─────────────────────────────
//
// Instead of processing one layer at a time, this scheduler starts
// any module as soon as ALL its dependencies have completed. This
// keeps all agent slots full — if layer 3 has only 1 module, the
// scheduler immediately pulls ready modules from layers 4+ to fill
// the remaining slots.

async function runAllTasks(
  tasks: TaskNode[],
  completedModules: Set<string>,
  taskGraph: TaskGraph,
  allResults: AgentResult[],
): Promise<void> {
  const pending = new Map<string, TaskNode>();
  for (const t of tasks) {
    if (!completedModules.has(t.module)) {
      pending.set(t.module, t);
    }
  }

  const done = new Set<string>(completedModules);
  const active = new Map<string, Promise<AgentResult>>();
  const inProgress = new Set<string>(); // modules currently being worked on
  let lastSaveCount = allResults.length;

  // Build a layer lookup so we can treat same-layer deps as satisfied
  // (same-layer circular deps are by design — agents use `import type` to break cycles)
  const layerOf = new Map<string, number>();
  for (const t of tasks) {
    layerOf.set(t.module, t.layer);
  }

  /** A module is ready when all its cross-layer deps are done and it isn't already running. */
  function getReady(): TaskNode[] {
    const ready: TaskNode[] = [];
    for (const [mod, task] of pending) {
      if (inProgress.has(mod)) continue;
      const myLayer = task.layer;
      const depsReady = task.dependsOn.every((dep) => {
        // Same-layer dep — treat as satisfied (circular deps broken by import type)
        if (layerOf.get(dep) === myLayer) return true;
        // Dep is done or wasn't in our task set to begin with
        return done.has(dep) || !pending.has(dep);
      });
      if (depsReady) ready.push(task);
    }
    // Sort by layer then priority so earlier layers still go first
    ready.sort((a, b) => a.layer - b.layer || a.priority - b.priority);
    return ready;
  }

  function logProgress(): void {
    const total = tasks.length;
    const completed = total - pending.size;
    const pct = ((completed / total) * 100).toFixed(0);
    log("info", `Progress: ${completed}/${total} (${pct}%) — ${active.size} active, ${pending.size} remaining`);
  }

  while (pending.size > 0 || active.size > 0) {
    // Fill up to MAX_PARALLEL from ready modules
    const ready = getReady();
    while (active.size < MAX_PARALLEL && ready.length > 0) {
      const task = ready.shift()!;
      inProgress.add(task.module);

      const p = runAgent(task, taskGraph).then((result) => {
        active.delete(task.module);
        inProgress.delete(task.module);
        allResults.push(result);

        if (result.success) {
          done.add(task.module);
          pending.delete(task.module);
        } else {
          // Keep in pending so it shows as failed, but don't block dependents forever
          // Mark as done so modules that depend on it can still attempt conversion
          done.add(task.module);
          pending.delete(task.module);
          log("warn", `${task.module} failed — dependents will still attempt conversion`);
        }

        return result;
      });
      active.set(task.module, p);
    }

    // Wait for any one to finish
    if (active.size > 0) {
      await Promise.race(active.values());
      logProgress();
    } else if (pending.size > 0) {
      // Deadlock: nothing active, nothing ready, but modules remain
      // This shouldn't happen with valid deps, but guard against it
      const stuck = Array.from(pending.keys());
      log("error", `Deadlock: ${stuck.length} modules have unresolvable dependencies`);
      for (const mod of stuck) {
        log("error", `  ${mod} waits on: ${pending.get(mod)!.dependsOn.filter(d => !done.has(d)).join(", ")}`);
      }
      break;
    }

    // Periodic save (every 5 completions)
    if (!DRY_RUN && allResults.length - lastSaveCount >= 5) {
      writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
      lastSaveCount = allResults.length;
    }
  }
}

// ─── Fix-Up Runner (concurrency-limited) ─────────────────────

async function runFixUps(
  tasks: TaskNode[],
  typeErrors: string,
  taskGraph: TaskGraph
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  const queue = [...tasks];
  const active: Map<string, Promise<AgentResult>> = new Map();

  while (queue.length > 0 || active.size > 0) {
    while (active.size < MAX_PARALLEL && queue.length > 0) {
      const task = queue.shift()!;
      const p = runFixUp(task, typeErrors, taskGraph).then((result) => {
        active.delete(task.module);
        results.push(result);
        return result;
      });
      active.set(task.module, p);
    }
    if (active.size > 0) {
      await Promise.race(active.values());
    }
  }

  return results;
}

// ─── Gap-Filling Tasks ──────────────────────────────────────
//
// These tasks address missing classes/modules identified by comparing
// the Python Manim source against the TypeScript port. Each task is
// a self-contained agent brief with a custom prompt (no Python source
// needed — the agent reads the existing TS code and adds what's missing).

interface GapTask {
  id: string;
  description: string;
  targetFile: string;
  dependsOn: string[];
  estimatedLines: number;
  prompt: string;
}

const GAP_TASKS: GapTask[] = [
  // ── Module 1: VGroup, VDict, VectorizedPoint, CurvesAsSubmobjects, DashedVMobject ──
  {
    id: "gaps.vectorized_mobject.vgroup",
    description: "Add VGroup class to vectorized_mobject.ts",
    targetFile: "src/mobject/types/vectorized_mobject.ts",
    dependsOn: [],
    estimatedLines: 200,
    prompt: `# Gap Task: Add VGroup to vectorized_mobject.ts

## What's Missing
The file \`src/mobject/types/vectorized_mobject.ts\` only exports VMobject.
Python Manim's \`vectorized_mobject.py\` also exports VGroup — a container
that holds multiple VMobjects as submobjects.

VGroup is the MOST USED class in all of Manim. It is currently redefined
as a local stub in 15+ files across the codebase. This task creates the
canonical, shared implementation.

## What to Do
1. Read \`src/mobject/types/vectorized_mobject.ts\` to understand VMobject
2. Read \`src/mobject/mobject/mobject.ts\` to understand the Group pattern
3. Add a \`VGroup\` class that extends VMobject:
   - Constructor accepts \`...vmobjects: VMobject[]\` (adds them as submobjects)
   - Mirrors Python's VGroup behavior exactly
   - Overrides add() to only accept VMobject instances
   - setStyle() propagates to all submobjects
   - setFill() and setStroke() propagate to all submobjects
4. Export VGroup from the barrel \`src/mobject/types/index.ts\`
5. Run \`npm run typecheck\` to verify

## Python Reference (from manim/mobject/types/vectorized_mobject.py)
\`\`\`python
class VGroup(VMobject):
    def __init__(self, *vmobjects, **kwargs):
        super().__init__(**kwargs)
        self.add(*vmobjects)

    def __repr__(self):
        return (
            self.__class__.__name__
            + "("
            + ", ".join(str(mob) for mob in self.submobjects)
            + ")"
        )

    def __str__(self):
        return (
            self.__class__.__name__
            + "("
            + ", ".join(str(mob) for mob in self.submobjects)
            + ")"
        )

    def add(self, *vmobjects):
        if not all(isinstance(m, VMobject) for m in vmobjects):
            raise TypeError("All submobjects must be of type VMobject")
        return super().add(*vmobjects)

    def __add__(self, vmobject):
        return VGroup(*self.submobjects, vmobject)

    def __iadd__(self, vmobject):
        self.add(vmobject)
        return self
\`\`\`

## Rules
- Do NOT modify any files outside \`src/mobject/types/\`
- Match Python Manim behavior exactly
- Export from the barrel index.ts`,
  },

  {
    id: "gaps.vectorized_mobject.vdict",
    description: "Add VDict class to vectorized_mobject.ts",
    targetFile: "src/mobject/types/vectorized_mobject.ts",
    dependsOn: ["gaps.vectorized_mobject.vgroup"],
    estimatedLines: 150,
    prompt: `# Gap Task: Add VDict to vectorized_mobject.ts

## What's Missing
Python Manim's \`vectorized_mobject.py\` exports VDict — a dictionary-like
VMobject container where submobjects are accessed by key names.

## What to Do
1. Read the existing \`src/mobject/types/vectorized_mobject.ts\`
2. Add a \`VDict\` class that extends VGroup (added by previous task):
   - Constructor accepts \`Map<string, VMobject>\` or entries array
   - get(key) / set(key, vmobject) for named access
   - add() updates both the dict and submobjects list
   - remove() by key
   - submobjects stay in sync with the internal map
3. Export VDict from \`src/mobject/types/index.ts\`
4. Run \`npm run typecheck\`

## Python Reference
\`\`\`python
class VDict(VMobject):
    def __init__(self, mapping_or_iterable={}, show_keys=False, **kwargs):
        super().__init__(**kwargs)
        self.show_keys = show_keys
        self.submob_dict = {}
        if isinstance(mapping_or_iterable, Mapping):
            mapping_or_iterable = list(mapping_or_iterable.items())
        for key, value in mapping_or_iterable:
            self.add([(key, value)])

    def __repr__(self):
        return __class__.__name__ + "(" + ", ".join(
            f"({k}, {v})" for k, v in self.submob_dict.items()
        ) + ")"

    def add(self, mapping_or_iterable, **kwargs):
        for key, value in mapping_or_iterable:
            self.submob_dict[key] = value
            super().add(value)
        return self

    def remove(self, key):
        if key in self.submob_dict:
            super().remove(self.submob_dict[key])
            del self.submob_dict[key]
        return self

    def __getitem__(self, key):
        return self.submob_dict[key]

    def __setitem__(self, key, value):
        if key in self.submob_dict:
            self.remove(key)
        self.add([(key, value)])

    def __delitem__(self, key):
        self.remove(key)

    def __contains__(self, key):
        return key in self.submob_dict

    def keys(self):
        return self.submob_dict.keys()

    def values(self):
        return self.submob_dict.values()

    def items(self):
        return self.submob_dict.items()
\`\`\`

## Rules
- Only modify files in \`src/mobject/types/\`
- Match Python behavior exactly`,
  },

  {
    id: "gaps.vectorized_mobject.utilities",
    description: "Add VectorizedPoint, CurvesAsSubmobjects, DashedVMobject",
    targetFile: "src/mobject/types/vectorized_mobject.ts",
    dependsOn: ["gaps.vectorized_mobject.vgroup"],
    estimatedLines: 250,
    prompt: `# Gap Task: Add VectorizedPoint, CurvesAsSubmobjects, DashedVMobject

## What's Missing
Python Manim's \`vectorized_mobject.py\` exports three utility classes that
are missing from the TypeScript port:

1. **VectorizedPoint** — An invisible single-point VMobject used as a
   positional anchor/reference point.
2. **CurvesAsSubmobjects** — Takes a VMobject and splits each of its
   bezier curves into individual VMobject submobjects.
3. **DashedVMobject** — Renders any VMobject with a dashed stroke pattern
   by sampling points along the path and creating dash segments.

## What to Do
1. Read \`src/mobject/types/vectorized_mobject.ts\` for VMobject/VGroup
2. Add all three classes to the same file
3. Export them from \`src/mobject/types/index.ts\`
4. Run \`npm run typecheck\`

## Python Reference

### VectorizedPoint
\`\`\`python
class VectorizedPoint(VMobject):
    def __init__(self, location=ORIGIN, color=BLACK,
                 fill_opacity=0, stroke_width=0, **kwargs):
        self.location = location
        super().__init__(
            color=color, fill_opacity=fill_opacity,
            stroke_width=stroke_width, **kwargs
        )
        self.set_points(np.array([location]))

    def get_location(self):
        return np.array(self.points[0])

    def set_location(self, new_loc):
        self.set_points(np.array([new_loc]))
\`\`\`

### CurvesAsSubmobjects
\`\`\`python
class CurvesAsSubmobjects(VGroup):
    def __init__(self, vmobject, **kwargs):
        super().__init__(**kwargs)
        for tup in vmobject.get_cubic_bezier_tuples():
            part = VMobject()
            part.set_points(tup)
            part.match_style(vmobject)
            self.add(part)
\`\`\`

### DashedVMobject
\`\`\`python
class DashedVMobject(VMobject):
    def __init__(self, vmobject, num_dashes=15,
                 dashed_ratio=0.5, dash_offset=0,
                 color=WHITE, **kwargs):
        self.dashed_ratio = dashed_ratio
        self.num_dashes = num_dashes
        super().__init__(color=color, **kwargs)
        # ... creates dashes by sampling vmobject at intervals
\`\`\`

## Rules
- Only modify files in \`src/mobject/types/\`
- Match Python Manim behavior exactly`,
  },

  // ── Module 2: ParametricSurface ──
  {
    id: "gaps.three_d.parametric_surface",
    description: "Add ParametricSurface to three_dimensions.ts",
    targetFile: "src/mobject/three_d/three_dimensions.ts",
    dependsOn: [],
    estimatedLines: 200,
    prompt: `# Gap Task: Add ParametricSurface to three_dimensions.ts

## What's Missing
Python Manim's \`three_dimensions.py\` exports ParametricSurface — a subclass
of Surface that takes a user-defined function (u, v) → (x, y, z) and generates
the 3D mesh. The TypeScript port has Surface but not ParametricSurface.

## What to Do
1. Read \`src/mobject/three_d/three_dimensions.ts\` to understand the Surface class
2. Add ParametricSurface as a subclass of Surface:
   - Constructor takes \`func: (u: number, v: number) => Point3D\`
   - uRange and vRange parameters (default [-1, 1])
   - resolution parameter (default [32, 32])
   - Generates the mesh by evaluating func over the UV grid
3. Export from \`src/mobject/three_d/index.ts\`
4. Run \`npm run typecheck\`

## Python Reference
\`\`\`python
class ParametricSurface(Surface):
    def __init__(
        self,
        func,
        u_range=[-1, 1],
        v_range=[-1, 1],
        resolution=(32, 32),
        **kwargs
    ):
        self.func = func
        self.u_range = u_range
        self.v_range = v_range
        self.resolution = resolution
        super().__init__(**kwargs)

    def uv_func(self, u, v):
        return self.func(u, v)

    def init_points(self):
        u_values = np.linspace(*self.u_range, self.resolution[0])
        v_values = np.linspace(*self.v_range, self.resolution[1])
        # Build mesh from func evaluations ...
\`\`\`

## Rules
- Only modify files in \`src/mobject/three_d/\`
- Match Python Manim behavior exactly`,
  },

  // ── Module 3: OpenGL Compatibility ──
  {
    id: "gaps.opengl.compatibility",
    description: "Add ConvertToOpenGL compatibility layer",
    targetFile: "src/mobject/opengl/opengl_compatibility.ts",
    dependsOn: [],
    estimatedLines: 100,
    prompt: `# Gap Task: Add OpenGL Compatibility Layer

## What's Missing
Python Manim has \`mobject/opengl/opengl_compatibility.py\` which exports a
\`ConvertToOpenGL\` metaclass. This enables runtime switching between Cairo
and OpenGL mobject backends — animation code is renderer-agnostic.

In TypeScript we can't use metaclasses, but we can achieve the same effect
with a factory/registry pattern.

## What to Do
1. Create \`src/mobject/opengl/opengl_compatibility.ts\`
2. Implement a compatibility layer that:
   - Maintains a registry mapping standard classes to OpenGL equivalents
     (e.g., VMobject → OpenGLVMobject, Mobject → OpenGLMobject)
   - Provides a \`convertToOpenGL(MobjectClass)\` function that returns
     the OpenGL equivalent class if one is registered
   - Provides a \`registerOpenGLEquivalent(standard, opengl)\` function
   - Works at the class level (not instance level)
3. Export from \`src/mobject/opengl/index.ts\`
4. Run \`npm run typecheck\`

## Python Reference
\`\`\`python
class ConvertToOpenGL(type):
    _opengl_class_mapping = {}

    def __new__(mcls, name, bases, namespace):
        cls = super().__new__(mcls, name, bases, namespace)
        opengl_cls_name = "OpenGL" + name
        for parent_module in sys.modules.values():
            opengl_cls = getattr(parent_module, opengl_cls_name, None)
            if opengl_cls is not None:
                mcls._opengl_class_mapping[cls] = opengl_cls
                break
        return cls

    @classmethod
    def get_opengl_class(mcls, cls):
        return mcls._opengl_class_mapping.get(cls, cls)
\`\`\`

## TypeScript Approach
Since TS has no metaclasses, use a Map-based registry:
\`\`\`typescript
const openglClassMap = new Map<Function, Function>();

export function registerOpenGLEquivalent(standard: Function, opengl: Function): void {
  openglClassMap.set(standard, opengl);
}

export function convertToOpenGL<T extends Function>(cls: T): T {
  return (openglClassMap.get(cls) as T) ?? cls;
}
\`\`\`

## Rules
- Create \`src/mobject/opengl/opengl_compatibility.ts\` as a new file
- Only modify files in \`src/mobject/opengl/\`
- Keep it simple — factory/registry pattern, not metaclass emulation`,
  },

  // ── Module 4: ImageMobject barrel export ──
  {
    id: "gaps.types.image_mobject_export",
    description: "Ensure ImageMobject is exported from types barrel",
    targetFile: "src/mobject/types/index.ts",
    dependsOn: [],
    estimatedLines: 20,
    prompt: `# Gap Task: Verify ImageMobject Barrel Export

## What to Do
1. Read \`src/mobject/types/index.ts\`
2. Read \`src/mobject/types/image_mobject/index.ts\`
3. Verify ImageMobject is properly exported from the types barrel
4. If not, add the export
5. Run \`npm run typecheck\`

## Rules
- Only modify \`src/mobject/types/index.ts\` if needed
- Do NOT modify any other files`,
  },
];

/** Convert a GapTask into a TaskNode compatible with the orchestrator's runner. */
function gapToTaskNode(gap: GapTask): TaskNode {
  return {
    module: gap.id,
    pythonFiles: [],
    dependsOn: gap.dependsOn,
    estimatedLines: gap.estimatedLines,
    layer: 99, // gap tasks run in their own "layer"
    priority: 0,
  };
}

/** Build a full agent prompt for a gap task (includes conventions + type stubs). */
function buildGapPrompt(gap: GapTask): string {
  const conventions = readFileSync(join(ROOT, "CONVENTIONS.md"), "utf-8");
  const typeStubs = readFileSync(join(ROOT, "src", "core", "types.ts"), "utf-8");

  return `${gap.prompt}

## Shared Conventions
${conventions}

## Type Contracts
\`\`\`typescript
${typeStubs}
\`\`\`

## Quality Checklist
- [ ] No \`any\` types
- [ ] All numpy operations use numpy-ts via \`src/core/math/index.ts\`
- [ ] Barrel index.ts updated with new exports
- [ ] \`npm run typecheck\` passes
- [ ] No files modified outside the target module directory
`;
}

/** Run gap-filling tasks through the same agent infrastructure. */
async function runGapTasks(allResults: AgentResult[]): Promise<void> {
  let tasks = GAP_TASKS;
  if (ONLY_MODULE) {
    tasks = tasks.filter((g) => g.id === ONLY_MODULE);
  }

  const completedModules = loadCompletedModules();
  const pending = tasks.filter((g) => !completedModules.has(g.id));

  if (pending.length === 0) {
    log("info", "All gap tasks already completed");
    return;
  }

  log("info", `Running ${pending.length} gap-filling tasks`);

  const done = new Set<string>(completedModules);
  const active = new Map<string, Promise<AgentResult>>();
  const inProgress = new Set<string>();

  // Map gap IDs to their GapTask for prompt building
  const gapMap = new Map<string, GapTask>();
  for (const g of pending) gapMap.set(g.id, g);

  function getReady(): GapTask[] {
    const ready: GapTask[] = [];
    for (const g of pending) {
      if (done.has(g.id) || inProgress.has(g.id)) continue;
      const depsReady = g.dependsOn.every((d) => done.has(d));
      if (depsReady) ready.push(g);
    }
    return ready;
  }

  let remaining = pending.length;
  while (remaining > 0 || active.size > 0) {
    const ready = getReady();
    while (active.size < MAX_PARALLEL && ready.length > 0) {
      const gap = ready.shift()!;
      const taskNode = gapToTaskNode(gap);
      inProgress.add(gap.id);

      const prompt = buildGapPrompt(gap);
      const p = runAgentWithPrompt(taskNode, prompt).then((result) => {
        active.delete(gap.id);
        inProgress.delete(gap.id);
        allResults.push(result);

        if (result.success) {
          done.add(gap.id);
          remaining--;
          log("success", `Gap task ${gap.id}: ${gap.description}`);
        } else {
          done.add(gap.id); // don't block dependents
          remaining--;
          log("warn", `Gap task ${gap.id} failed — dependents will still attempt`);
        }
        return result;
      });
      active.set(gap.id, p);
    }

    if (active.size > 0) {
      await Promise.race(active.values());
    } else if (remaining > 0) {
      const stuck = pending.filter((g) => !done.has(g.id)).map((g) => g.id);
      log("error", `Deadlock in gap tasks: ${stuck.join(", ")}`);
      break;
    }
  }
}

// ─── three.js Migration Tasks ───────────────────────────────
//
// Moves the rendering backend from @napi-rs/canvas / Canvas2D to three.js
// (WebGL). Engine math/mobjects/animations are preserved; only the
// renderer + text/math backend change. Uses three.js for the renderer,
// MathJax for math, and opentype.js for text glyphs.
//
// Run with:  npx tsx src/orchestrator.ts --three-js
//
// Phases:
//   1. Foundation   — three.js renderer singleton, materials, geometry builders
//   2. Mobject      — VMobject/Mobject → three.js Object3D adapters
//   3. Scene        — scene/camera wiring, resize, family syncer
//   4. Text & Math  — MathJax LaTeX→SVG→VMobject, opentype.js glyphs
//   5. 3D           — Surface / Polyhedron normals + lighting
//   6. Demo         — migrate demo/real-demo.ts + index.html to three.js
//   7. Cleanup      — retire Canvas2D paths, dispose helpers, smoke tests
//   8. Docs         — migration guide, API changes, CHANGES.md

const THREE_JS_TASKS: GapTask[] = [
  // ── Phase 1: Foundation ────────────────────────────────────
  {
    id: "threejs.core.renderer",
    description: "Create three.js renderer singleton + WebGL canvas bootstrapping",
    targetFile: "src/renderer/three/three_renderer.ts",
    dependsOn: [],
    estimatedLines: 250,
    prompt: `# three.js Task: Renderer Singleton

Create \`src/renderer/three/three_renderer.ts\` exporting a \`ThreeRenderer\`
class that owns a single \`THREE.WebGLRenderer\`, a \`THREE.Scene\`, and a
camera slot.

## Responsibilities
- Attach to a provided \`HTMLCanvasElement\` (antialias: true, alpha: true).
- Configure sRGB output, tone mapping off (linear for accurate Manim colors).
- Expose \`render()\`, \`resize(w, h)\`, \`setCamera(cam)\`, \`dispose()\`.
- Expose the underlying \`THREE.Scene\` for mobject adapters to attach to.
- Use \`PerspectiveCamera\` by default; accept \`OrthographicCamera\` too.
- Set clear color from Manim's \`config.background_color\` when available.

## Rules
- Install deps via npm if missing: \`three\`, \`@types/three\`.
- Export from \`src/renderer/three/index.ts\` (create barrel).
- Do NOT modify any file outside \`src/renderer/three/\`.
- \`npm run typecheck\` must pass.`,
  },

  {
    id: "threejs.core.materials",
    description: "Stroke + fill materials (Line2 / MeshBasicMaterial wrappers)",
    targetFile: "src/renderer/three/three_materials.ts",
    dependsOn: ["threejs.core.renderer"],
    estimatedLines: 180,
    prompt: `# three.js Task: Materials

Create \`src/renderer/three/three_materials.ts\` with two factories:

- \`makeStrokeMaterial(color, width, opacity)\` — returns a \`LineMaterial\`
  from \`three/examples/jsm/lines/LineMaterial.js\` (world-space stroke width,
  NOT the gl line-width which is driver-limited).
- \`makeFillMaterial(color, opacity)\` — returns a \`MeshBasicMaterial\`
  (side: THREE.DoubleSide, transparent if opacity<1, depthWrite: false for
  overlapping VMobject fills).

ManimColor → three.Color bridge: use \`ManimColor.toHex()\` or RGB array.

Install \`three\` examples (they ship with the package; import from
\`three/examples/jsm/lines/LineMaterial.js\` and \`.../Line2.js\`).

## Rules
- Export from \`src/renderer/three/index.ts\`.
- Do NOT modify files outside \`src/renderer/three/\`.
- Import ManimColor from \`src/utils/color/manim_colors.js\`.`,
  },

  {
    id: "threejs.core.geometry",
    description: "Bezier → LineGeometry + Shape fill triangulation",
    targetFile: "src/renderer/three/three_geometry.ts",
    dependsOn: ["threejs.core.renderer"],
    estimatedLines: 350,
    prompt: `# three.js Task: Geometry Builders

Create \`src/renderer/three/three_geometry.ts\` with converters from manim-ts
VMobject point data to three.js BufferGeometries.

## Functions
- \`vmobjectToLineGeometry(points: Points3D, sampling: number = 20)\` —
  Samples each cubic bezier segment into \`sampling\` polyline points and
  returns a \`LineGeometry\` (from three/examples/jsm/lines/LineGeometry.js)
  ready for \`Line2\`.
- \`vmobjectToFillGeometry(points: Points3D)\` — Builds the fill polygon
  from the subpath outline(s), triangulates with \`earcut\` (already in
  dependencies), and returns a \`THREE.BufferGeometry\` with indexed
  triangles.
- Handle subpath splits on \`null\`-style markers the same way VMobject
  already does (reuse existing helpers in \`src/mobject/types/vectorized_mobject.ts\`).

## Point layout
VMobject uses Manim's 3k+1 bezier layout (anchor, handle, handle, anchor, …).
Read \`src/mobject/types/vectorized_mobject.ts\` to confirm the exact stride
and subpath split convention before writing.

## Rules
- Use numpy-ts only for math (no custom vector classes).
- Export from \`src/renderer/three/index.ts\`.
- Do NOT modify files outside \`src/renderer/three/\`.`,
  },

  {
    id: "threejs.core.camera",
    description: "Adapter from manim Camera → three.js camera",
    targetFile: "src/renderer/three/three_camera.ts",
    dependsOn: ["threejs.core.renderer"],
    estimatedLines: 200,
    prompt: `# three.js Task: Camera Adapter

Manim uses frame_width / frame_height (default 14.2 × 8.0) with origin at
center. three.js cameras use fov/aspect or left/right/top/bottom.

Create \`src/renderer/three/three_camera.ts\` exporting:
- \`makeOrthoCamera(frameWidth, frameHeight)\` → \`THREE.OrthographicCamera\`
  positioned at z = 10, looking at origin, with bounds set so Manim scene
  coords map 1:1 to world coords (i.e. x ∈ [-fw/2, +fw/2]).
- \`makePerspectiveCamera(frameWidth, frameHeight, fovDeg = 50)\` —
  distance computed so that a \`frameHeight\`-tall object at z=0 fills the
  view exactly, matching Python Manim's ThreeDCamera phi/theta conventions.
- \`applyPhiTheta(camera, phi, theta, focalDistance)\` — Manim's spherical
  camera rotation (phi = polar, theta = azimuth).

Reference: \`src/camera/camera.py\` (Python Manim) for frame defaults.

## Rules
- Only modify files in \`src/renderer/three/\`.
- Export from barrel.`,
  },

  // ── Phase 2: Mobject adapters ──────────────────────────────
  {
    id: "threejs.mobject.vmobject_adapter",
    description: "VMobject → three.js Object3D (Line2 stroke + Mesh fill)",
    targetFile: "src/renderer/three/adapters/vmobject_adapter.ts",
    dependsOn: ["threejs.core.materials", "threejs.core.geometry"],
    estimatedLines: 280,
    prompt: `# three.js Task: VMobject Adapter

Create \`src/renderer/three/adapters/vmobject_adapter.ts\` exporting a
\`VMobjectAdapter\` class that maintains one \`THREE.Group\` per VMobject,
containing a \`Line2\` for stroke and a \`THREE.Mesh\` for fill.

## Interface
\`\`\`ts
class VMobjectAdapter {
  readonly group: THREE.Group;
  constructor(vm: VMobject);
  update(): void;   // re-read points + style, update geometry & materials
  dispose(): void;  // dispose geometries and materials
}
\`\`\`

## \`update()\` behavior
- Rebuild LineGeometry from \`vm.points\` via \`vmobjectToLineGeometry\`.
- Rebuild fill BufferGeometry via \`vmobjectToFillGeometry\` if fillOpacity > 0.
- Update material color/opacity/strokeWidth in place (don't recreate unless
  a property not settable on existing material changes).
- Skip fill if \`vm.fillOpacity === 0\`; skip stroke if strokeWidth === 0.

## Rules
- Do NOT modify VMobject itself.
- Only modify files under \`src/renderer/three/adapters/\`.`,
  },

  {
    id: "threejs.mobject.mobject_adapter",
    description: "Generic Mobject → three.js (dispatch, image, 3D mesh)",
    targetFile: "src/renderer/three/adapters/mobject_adapter.ts",
    dependsOn: ["threejs.mobject.vmobject_adapter"],
    estimatedLines: 220,
    prompt: `# three.js Task: Mobject Dispatch Adapter

Create \`src/renderer/three/adapters/mobject_adapter.ts\` exporting
\`mobjectToThree(mob)\` that dispatches on mobject type:

- \`VMobject\`   → \`VMobjectAdapter\`
- \`ImageMobject\` → \`THREE.Mesh\` with \`MeshBasicMaterial({ map: tex })\`
- \`Surface\` / \`Polyhedron\` (3D) → \`THREE.Mesh\` with indexed
  BufferGeometry + \`MeshStandardMaterial\` (needs lighting — will wire in
  a later task).
- \`VGroup\` / Group → recursively adapt children, attach to a parent Group.

Use a single registry pattern (Map<class, adapterFactory>) so future
mobjects can register themselves.

## Rules
- Only modify files under \`src/renderer/three/adapters/\`.
- Read VMobject / Surface / ImageMobject to confirm field names.`,
  },

  {
    id: "threejs.mobject.family_syncer",
    description: "Per-frame diff between scene.mobjects and three scene graph",
    targetFile: "src/renderer/three/family_syncer.ts",
    dependsOn: ["threejs.mobject.mobject_adapter"],
    estimatedLines: 200,
    prompt: `# three.js Task: Family Syncer

Create \`src/renderer/three/family_syncer.ts\` exporting a \`FamilySyncer\`
that diffs the scene's mobject family against the mounted three.js group
each frame:

- Adds adapters for newly-added mobjects.
- Removes+disposes adapters for removed mobjects.
- Calls \`adapter.update()\` on every mobject flagged dirty (for now, all).

Maintain a \`Map<Mobject, Adapter>\` keyed by identity.

## Rules
- No custom diff DSL — a simple set-diff is fine.
- Only modify files under \`src/renderer/three/\`.`,
  },

  // ── Phase 3: Scene integration ─────────────────────────────
  {
    id: "threejs.scene.impl",
    description: "ThreeScene: mount renderer to canvas, run render loop",
    targetFile: "src/scene/three_scene.ts",
    dependsOn: ["threejs.mobject.family_syncer", "threejs.core.camera"],
    estimatedLines: 250,
    prompt: `# three.js Task: ThreeScene

Create \`src/scene/three_scene.ts\` exporting \`ThreeScene\` — a Scene
subclass whose render backend is three.js (not Canvas2D).

## Responsibilities
- Accept an \`HTMLCanvasElement\` in the constructor.
- Wire \`ThreeRenderer\` + \`FamilySyncer\` + Manim camera adapter.
- \`play(anim)\` / \`wait(t)\` drive a requestAnimationFrame loop that calls
  \`syncer.sync()\` then \`renderer.render()\`.
- Keep the existing Scene API (add/remove/clearAll/play/wait) behaviorally
  identical to \`src/scene/scene.ts\`.

Read \`src/scene/scene.ts\` first — match its public surface.

## Rules
- Do NOT modify \`scene.ts\`. Subclass it.
- Export from \`src/scene/index.ts\`.`,
  },

  {
    id: "threejs.scene.resize",
    description: "Canvas resize handler (DPR-aware)",
    targetFile: "src/renderer/three/resize_handler.ts",
    dependsOn: ["threejs.core.renderer"],
    estimatedLines: 100,
    prompt: `# three.js Task: Resize Handler

Create \`src/renderer/three/resize_handler.ts\` exporting
\`attachResize(renderer, camera, canvas)\` that observes canvas size
(ResizeObserver) and updates renderer size + camera projection
(devicePixelRatio-aware, capped at 2 to avoid Retina thrash).

## Rules
- Only modify files under \`src/renderer/three/\`.
- Return an unsubscribe function.`,
  },

  // ── Phase 4: Text & Math backend ───────────────────────────
  {
    id: "threejs.text.mathjax",
    description: "MathJax LaTeX → SVG string renderer",
    targetFile: "src/mobject/text/mathjax_renderer.ts",
    dependsOn: [],
    estimatedLines: 180,
    prompt: `# three.js Task: MathJax Renderer

Install \`mathjax-full\` via npm. Create
\`src/mobject/text/mathjax_renderer.ts\` exporting \`texToSvg(tex: string,
opts?: { display?: boolean })\` that returns an SVG string with paths.

Use MathJax's CommonHTML or SVG output in headless mode (no DOM needed).
Reference: mathjax-full README (ts/mathjax3 path-only SVG adaptor).

Output must be a plain SVG string with \`<path d="…"/>\` elements — no
\`<use>\` references (resolve all glyphs inline).

## Rules
- Keep MathJax startup lazy (initialize on first call, reuse for subsequent).
- Export from \`src/mobject/text/index.ts\` (create barrel if missing).`,
  },

  {
    id: "threejs.text.svg_parser",
    description: "SVG path d-attr → cubic bezier Points3D",
    targetFile: "src/mobject/text/svg_path_to_bezier.ts",
    dependsOn: [],
    estimatedLines: 250,
    prompt: `# three.js Task: SVG path → bezier points

Create \`src/mobject/text/svg_path_to_bezier.ts\` exporting
\`svgPathToPoints(d: string): Points3D\` that parses an SVG \`d\` string via
\`svg-path-commander\` (already installed), converts every segment to a
cubic bezier, and returns a VMobject-ready Points3D in Manim's 3k+1 layout
(anchor, handle, handle, anchor, …). Subpath boundaries use the same
marker convention as existing VMobject code — read
\`src/mobject/types/vectorized_mobject.ts\` and match exactly.

Quadratics should be converted to cubics via the standard formula.
Lines become straight cubic beziers (handles at 1/3 and 2/3 along).
Arcs should be converted to cubic beziers (svg-path-commander has a
\`normalizePath\` helper).

## Rules
- Return numpy-ts NDArray shape \`[n, 3]\`.
- Only modify files under \`src/mobject/text/\`.`,
  },

  {
    id: "threejs.text.mathtex_browser",
    description: "MathTex browser-side: tex → VMobject via MathJax + SVG parser",
    targetFile: "src/mobject/text/mathtex_browser.ts",
    dependsOn: ["threejs.text.mathjax", "threejs.text.svg_parser"],
    estimatedLines: 220,
    prompt: `# three.js Task: MathTex Browser Backend

Create \`src/mobject/text/mathtex_browser.ts\` exporting a browser-capable
\`MathTex\` implementation:

1. Call \`texToSvg(tex)\` (from mathjax_renderer).
2. Parse the SVG with cheerio (already installed); iterate top-level
   \`<path>\` elements.
3. Each \`<path d="…">\` becomes one VMobject submobject (child) via
   \`svgPathToPoints\`. The collection is wrapped in a VGroup.
4. Apply the SVG root transform (scale/translate from viewBox) so the
   resulting group sits at Manim scene coords with reasonable default size.

Match the existing \`MathTex\` API (\`src/mobject/text/mathtex.ts\` if it
exists, or look for stubs) so the demo can swap over by changing imports.

## Rules
- Only modify files under \`src/mobject/text/\`.
- Use VGroup from \`src/mobject/types/vectorized_mobject.ts\`.`,
  },

  {
    id: "threejs.text.glyph",
    description: "opentype.js → GlyphVMobject for plain text",
    targetFile: "src/mobject/text/glyph_vmobject.ts",
    dependsOn: ["threejs.text.svg_parser"],
    estimatedLines: 250,
    prompt: `# three.js Task: GlyphVMobject

Install \`opentype.js\`. Create \`src/mobject/text/glyph_vmobject.ts\`
exporting \`Text(content, opts)\` that:

1. Loads a TTF/OTF font once (default: a bundled free font; let the caller
   override via \`opts.font\`).
2. For each character, extracts the glyph's SVG \`d\` string via
   \`opentype.Glyph.getPath(...).toPathData(3)\`.
3. Passes each \`d\` through \`svgPathToPoints\` to get a VMobject.
4. Lays glyphs out left-to-right using opentype's advance widths.
5. Returns a VGroup of per-character VMobjects.

This is the 1:1 analogue of Python Manim's Pango path, scaled for browser.

## Rules
- Keep the font load lazy + cached.
- Only modify files under \`src/mobject/text/\`.`,
  },

  // ── Phase 5: 3D mobjects ───────────────────────────────────
  {
    id: "threejs.three_d.surface",
    description: "Surface → three.js Mesh with proper normals",
    targetFile: "src/renderer/three/adapters/surface_adapter.ts",
    dependsOn: ["threejs.mobject.mobject_adapter"],
    estimatedLines: 240,
    prompt: `# three.js Task: Surface Adapter

Create \`src/renderer/three/adapters/surface_adapter.ts\` adapting
manim-ts \`Surface\` / \`ParametricSurface\` to a three.js
\`THREE.Mesh\` with:
- Indexed BufferGeometry built from the surface's uv-grid samples.
- Per-vertex normals computed via \`geometry.computeVertexNormals()\`.
- \`MeshStandardMaterial\` with Manim's checkerboard_colors applied as
  per-face colors where possible (use vertex-color attribute or split
  geometry into two sub-meshes).

Read \`src/mobject/three_d/three_dimensions.ts\` for Surface's resolution
and color-pattern conventions.

## Rules
- Only modify files under \`src/renderer/three/adapters/\`.`,
  },

  {
    id: "threejs.three_d.polyhedra",
    description: "Polyhedron → three.js Mesh",
    targetFile: "src/renderer/three/adapters/polyhedron_adapter.ts",
    dependsOn: ["threejs.mobject.mobject_adapter"],
    estimatedLines: 180,
    prompt: `# three.js Task: Polyhedron Adapter

Create \`src/renderer/three/adapters/polyhedron_adapter.ts\` converting
manim-ts Polyhedron instances (Tetrahedron, Octahedron, Icosahedron,
Dodecahedron) to \`THREE.Mesh\`. Each face becomes indexed triangles;
normals computed from face orientation.

Optionally keep the edge wireframe as a \`LineSegments\` child.

## Rules
- Only modify files under \`src/renderer/three/adapters/\`.
- Read \`src/mobject/three_d/polyhedra/\` for the face/vertex schema.`,
  },

  {
    id: "threejs.three_d.lighting",
    description: "Default 3-point lighting rig for 3D scenes",
    targetFile: "src/renderer/three/lighting.ts",
    dependsOn: ["threejs.core.renderer"],
    estimatedLines: 90,
    prompt: `# three.js Task: Default Lighting

Create \`src/renderer/three/lighting.ts\` exporting
\`defaultLightingRig(scene)\` that adds:
- \`AmbientLight\` (0.4 intensity)
- key \`DirectionalLight\` at (5, 5, 10)
- fill \`DirectionalLight\` at (-5, 2, 5) (lower intensity)

Called automatically by ThreeScene when any 3D mobject is first added.

## Rules
- Only modify files under \`src/renderer/three/\`.`,
  },

  // ── Phase 6: Demo migration ────────────────────────────────
  {
    id: "threejs.demo.real_demo",
    description: "Port demo/real-demo.ts from Canvas2D to ThreeScene",
    targetFile: "demo/real-demo.ts",
    dependsOn: [
      "threejs.scene.impl",
      "threejs.text.mathtex_browser",
      "threejs.three_d.surface",
      "threejs.three_d.polyhedra",
    ],
    estimatedLines: 600,
    prompt: `# three.js Task: Migrate Demo

Rewrite \`demo/real-demo.ts\` to use \`ThreeScene\` (the new three.js
backend) instead of the Canvas2D \`Scene\`. The HTML overlay for text
stays as-is for now; additionally wire \`MathTex\` (browser) where buttons
already generate TeX via KaTeX — the KaTeX overlay can remain as a
fallback, but NEW demos should use MathTex + VGroup paths.

Preserve:
- All button handlers and tab structure.
- The \`sceneToPercent\` helper (DOM overlay coords).
- The 24 text demos — they keep working as overlays.

Change:
- Scene construction: \`new ThreeScene(canvas)\` instead of the current
  Canvas2D scene.
- Remove \`scene.redraw()\` calls if the new scene auto-rerenders.

Read \`demo/real-demo.ts\` first — it is large; preserve every tab.

## Rules
- Do NOT delete existing demos.
- Verify \`npm run demo\` starts without runtime errors (you can't run it,
  but \`npm run typecheck\` must pass).`,
  },

  {
    id: "threejs.demo.index_html",
    description: "Update demo/index.html canvas attrs + MathTex tab",
    targetFile: "demo/index.html",
    dependsOn: ["threejs.demo.real_demo"],
    estimatedLines: 80,
    prompt: `# three.js Task: Demo HTML Touch-up

Minor updates to \`demo/index.html\`:
- Add a \`#canvas-root\` parent so ThreeScene can attach (if it doesn't
  already use \`#manim-canvas\` directly — check the impl).
- Add an optional new tab "MathTex (native)" with 4–5 buttons that use the
  engine's new MathTex path instead of KaTeX overlay.

Do NOT remove any existing tabs or buttons. This is additive.

## Rules
- Only modify \`demo/index.html\`.`,
  },

  // ── Phase 7: Cleanup ───────────────────────────────────────
  {
    id: "threejs.cleanup.retire_canvas2d",
    description: "Mark Canvas2D renderer paths as deprecated (not deleted)",
    targetFile: "src/renderer/cairo_renderer.ts",
    dependsOn: ["threejs.demo.real_demo"],
    estimatedLines: 60,
    prompt: `# three.js Task: Deprecate Canvas2D Renderer

Find the Canvas2D / Cairo renderer modules in \`src/renderer/\` and add
\`@deprecated\` JSDoc tags pointing to \`ThreeRenderer\` as the replacement.
Do NOT delete any code yet — the server-side @napi-rs/canvas path may still
be used for video export.

Find any \`scene.redraw\`-style manual render calls that are now unnecessary
(ThreeScene auto-rerenders) and deprecate them similarly.

## Rules
- Only add JSDoc. Do not change runtime behavior.
- List every file touched in the commit message section of your output.`,
  },

  {
    id: "threejs.cleanup.smoke_tests",
    description: "Vitest smoke tests for three.js renderer construction",
    targetFile: "tests/renderer/three_smoke.test.ts",
    dependsOn: ["threejs.scene.impl"],
    estimatedLines: 180,
    prompt: `# three.js Task: Smoke Tests

Create \`tests/renderer/three_smoke.test.ts\` with vitest tests that:
- Construct a \`ThreeRenderer\` with a fake canvas (use \`node-canvas\` or
  jsdom + \`HTMLCanvasElement\` mock — whichever works headlessly).
- Add a \`Circle\`, assert \`scene.children.length === 1\` after sync.
- Add then remove a VMobject; assert disposal happened (geometries/materials
  are disposed — track via spy).

If WebGL isn't available in the test env, use \`gl\` (headless-gl) or skip
via \`test.skipIf(!hasWebGL)\`.

## Rules
- Only create files under \`tests/renderer/\`.
- Tests must pass via \`npm test\`.`,
  },

  // ── Phase 8: Documentation ─────────────────────────────────
  {
    id: "threejs.docs.migration_guide",
    description: "Write THREE_MIGRATION.md guide",
    targetFile: "THREE_MIGRATION.md",
    dependsOn: ["threejs.demo.real_demo"],
    estimatedLines: 200,
    prompt: `# three.js Task: Migration Guide

Create \`THREE_MIGRATION.md\` at repo root covering:
- Why three.js (browser parity with Python Manim Community's OpenGL renderer).
- What changed (renderer, text/math backend); what didn't (mobjects, animations, math).
- How to port a script (one before/after example).
- Known differences vs Python Manim (e.g. GPU stroke widths).
- List of new dependencies: three, mathjax-full, opentype.js.

## Rules
- Keep under 300 lines.
- No emojis.`,
  },

  {
    id: "threejs.docs.changes",
    description: "Append three.js migration section to CHANGES.md",
    targetFile: "CHANGES.md",
    dependsOn: ["threejs.docs.migration_guide"],
    estimatedLines: 80,
    prompt: `# three.js Task: CHANGES.md Entry

Append to \`CHANGES.md\` a new section documenting the three.js migration:
date 2026-04-13, list of new modules created under \`src/renderer/three/\`
and \`src/mobject/text/\`, new deps, and a one-line migration summary.

Read CHANGES.md first to preserve existing content.

## Rules
- Preserve all existing CHANGES.md content.
- No emojis.`,
  },
];

// ─── Renderer-Mode Refactor Tasks ───────────────────────────
//
// Adds a `renderer: "cairo" | "opengl"` option mirroring ManimCE. Default
// "cairo" routes through Canvas2D (browser-safe); opt-in "opengl" uses the
// existing three.js backend. 3D mobjects in cairo mode get flattened via
// ThreeDCamera projection (exactly like ManimCE).

const RENDERER_MODE_TASKS: GapTask[] = [
  {
    id: "rendererMode.config",
    description: "Add `renderer` field to ManimConfig + SceneOptions",
    targetFile: "src/core/types.ts",
    dependsOn: [],
    estimatedLines: 40,
    prompt: `# Renderer Mode Task: Config field

Add a \`renderer: "cairo" | "opengl"\` option to:
1. \`src/core/types.ts\` \`ManimConfig\` (optional, default "cairo")
2. \`src/scene/scene/scene.ts\` \`SceneOptions\` (optional, default "cairo")

This mirrors Python ManimCE's \`config.renderer\` which switches between
Cairo (default) and OpenGL. The default MUST be "cairo" to match ManimCE.

## Rules
- Do NOT wire it into any backend yet — just add the type + field + default.
- Add JSDoc citing ManimCE's config.renderer.
- No behavior change: existing code paths must still work.
- Run \`npm run typecheck\`.`,
  },

  {
    id: "rendererMode.backendInterface",
    description: "Define SceneBackend interface",
    targetFile: "src/renderer/scene_backend.ts",
    dependsOn: ["rendererMode.config"],
    estimatedLines: 120,
    prompt: `# Renderer Mode Task: SceneBackend interface

Create \`src/renderer/scene_backend.ts\` exporting:

\`\`\`ts
export interface SceneBackend {
  /** Attach a mobject to the backend (adds geometry adapter / canvas layer). */
  addMobject(m: IMobject): void;
  /** Detach a mobject (dispose adapter / clear layer). */
  removeMobject(m: IMobject): void;
  /** Sync all tracked mobjects (style + geometry) for the current frame. */
  sync(): void;
  /** Draw one frame to the output surface. */
  render(): void;
  /** Resize the output surface to (width, height) in CSS pixels. */
  resize(width: number, height: number): void;
  /** Release GPU / canvas resources. */
  dispose(): void;
}
\`\`\`

Export from \`src/renderer/index.ts\`.

## Rules
- Pure type module — no runtime code.
- Do NOT modify any backend yet.
- \`npm run typecheck\`.`,
  },

  {
    id: "rendererMode.threeBackend",
    description: "Extract three.js logic into ThreeBackend implementing SceneBackend",
    targetFile: "src/renderer/three/three_backend.ts",
    dependsOn: ["rendererMode.backendInterface"],
    estimatedLines: 250,
    prompt: `# Renderer Mode Task: ThreeBackend

Create \`src/renderer/three/three_backend.ts\` exporting a \`ThreeBackend\`
class that implements \`SceneBackend\`. Move the three.js-specific logic
currently inside \`src/scene/three_scene.ts\` (ThreeRenderer + FamilySyncer
ownership + render/resize/dispose) into this class.

Constructor:
\`\`\`ts
new ThreeBackend({ canvas, frameWidth, frameHeight, perspective, camera3, config })
\`\`\`

\`ThreeScene\` (existing) should continue to work — refactor it to delegate
to a \`ThreeBackend\` internally instead of owning ThreeRenderer directly.
All existing public ThreeScene methods must still work (readers: check
demo/real-demo.ts callers before removing anything).

## Rules
- No behavior change from user-facing perspective.
- \`npm run typecheck\`.`,
  },

  {
    id: "rendererMode.cairoBackend",
    description: "Build CairoBackend (browser Canvas2D) implementing SceneBackend",
    targetFile: "src/renderer/cairo/cairo_backend.ts",
    dependsOn: ["rendererMode.backendInterface"],
    estimatedLines: 400,
    prompt: `# Renderer Mode Task: CairoBackend (browser Canvas2D)

Create \`src/renderer/cairo/cairo_backend.ts\` exporting a \`CairoBackend\`
class that implements \`SceneBackend\` for browser Canvas2D.

Notes:
- The existing \`src/renderer/cairo_renderer/cairo_renderer.ts\` uses
  \`canvas\` (node-canvas, libcairo) server-side. This new backend is for
  the BROWSER and must use the W3C CanvasRenderingContext2D API directly
  (which the W3C API and node-canvas both implement compatibly). You may
  share drawing helpers, but DO NOT import \`canvas\` here.
- Render each VMobject's stroke/fill by iterating its cubic bezier tuples
  (\`getCubicBezierTuples\`) and calling \`ctx.bezierCurveTo\`, then
  \`ctx.fill\` / \`ctx.stroke\` with the VMobject's fill/stroke style.
- For 3D mobjects: project points through \`ThreeDCamera\` (from
  \`src/camera/three_d_camera/\`) to 2D before drawing. ManimCE does
  exactly this — 3D under Cairo becomes flattened polygons.
- Respect \`zIndex\`, \`submobjects\`, fill before stroke ordering.
- Use devicePixelRatio scaling for crisp rendering.

Constructor:
\`\`\`ts
new CairoBackend({ canvas, frameWidth, frameHeight, config })
\`\`\`

## Rules
- Browser-only. No Node-only imports.
- \`npm run typecheck\`.
- Keep it under 500 lines.`,
  },

  {
    id: "rendererMode.sceneSwitch",
    description: "Scene constructor branches on renderer option",
    targetFile: "src/scene/scene/scene.ts",
    dependsOn: [
      "rendererMode.threeBackend",
      "rendererMode.cairoBackend",
    ],
    estimatedLines: 120,
    prompt: `# Renderer Mode Task: Scene switch

Update \`src/scene/scene/scene.ts\` so that when \`SceneOptions.canvas\` is
provided, the Scene constructor instantiates the correct \`SceneBackend\`
based on \`options.renderer\`:
- "cairo" (default) → \`CairoBackend\`
- "opengl" → \`ThreeBackend\`

Store the backend on the Scene and route \`render()\` through it.
Headless (no canvas) mode should continue to work exactly as before — do
not break the video-export pathway.

\`ThreeScene\` must continue to work as a shortcut that forces
\`renderer: "opengl"\` with perspective/3D defaults. Don't break it.

## Rules
- Default \`renderer\` MUST be "cairo", matching ManimCE.
- All existing demos in demo/ must keep working.
- \`npm run typecheck\`.`,
  },

  {
    id: "rendererMode.exports",
    description: "Wire public exports for new backend modules",
    targetFile: "src/renderer/index.ts",
    dependsOn: ["rendererMode.sceneSwitch"],
    estimatedLines: 30,
    prompt: `# Renderer Mode Task: Public exports

Ensure the following are exported from their package barrels:
- \`SceneBackend\` from \`src/renderer/index.ts\`
- \`ThreeBackend\` from \`src/renderer/three/index.ts\`
- \`CairoBackend\` from \`src/renderer/cairo/index.ts\` (create this barrel)

Do NOT remove existing exports. Run \`npm run typecheck\`.`,
  },

  {
    id: "rendererMode.smokeTests",
    description: "Smoke tests for both renderer modes",
    targetFile: "tests/renderer/renderer_mode.test.ts",
    dependsOn: ["rendererMode.exports"],
    estimatedLines: 150,
    prompt: `# Renderer Mode Task: Smoke tests

Create \`tests/renderer/renderer_mode.test.ts\` with vitest cases:
1. Default Scene with a canvas uses CairoBackend.
2. Scene with \`renderer: "opengl"\` uses ThreeBackend.
3. Adding a VMobject results in at least one path/mesh being drawn (assert
   via canvas pixel sampling for cairo, scene-graph child count for three).
4. Resize propagates to the backend.
5. Dispose releases resources (no throws).

Use \`happy-dom\` or \`jsdom\` for the canvas stub if not already configured.
If canvas pixel inspection is too fragile, fall back to asserting the
backend instance type + that \`render()\` doesn't throw.

## Rules
- Tests must pass: \`npm run test\`.
- Don't flake on CI — prefer type/structure assertions over pixel diffs.`,
  },

  {
    id: "rendererMode.docs",
    description: "Document renderer modes in CLAUDE.md + CHANGES.md",
    targetFile: "CLAUDE.md",
    dependsOn: ["rendererMode.smokeTests"],
    estimatedLines: 80,
    prompt: `# Renderer Mode Task: Docs

1. Append a "Renderer Modes" section to \`CLAUDE.md\` explaining:
   - Default is "cairo" (Canvas2D), mirroring ManimCE.
   - Opt in via \`new Scene({ canvas, renderer: "opengl" })\` for three.js.
   - 3D mobjects under cairo get flattened via ThreeDCamera projection.
   - Cite ManimCE \`config.renderer\` as the reference.
2. Append a dated entry to \`CHANGES.md\` (today's date: 2026-04-14)
   summarizing: new SceneBackend interface, ThreeBackend, CairoBackend,
   and the default-cairo switch.

## Rules
- Preserve all existing content in both files.
- No emojis.`,
  },
];

/** Run the renderer-mode refactor tasks. */
async function runRendererModeTasks(allResults: AgentResult[]): Promise<void> {
  let tasks = RENDERER_MODE_TASKS;
  if (ONLY_MODULE) {
    tasks = tasks.filter((g) => g.id === ONLY_MODULE);
  }

  const completedModules = loadCompletedModules();
  const pending = tasks.filter((g) => !completedModules.has(g.id));

  if (pending.length === 0) {
    log("info", "All renderer-mode tasks already completed");
    return;
  }

  log("info", `Running ${pending.length} renderer-mode tasks`);

  const done = new Set<string>(completedModules);
  const active = new Map<string, Promise<AgentResult>>();
  const inProgress = new Set<string>();

  function getReady(): GapTask[] {
    const ready: GapTask[] = [];
    for (const g of pending) {
      if (done.has(g.id) || inProgress.has(g.id)) continue;
      const depsReady = g.dependsOn.every((d) => done.has(d));
      if (depsReady) ready.push(g);
    }
    return ready;
  }

  let remaining = pending.length;
  while (remaining > 0 || active.size > 0) {
    const ready = getReady();
    while (active.size < MAX_PARALLEL && ready.length > 0) {
      const gap = ready.shift()!;
      const taskNode = gapToTaskNode(gap);
      inProgress.add(gap.id);

      const prompt = buildGapPrompt(gap);
      const p = runAgentWithPrompt(taskNode, prompt).then((result) => {
        active.delete(gap.id);
        inProgress.delete(gap.id);
        allResults.push(result);

        if (result.success) {
          done.add(gap.id);
          remaining--;
          log("success", `renderer-mode task ${gap.id}: ${gap.description}`);
        } else {
          done.add(gap.id);
          remaining--;
          log("warn", `renderer-mode task ${gap.id} failed — dependents will still attempt`);
        }
        return result;
      });
      active.set(gap.id, p);
    }

    if (active.size > 0) {
      await Promise.race(active.values());
    } else if (remaining > 0) {
      const stuck = pending.filter((g) => !done.has(g.id)).map((g) => g.id);
      log("error", `Deadlock in renderer-mode tasks: ${stuck.join(", ")}`);
      break;
    }
  }
}

/** Run the three.js migration tasks through the same agent infrastructure. */
async function runThreeJsTasks(allResults: AgentResult[]): Promise<void> {
  let tasks = THREE_JS_TASKS;
  if (ONLY_MODULE) {
    tasks = tasks.filter((g) => g.id === ONLY_MODULE);
  }

  const completedModules = loadCompletedModules();
  const pending = tasks.filter((g) => !completedModules.has(g.id));

  if (pending.length === 0) {
    log("info", "All three.js migration tasks already completed");
    return;
  }

  log("info", `Running ${pending.length} three.js migration tasks`);

  const done = new Set<string>(completedModules);
  const active = new Map<string, Promise<AgentResult>>();
  const inProgress = new Set<string>();

  function getReady(): GapTask[] {
    const ready: GapTask[] = [];
    for (const g of pending) {
      if (done.has(g.id) || inProgress.has(g.id)) continue;
      const depsReady = g.dependsOn.every((d) => done.has(d));
      if (depsReady) ready.push(g);
    }
    return ready;
  }

  let remaining = pending.length;
  while (remaining > 0 || active.size > 0) {
    const ready = getReady();
    while (active.size < MAX_PARALLEL && ready.length > 0) {
      const gap = ready.shift()!;
      const taskNode = gapToTaskNode(gap);
      inProgress.add(gap.id);

      const prompt = buildGapPrompt(gap);
      const p = runAgentWithPrompt(taskNode, prompt).then((result) => {
        active.delete(gap.id);
        inProgress.delete(gap.id);
        allResults.push(result);

        if (result.success) {
          done.add(gap.id);
          remaining--;
          log("success", `three.js task ${gap.id}: ${gap.description}`);
        } else {
          done.add(gap.id); // don't block dependents
          remaining--;
          log("warn", `three.js task ${gap.id} failed — dependents will still attempt`);
        }
        return result;
      });
      active.set(gap.id, p);
    }

    if (active.size > 0) {
      await Promise.race(active.values());
    } else if (remaining > 0) {
      const stuck = pending.filter((g) => !done.has(g.id)).map((g) => g.id);
      log("error", `Deadlock in three.js tasks: ${stuck.join(", ")}`);
      break;
    }
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log(`
${COLORS.bold}╔══════════════════════════════════════════════════╗
║          Manim-TS Conversion Orchestrator         ║
╚══════════════════════════════════════════════════╝${COLORS.reset}
`);

  // Load task graph
  if (!existsSync(TASK_GRAPH_PATH)) {
    log("error", "task-graph.json not found. Run: npm run analyze");
    process.exit(1);
  }

  const taskGraph: TaskGraph = JSON.parse(
    readFileSync(TASK_GRAPH_PATH, "utf-8")
  );

  // Load previously completed modules for resume
  const completedModules = loadCompletedModules();
  if (completedModules.size > 0) {
    log("info", `Resuming: ${completedModules.size} modules already completed`);
  }

  log(
    "info",
    `Loaded ${taskGraph.totalModules} modules across ${taskGraph.totalLayers} layers`
  );
  log("info", `Max parallel agents: ${MAX_PARALLEL}`);
  log("info", `Starting from layer: ${START_LAYER}`);
  log("info", `Agent timeout: ${TIMEOUT_SEC}s (≥${LONG_TIMEOUT_THRESHOLD} lines → ${LONG_TIMEOUT_SEC}s)`);
  log("info", `Model: ${MODEL} (≥${OPUS_LINE_THRESHOLD} lines → opus)`);
  if (DRY_RUN) log("warn", "DRY RUN mode — no agents will be spawned");

  // Ensure directories exist
  mkdirSync(BRIEFS_DIR, { recursive: true });
  mkdirSync(join(ROOT, ".tmp"), { recursive: true });
  mkdirSync(STAGING_DIR, { recursive: true });

  const allResults: AgentResult[] = [];

  // Restore previous results if resuming
  if (existsSync(RESULTS_FILE)) {
    try {
      const prev: AgentResult[] = JSON.parse(
        readFileSync(RESULTS_FILE, "utf-8")
      );
      allResults.push(...prev);
    } catch {
      // Start fresh
    }
  }

  // ─── Renderer-mode refactor ───────────────────────────────
  if (RUN_RENDERER_MODE) {
    console.log(
      `\n${COLORS.bold}═══ Renderer Mode Refactor: ${RENDERER_MODE_TASKS.length} tasks ═══${COLORS.reset}\n`
    );
    for (const g of RENDERER_MODE_TASKS) {
      const status = completedModules.has(g.id) ? `${COLORS.success}done${COLORS.reset}` : "pending";
      log("info", `  ${g.id} — ${g.description} [${status}]`);
    }
    console.log();

    await runRendererModeTasks(allResults);

    if (!DRY_RUN) {
      writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
    }

    if (!SKIP_TYPECHECK && !DRY_RUN) {
      log("info", "Running type check after renderer-mode tasks...");
      const { pass, errors } = await runTypeCheck();
      if (pass) {
        log("success", "Type check passed");
      } else {
        log("error", "Type check failed. Errors saved to typecheck-errors.log");
        writeFileSync(join(ROOT, "typecheck-errors.log"), errors);
      }
    }
    return;
  }

  // ─── three.js migration mode ──────────────────────────────
  if (RUN_THREE_JS) {
    console.log(
      `\n${COLORS.bold}═══ three.js Migration Mode: ${THREE_JS_TASKS.length} tasks ═══${COLORS.reset}\n`
    );
    for (const g of THREE_JS_TASKS) {
      const status = completedModules.has(g.id) ? `${COLORS.success}done${COLORS.reset}` : "pending";
      log("info", `  ${g.id} — ${g.description} [${status}]`);
    }
    console.log();

    await runThreeJsTasks(allResults);

    if (!DRY_RUN) {
      writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
    }

    if (!SKIP_TYPECHECK && !DRY_RUN) {
      log("info", "Running type check after three.js migration tasks...");
      const { pass, errors } = await runTypeCheck();
      if (pass) {
        log("success", "Type check passed");
      } else {
        log("error", "Type check failed. Errors saved to typecheck-errors.log");
        writeFileSync(join(ROOT, "typecheck-errors.log"), errors);
      }
    }

  } else if (RUN_GAPS) {
    console.log(
      `\n${COLORS.bold}═══ Gap-Filling Mode: ${GAP_TASKS.length} tasks ═══${COLORS.reset}\n`
    );
    for (const g of GAP_TASKS) {
      const status = completedModules.has(g.id) ? `${COLORS.success}done${COLORS.reset}` : "pending";
      log("info", `  ${g.id} — ${g.description} [${status}]`);
    }
    console.log();

    await runGapTasks(allResults);

    if (!DRY_RUN) {
      writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
    }

    // Type check after gap tasks
    if (!SKIP_TYPECHECK && !DRY_RUN) {
      log("info", "Running type check after gap tasks...");
      const { pass, errors } = await runTypeCheck();
      if (pass) {
        log("success", "Type check passed");
      } else {
        log("error", "Type check failed. Errors saved to typecheck-errors.log");
        writeFileSync(join(ROOT, "typecheck-errors.log"), errors);
      }
    }

  } else {

  // ─── Normal conversion mode ──────────────────────────────────
  // Gather all tasks, filtered by --start-layer and --only
  let allTasks = taskGraph.tasks.filter((t) => t.layer >= START_LAYER);
  if (ONLY_MODULE) {
    allTasks = allTasks.filter((t) => t.module === ONLY_MODULE);
  }

  const pendingCount = allTasks.filter((t) => !completedModules.has(t.module)).length;
  const totalLines = allTasks
    .filter((t) => !completedModules.has(t.module))
    .reduce((s, t) => s + t.estimatedLines, 0);

  console.log(
    `\n${COLORS.bold}═══ ${pendingCount} modules to convert (~${totalLines} lines) ═══${COLORS.reset}\n`
  );

  if (pendingCount === 0) {
    log("info", "All modules already completed — nothing to do");
  } else {
    // Run the dependency-aware scheduler (fills all agent slots across layers)
    await runAllTasks(allTasks, completedModules, taskGraph, allResults);

    // Save after main run
    if (!DRY_RUN) {
      writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
    }

    // Type check + fix-up pass
    if (!SKIP_TYPECHECK && !DRY_RUN) {
      log("info", "Running type check gate...");
      const { pass, errors } = await runTypeCheck();

      if (pass) {
        log("success", "Type check passed");
      } else {
        log("warn", "Type check failed — spawning fix-up agents");

        const failedTasks = allTasks.filter(
          (t) => !allResults.find((r: AgentResult) => r.module === t.module && r.success)
        );
        const fixTargets = failedTasks.length > 0 ? failedTasks : allTasks;

        const fixResults = await runFixUps(fixTargets, errors, taskGraph);
        allResults.push(
          ...fixResults.filter((r: AgentResult) => !r.success || r.stdout !== "(no errors for this module)")
        );

        const { pass: pass2, errors: errors2 } = await runTypeCheck();
        if (pass2) {
          log("success", "Type check passed after fix-ups");
        } else {
          log("error", "Type check still failing. Errors saved to typecheck-errors.log");
          writeFileSync(join(ROOT, "typecheck-errors.log"), errors2);
        }
      }

      if (!DRY_RUN) {
        writeFileSync(RESULTS_FILE, JSON.stringify(allResults, null, 2));
      }
    }

    // Clean up staging snapshots
    const layerSnapshotDir = join(STAGING_DIR, "snapshots");
    if (existsSync(layerSnapshotDir)) {
      rmSync(layerSnapshotDir, { recursive: true, force: true });
    }
  }

  } // end normal conversion mode

  // ─── Final Summary ──────────────────────────────────────────
  console.log(`\n${COLORS.bold}═══ Final Summary ═══${COLORS.reset}\n`);

  const totalSucceeded = allResults.filter((r) => r.success).length;
  const totalFailed = allResults.filter((r) => !r.success).length;
  const totalDuration = allResults.reduce((s, r) => s + r.duration, 0);

  log("info", `Total modules: ${allResults.length}`);
  log("success", `Succeeded: ${totalSucceeded}`);
  if (totalFailed > 0) log("error", `Failed: ${totalFailed}`);
  log("info", `Total agent time: ${(totalDuration / 60).toFixed(1)} minutes`);
  log("info", `Results saved to: ${RESULTS_FILE}`);

  if (totalFailed > 0) {
    console.log(`\n${COLORS.warn}Failed modules:${COLORS.reset}`);
    for (const r of allResults.filter((r) => !r.success)) {
      console.log(`  - ${r.module}`);
    }
  }

  // Clean up temp directories
  const tmpDir = join(ROOT, ".tmp");
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  if (existsSync(STAGING_DIR)) {
    rmSync(STAGING_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  log("error", `Fatal: ${err.message}`);
  process.exit(1);
});
