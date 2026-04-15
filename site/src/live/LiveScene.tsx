import { useEffect, useRef, useState } from "react";
import { Scene } from "../../../src/scene/scene/scene.js";
import { CairoBackend } from "../../../src/renderer/cairo/cairo_backend.js";
import { ManimColor } from "../../../src/utils/color/core.js";
import { preloadFontFromUrl } from "../../../src/mobject/text/glyph_vmobject.js";
import type { IMobject } from "../../../src/core/types.js";

/**
 * Load the default UI font once so browser Text/GlyphText calls can run
 * synchronously after this resolves. Cached at module scope — subsequent
 * LiveScene mounts reuse the same Promise.
 */
let fontReady: Promise<void> | null = null;
function ensureFontLoaded(): Promise<void> {
  if (fontReady) return fontReady;
  // Computer Modern Serif. Although ManimCE's Text() nominally resolves to
  // Pango "Sans" (DejaVu on typical Linux), the reference PNGs on
  // docs.manim.community are unambiguously rendered with a Computer Modern
  // serif face — parenthesis taper and vertical-axis-stress zeros confirm.
  // Matching the reference visually takes priority over matching the
  // theoretical font lookup.
  const url = `${import.meta.env.BASE_URL}fonts/text.ttf`;
  fontReady = preloadFontFromUrl(url).then(() => undefined);
  return fontReady;
}

type Build = (scene: Scene) => void | Promise<void>;

interface Props {
  /**
   * Synchronous or async function that constructs the scene. Receives the
   * `Scene` instance (canvas already attached, Cairo backend active) and
   * should call `scene.add(...)`. Mirrors `construct()` from Python Manim.
   */
  build: Build;
  /** Optional scene background (CSS color). Default: black. */
  background?: string;
}

/**
 * Hosts a canvas and drives the manim-ts `Scene` lifecycle (Cairo/Canvas2D
 * backend) for a single example. Constructs the scene on mount, renders one
 * static frame, and disposes on unmount.
 */
export function LiveScene({ build, background }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: Scene | null = null;
    let disposed = false;

    (async () => {
      try {
        await ensureFontLoaded();
        if (disposed) return;
        scene = new Scene({ canvas });
        const backend = scene.backend as CairoBackend | null;
        if (backend && background) {
          backend.setBackgroundColor(ManimColor.parse(background));
        }
        await build(scene);
        if (disposed) return;

        // CairoBackend renders mobjects in insertion order. `scene.add()` has
        // already registered the top-level mobjects; if we simply appended
        // descendants afterwards, a VGroup's children (e.g. NumberPlane grid
        // lines) would paint ON TOP of later-added mobjects (dot, arrow).
        // Rebuild the backend's list from scratch, walking each top-level's
        // family in order so grid lines → dot → arrow → text is preserved.
        if (backend) {
          for (const top of scene.mobjects) {
            backend.removeMobject(top);
          }
          for (const top of scene.mobjects) {
            for (const mob of top.getFamily() as IMobject[]) {
              backend.addMobject(mob);
            }
          }
        }
        scene.renderFrame();
      } catch (err) {
        console.error("[LiveScene] build failed:", err);
        if (!disposed) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      disposed = true;
      try {
        scene?.backend?.dispose?.();
      } catch {
        // ignore
      }
    };
  }, [build, background]);

  return (
    <>
      <canvas ref={canvasRef} width={1920} height={1080} />
      {error && (
        <div className="live-error">
          Live render failed: <code>{error}</code>
          <br />
          Falling back to reference asset was not possible — check the console.
        </div>
      )}
    </>
  );
}
