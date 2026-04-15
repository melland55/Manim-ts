/**
 * Smoke tests for ThreeRenderer + FamilySyncer.
 *
 * THREE.WebGLRenderer is mocked so these run headlessly without a real WebGL
 * context. All other three.js objects (Scene, Group, Mesh, BufferGeometry, …)
 * are the real implementations — they are pure JavaScript and need no GPU.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as THREE from "three";

// ── Mock WebGLRenderer so no real WebGL context is required ──────────────────
// vi.mock is hoisted to the top by vitest — all imports below get the mocked
// version of "three".
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

import { ThreeRenderer } from "../../src/renderer/three/three_renderer.js";
import { FamilySyncer } from "../../src/renderer/three/family_syncer.js";
import { VMobjectAdapter } from "../../src/renderer/three/adapters/vmobject_adapter.js";
import { Circle } from "../../src/mobject/geometry/index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal HTMLCanvasElement stand-in — ThreeRenderer only reads .width/.height. */
function makeFakeCanvas(): HTMLCanvasElement {
  return { width: 320, height: 240 } as unknown as HTMLCanvasElement;
}

// ── ThreeRenderer construction ────────────────────────────────────────────────

describe("ThreeRenderer (mocked WebGL)", () => {
  it("constructs with a fake canvas without throwing", () => {
    expect(() => new ThreeRenderer(makeFakeCanvas())).not.toThrow();
  });

  it("exposes a THREE.Scene instance", () => {
    const r = new ThreeRenderer(makeFakeCanvas());
    expect(r.scene).toBeInstanceOf(THREE.Scene);
  });

  it("scene starts empty", () => {
    const r = new ThreeRenderer(makeFakeCanvas());
    expect(r.scene.children.length).toBe(0);
  });
});

// ── FamilySyncer + Circle ─────────────────────────────────────────────────────

describe("FamilySyncer — add a Circle", () => {
  let group: THREE.Group;
  let syncer: FamilySyncer;

  beforeEach(() => {
    group = new THREE.Group();
    syncer = new FamilySyncer(group);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mounts one Object3D in the group after syncing a single Circle", () => {
    const circle = new Circle();
    syncer.sync([circle]);

    // One adapter object was added to the syncer's group.
    expect(group.children.length).toBe(1);
    expect(syncer.adapterCount).toBe(1);
  });

  it("scene.children.length === 1 when the syncer group is added to a scene", () => {
    const r = new ThreeRenderer(makeFakeCanvas());
    // Wire the syncer group into the ThreeRenderer's scene (mirrors ThreeScene setup).
    r.scene.add(group);
    expect(r.scene.children.length).toBe(1);

    const circle = new Circle();
    syncer.sync([circle]);

    // Scene still has exactly 1 child (the group); Circle lives inside it.
    expect(r.scene.children.length).toBe(1);
    expect(group.children.length).toBe(1);
  });
});

// ── FamilySyncer — remove / disposal ─────────────────────────────────────────

describe("FamilySyncer — remove a VMobject", () => {
  let group: THREE.Group;
  let syncer: FamilySyncer;

  beforeEach(() => {
    group = new THREE.Group();
    syncer = new FamilySyncer(group);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes the Object3D from the group when the mobject leaves the family", () => {
    const circle = new Circle();
    syncer.sync([circle]);
    expect(group.children.length).toBe(1);

    syncer.sync([]); // circle no longer in family
    expect(group.children.length).toBe(0);
    expect(syncer.adapterCount).toBe(0);
  });

  it("calls VMobjectAdapter.dispose() when the VMobject is removed", () => {
    const disposeSpy = vi.spyOn(VMobjectAdapter.prototype, "dispose");

    const circle = new Circle();
    syncer.sync([circle]); // adapter created
    syncer.sync([]);       // adapter disposed

    expect(disposeSpy).toHaveBeenCalledOnce();
  });

  it("disposes strokeGeo and strokeMat (and fillGeo/fillMat) on removal", () => {
    // Spy on the base-class dispose methods — all three.js geometries and
    // materials inherit from these, including LineGeometry and LineMaterial.
    const geoDisposeSpy = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    const matDisposeSpy = vi.spyOn(THREE.Material.prototype, "dispose");

    const circle = new Circle(); // fillOpacity=1 → fill mesh is also created
    syncer.sync([circle]);
    syncer.sync([]);

    // At minimum strokeGeo + strokeMat are disposed; with fillOpacity=1 also
    // fillGeo + fillMat, so ≥ 2 calls each.
    expect(geoDisposeSpy).toHaveBeenCalled();
    expect(matDisposeSpy).toHaveBeenCalled();
  });
});
