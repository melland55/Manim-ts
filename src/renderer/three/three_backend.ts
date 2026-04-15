import * as THREE from "three";
import type { IMobject, ManimConfig } from "../../core/types.js";
import type { SceneBackend } from "../scene_backend.js";
import { ThreeRenderer } from "./three_renderer.js";
import { FamilySyncer } from "./family_syncer.js";
import { makeOrthoCamera } from "./three_camera.js";
import { defaultLightingRig } from "./lighting.js";

export interface ThreeBackendOptions {
  canvas: HTMLCanvasElement;
  frameWidth?: number;
  frameHeight?: number;
  perspective?: boolean;
  camera3?: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  config?: Partial<ManimConfig>;
}

export class ThreeBackend implements SceneBackend {
  readonly threeRenderer: ThreeRenderer;
  readonly familySyncer: FamilySyncer;
  readonly threeScene: THREE.Scene;

  private readonly _mobjects: Set<IMobject> = new Set();

  constructor(options: ThreeBackendOptions) {
    const frameWidth = options.frameWidth ?? 14.222;
    const frameHeight = options.frameHeight ?? 8.0;

    this.threeRenderer = new ThreeRenderer(options.canvas, options.config);
    this.threeScene = this.threeRenderer.scene;

    defaultLightingRig(this.threeScene);

    const cam =
      options.camera3 ?? makeOrthoCamera(frameWidth, frameHeight);
    this.threeRenderer.setCamera(cam);

    const group = new THREE.Group();
    this.threeScene.add(group);
    this.familySyncer = new FamilySyncer(group);
  }

  addMobject(m: IMobject): void {
    this._mobjects.add(m);
  }

  removeMobject(m: IMobject): void {
    this._mobjects.delete(m);
  }

  sync(): void {
    // Render exactly the mobjects the caller added — do NOT walk getFamily.
    // Callers that want hierarchy should flatten the family themselves and
    // add each leaf via addMobject (matching FamilySyncer's contract).
    this.familySyncer.sync([...this._mobjects]);
  }

  render(): void {
    this.threeRenderer.render();
  }

  resize(width: number, height: number): void {
    this.threeRenderer.resize(width, height);
  }

  dispose(): void {
    this.familySyncer.disposeAll();
    this.threeRenderer.dispose();
  }
}
