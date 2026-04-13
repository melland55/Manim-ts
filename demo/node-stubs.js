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

// url stubs
export function fileURLToPath(u) { return u; }
export function pathToFileURL(p) { return p; }

// default export (for `import * as mod`)
export default {
  readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync,
  statSync, unlinkSync,
  join, resolve, dirname, basename, extname, sep, posix,
  tmpdir, homedir, platform,
  fileURLToPath, pathToFileURL,
};
