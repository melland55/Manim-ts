import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const nodeStub = path.join(repoRoot, "demo/node-stubs.js");

// GitHub Pages base; override with VITE_BASE at build time if needed.
const base = process.env.VITE_BASE ?? "/Manim-ts/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@manim": path.join(repoRoot, "src"),
      "numpy-ts": path.join(
        repoRoot,
        "node_modules/numpy-ts/dist/esm/index.js",
      ),
      // Stub out Node built-ins the engine imports but never calls in browser.
      fs: nodeStub,
      path: nodeStub,
      os: nodeStub,
      url: nodeStub,
      child_process: nodeStub,
      crypto: nodeStub,
      // Native-only packages — replaced by empty stubs; the browser uses
      // native <canvas> / MathJax / in-browser image decoding instead.
      "@napi-rs/canvas": nodeStub,
      sharp: nodeStub,
      "fluent-ffmpeg": nodeStub,
      chokidar: nodeStub,
    },
  },
  define: {
    "process.platform": '"browser"',
  },
  optimizeDeps: {
    exclude: [
      "numpy-ts",
      "@napi-rs/canvas",
      "sharp",
      "fluent-ffmpeg",
      "chokidar",
    ],
  },
  server: { port: 5173 },
});
