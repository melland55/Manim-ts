/**
 * Empty stubs for Node.js built-in modules.
 * Used by Vite to satisfy imports from src/ modules that reference
 * Node APIs (fs, path, os, url) but never call them at render time.
 */

// fs stubs
export function readFileSync() { return ""; }
export function writeFileSync() {}
export function existsSync() { return false; }
export function mkdirSync() {}
export function readdirSync() { return []; }
export function statSync() { return { isDirectory: () => false, isFile: () => false }; }
export function unlinkSync() {}
export function accessSync() { throw new Error("fs.accessSync not available in browser"); }
export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };

// path stubs
export function join(...args) { return args.join("/"); }
export function resolve(...args) { return args.join("/"); }
export function dirname(p) { return p; }
export function basename(p) { return p; }
export function extname(p) { return ""; }
export const sep = "/";
export const posix = { join, resolve, dirname, basename, extname, sep };

// os stubs
export function tmpdir() { return "/tmp"; }
export function homedir() { return "/"; }
export function platform() { return "browser"; }

// child_process stubs
export function spawnSync() { return { status: 1, stdout: "", stderr: "not available in browser", error: null }; }
export function spawn() { return { on() {}, stdout: { on() {} }, stderr: { on() {} }, kill() {} }; }
export function exec() {}
export class ChildProcess {}

// crypto stubs
export function createHash() { return { update() { return this; }, digest() { return "stub-hash"; } }; }
export function randomBytes(n) { return new Uint8Array(n); }

// url stubs
export function fileURLToPath(u) { return u; }
export function pathToFileURL(p) { return p; }

// default export (for `import * as mod` and `import crypto from "crypto"`)
export default {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
  statSync, unlinkSync,
  join, resolve, dirname, basename, extname, sep, posix,
  tmpdir, homedir, platform,
  fileURLToPath, pathToFileURL,
  spawnSync, spawn, exec, ChildProcess,
  createHash, randomBytes,
};
