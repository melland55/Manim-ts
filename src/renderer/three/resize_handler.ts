import * as THREE from "three";
import { setLineMaterialResolution } from "./three_materials.js";

/** DPR cap. 3 gives noticeably crisper diagonal strokes than 2 on Retina / HiDPI
 *  displays without the cost of fully uncapped DPR (some 4K monitors report 4+). */
const MAX_DPR = 3;

/**
 * Observes `canvas` with a ResizeObserver and keeps `renderer` + `camera`
 * in sync with the canvas's CSS size.
 *
 * - devicePixelRatio is honoured but capped at MAX_DPR to avoid Retina thrash.
 * - PerspectiveCamera: aspect ratio is updated + updateProjectionMatrix() called.
 * - OrthographicCamera: frustum world-units are intentionally left unchanged;
 *   only the renderer pixel size is updated so the scene coords stay stable.
 *
 * @returns An unsubscribe function — call it to disconnect the observer.
 */
export function attachResize(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  canvas: HTMLCanvasElement
): () => void {
  function handleResize(width: number, height: number): void {
    const dpr = Math.min(window.devicePixelRatio ?? 1, MAX_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false); // false → don't override canvas CSS size
    setLineMaterialResolution(width, height);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    // OrthographicCamera: world-unit frustum is unchanged on resize so that
    // the Manim scene coordinate system remains valid regardless of viewport.
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // Prefer devicePixelContent box (actual pixel size); fall back to CSS size.
      let width: number;
      let height: number;
      if (entry.devicePixelContentBoxSize?.length) {
        const dpr = Math.min(window.devicePixelRatio ?? 1, MAX_DPR);
        width = Math.round(entry.devicePixelContentBoxSize[0].inlineSize / dpr);
        height = Math.round(entry.devicePixelContentBoxSize[0].blockSize / dpr);
      } else if (entry.contentBoxSize?.length) {
        width = entry.contentBoxSize[0].inlineSize;
        height = entry.contentBoxSize[0].blockSize;
      } else {
        width = entry.contentRect.width;
        height = entry.contentRect.height;
      }
      if (width > 0 && height > 0) {
        handleResize(width, height);
      }
    }
  });

  observer.observe(canvas, { box: "device-pixel-content-box" });

  // Apply immediately so the renderer matches the canvas on first call.
  handleResize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);

  return () => observer.disconnect();
}
