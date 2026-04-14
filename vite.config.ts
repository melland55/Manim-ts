import { defineConfig } from "vite";
import path from "path";

const nodeStub = path.resolve(__dirname, "demo/node-stubs.js");

export default defineConfig({
  root: "demo",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      // Map @manim imports to the src directory
      "@manim": path.resolve(__dirname, "src"),
      // Force numpy-ts to use its ESM entry (not the UMD browser bundle,
      // which lacks named exports and breaks Vite's ESM import handling).
      "numpy-ts": path.resolve(__dirname, "node_modules/numpy-ts/dist/esm/index.js"),
      // Stub out Node.js built-in modules imported by src/ code
      // (e.g. _config, scene_file_writer, shader). These are never called at render time.
      // NOTE: Only alias bare specifiers — NOT "node:" prefixed ones, because
      // numpy-ts uses guarded dynamic imports for "node:fs" etc. that should be left alone.
      "fs": nodeStub,
      "path": nodeStub,
      "os": nodeStub,
      "url": nodeStub,
      "child_process": nodeStub,
      "crypto": nodeStub,
      // Stub out Node-only native packages
      "@napi-rs/canvas": nodeStub,
      "sharp": nodeStub,
      "fluent-ffmpeg": nodeStub,
      "chokidar": nodeStub,
    },
  },
  // Stub out Node-only globals for browser builds.
  define: {
    "process.env": "{}",
    "process.platform": '"browser"',
    "process.cwd": "(() => '/')",
    "process.stdout": "{ isTTY: false }",
    "process.stderr": "{ isTTY: false }",
  },
  optimizeDeps: {
    // Don't pre-bundle numpy-ts — it's already ESM with proper named exports.
    // Pre-bundling breaks it because esbuild tries to resolve guarded dynamic
    // imports to node:fs/promises which don't exist in the browser.
    exclude: ["numpy-ts", "@napi-rs/canvas", "sharp", "fluent-ffmpeg", "chokidar"],
  },
});
