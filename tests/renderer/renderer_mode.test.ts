/**
 * Smoke tests for renderer mode selection.
 *
 * Verifies that Scene selects CairoBackend vs ThreeBackend based on the
 * `renderer` option, that adding a VMobject produces renderable output,
 * and that resize/dispose work without errors.
 *
 * THREE.WebGLRenderer is mocked so tests run headlessly without a GPU.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as THREE from "three";

// ── Mock WebGLRenderer ────────────────────────────────────────────────────────
vi.mock("three", async (importOriginal) => {
  const three = await importOriginal<typeof THREE>();

  class MockWebGLRenderer {
    outputColorSpace = "";
    toneMapping = 0;
    setClearColor() {}
    setSize() {}
    render() {}
    dispose() {}
  }

  return {
    ...three,
    WebGLRenderer: MockWebGLRenderer as unknown as typeof THREE.WebGLRenderer,
  };
});

import { Scene } from "../../src/scene/scene/scene.js";
import { CairoBackend } from "../../src/renderer/cairo/cairo_backend.js";
import { ThreeBackend } from "../../src/renderer/three/three_backend.js";
import { Circle } from "../../src/mobject/geometry/index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeCanvas(): HTMLCanvasElement {
  const canvas = {
    width: 320,
    height: 240,
    style: { width: "", height: "" },
    getContext(type: string) {
      if (type === "2d") {
        return {
          setTransform() {},
          clearRect() {},
          fillRect() {},
          save() {},
          restore() {},
          beginPath() {},
          moveTo() {},
          bezierCurveTo() {},
          fill() {},
          stroke() {},
          set fillStyle(_v: string) {},
          set strokeStyle(_v: string) {},
          set lineWidth(_v: number) {},
          set lineJoin(_v: string) {},
          set lineCap(_v: string) {},
        };
      }
      return null;
    },
  } as unknown as HTMLCanvasElement;
  return canvas;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 1. Default Scene uses CairoBackend ────────────────────────────────────────

describe("Renderer mode selection", () => {
  it("default Scene with a canvas uses CairoBackend", () => {
    const scene = new Scene({ canvas: makeFakeCanvas() });
    expect(scene.backend).toBeInstanceOf(CairoBackend);
    expect(scene.rendererType).toBe("cairo");
  });

  it('Scene with renderer: "opengl" uses ThreeBackend', () => {
    const scene = new Scene({
      canvas: makeFakeCanvas(),
      renderer: "opengl",
    });
    expect(scene.backend).toBeInstanceOf(ThreeBackend);
    expect(scene.rendererType).toBe("opengl");
  });
});

// ── 3. Adding a VMobject produces renderable content ──────────────────────────

describe("VMobject rendering smoke", () => {
  it("CairoBackend: render() does not throw after adding a Circle", () => {
    const scene = new Scene({ canvas: makeFakeCanvas() });
    const circle = new Circle();
    scene.add(circle);
    expect(() => scene.renderFrame()).not.toThrow();
  });

  it("ThreeBackend: syncing a Circle adds children to the scene graph", () => {
    const scene = new Scene({
      canvas: makeFakeCanvas(),
      renderer: "opengl",
    });
    const circle = new Circle();
    scene.add(circle);

    const backend = scene.backend as ThreeBackend;
    backend.sync();

    expect(backend.familySyncer.adapterCount).toBeGreaterThanOrEqual(1);
  });
});

// ── 4. Resize propagates to the backend ───────────────────────────────────────

describe("Resize propagation", () => {
  it("CairoBackend: resize updates canvas dimensions", () => {
    const canvas = makeFakeCanvas();
    const scene = new Scene({ canvas });
    const backend = scene.backend as CairoBackend;

    backend.resize(640, 480);
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(480);
  });

  it("ThreeBackend: resize does not throw", () => {
    const scene = new Scene({
      canvas: makeFakeCanvas(),
      renderer: "opengl",
    });
    const backend = scene.backend!;
    expect(() => backend.resize(640, 480)).not.toThrow();
  });
});

// ── 5. Dispose releases resources without errors ──────────────────────────────

describe("Dispose", () => {
  it("CairoBackend: dispose does not throw", () => {
    const scene = new Scene({ canvas: makeFakeCanvas() });
    const backend = scene.backend!;
    expect(() => backend.dispose()).not.toThrow();
  });

  it("ThreeBackend: dispose does not throw", () => {
    const scene = new Scene({
      canvas: makeFakeCanvas(),
      renderer: "opengl",
    });
    const backend = scene.backend!;
    expect(() => backend.dispose()).not.toThrow();
  });

  it("ThreeBackend: dispose after adding mobjects does not throw", () => {
    const scene = new Scene({
      canvas: makeFakeCanvas(),
      renderer: "opengl",
    });
    const circle = new Circle();
    scene.add(circle);
    const backend = scene.backend as ThreeBackend;
    backend.sync();

    expect(() => backend.dispose()).not.toThrow();
  });
});
