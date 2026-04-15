import type { IMobject } from "../core/types.js";

export interface SceneBackend {
  addMobject(m: IMobject): void;
  removeMobject(m: IMobject): void;
  sync(): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
