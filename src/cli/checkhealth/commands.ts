/**
 * A CLI utility helping to diagnose problems with your Manim installation.
 */

import readline from "node:readline";
import { HEALTH_CHECKS, HealthCheckFunction } from "./checks.js";

// ─── Output helpers ──────────────────────────────────────────────────────────

type AnsiColor = "green" | "red" | "blue";

const ANSI: Record<AnsiColor, string> = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
};
const ANSI_RESET = "\x1b[0m";

function colored(text: string, color: AnsiColor): string {
  return `${ANSI[color]}${text}${ANSI_RESET}`;
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(
        answer.trim().toLowerCase() === "y" ||
          answer.trim().toLowerCase() === "yes"
      );
    });
  });
}

// ─── Command ─────────────────────────────────────────────────────────────────

/**
 * Run all registered health checks and report results.
 *
 * Checks whether Manim is installed correctly and has access to its required
 * (and optional) system dependencies.
 */
export async function checkhealth(): Promise<void> {
  process.stdout.write(`Node executable: ${process.execPath}\n\n`);
  process.stdout.write(
    "Checking whether your installation of Manim Community is healthy...\n"
  );

  const failedChecks: HealthCheckFunction[] = [];

  for (const check of HEALTH_CHECKS) {
    process.stdout.write(`- ${check.description} ... `);

    const shouldSkip = failedChecks.some((fc) =>
      check.skipOnFailed.includes(fc.name)
    );
    if (shouldSkip) {
      process.stdout.write(colored("SKIPPED", "blue") + "\n");
      continue;
    }

    const passed = check();
    if (passed) {
      process.stdout.write(colored("PASSED", "green") + "\n");
    } else {
      process.stdout.write(colored("FAILED", "red") + "\n");
      failedChecks.push(check);
    }
  }

  process.stdout.write("\n");

  if (failedChecks.length > 0) {
    process.stdout.write(
      "There are problems with your installation, " +
        "here are some recommendations to fix them:\n"
    );
    for (let i = 0; i < failedChecks.length; i++) {
      process.stdout.write(failedChecks[i].recommendation + "\n");
      if (i + 1 < failedChecks.length) {
        await confirm("Continue with next recommendation?");
      }
    }
  } else {
    process.stdout.write(
      "No problems detected, your installation seems healthy!\n"
    );
    // TODO: Port render test scene from Python — needs scene rendering implementation
  }
}
