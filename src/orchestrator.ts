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
