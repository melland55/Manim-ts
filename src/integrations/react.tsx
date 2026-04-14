/**
 * React wrapper — drop-in `<ManimScene>` component.
 * Not part of Python Manim.
 *
 * Peer-dep: react >= 17. Does not bundle React.
 *
 * Usage:
 *   import { ManimScene } from "manim-ts/react";
 *   import { MyScene } from "./my-scene";
 *
 *   <ManimScene sceneClass={MyScene} controls playback width={800} height={450} />
 */

// @ts-expect-error — peer dep, not declared in our package.json.
// Users install react themselves.
import * as React from "react";
import type { Scene, SceneOptions } from "../scene/scene/index.js";
import { TimelineControls } from "../scene/timeline/controls.js";

export interface ManimSceneProps extends Omit<SceneOptions, "canvas"> {
  /** A Scene subclass constructor. */
  sceneClass: new (options?: SceneOptions) => Scene;
  /** Show the play/pause/scrubber UI. Implies `playback: true`. */
  controls?: boolean;
  /** Canvas width in pixels. */
  width?: number;
  /** Canvas height in pixels. */
  height?: number;
  /** Start playback automatically once construct() completes. */
  autoPlay?: boolean;
  /** Additional CSS class on the wrapping div. */
  className?: string;
  /** Additional inline styles on the wrapping div. */
  style?: unknown;
  /** Called once the scene is fully constructed (after await render). */
  onReady?: (scene: Scene) => void;
}

export function ManimScene(props: ManimSceneProps): unknown {
  const {
    sceneClass,
    controls = false,
    width = 800,
    height = 450,
    autoPlay = false,
    className,
    style,
    onReady,
    ...sceneOptions
  } = props;

  const canvasRef = (React as { useRef: <T>(v: T | null) => { current: T | null } }).useRef<HTMLCanvasElement>(null);
  const controlsRef = (React as { useRef: <T>(v: T | null) => { current: T | null } }).useRef<HTMLDivElement>(null);

  (React as { useEffect: (f: () => void | (() => void), deps?: unknown[]) => void }).useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;

    const needsPlayback = controls || sceneOptions.playback;
    const scene = new sceneClass({
      ...sceneOptions,
      playback: needsPlayback,
      canvas,
    });

    let destroyed = false;
    let controlsInstance: TimelineControls | null = null;

    (async () => {
      await scene.render();
      if (destroyed) return;

      if (controls && controlsRef.current && scene.playbackEnabled) {
        controlsInstance = new TimelineControls(scene.playback, controlsRef.current, {
          autoPlay,
        });
      } else if (autoPlay && scene.playbackEnabled) {
        scene.playback.play();
      }
      onReady?.(scene);
    })();

    return () => {
      destroyed = true;
      controlsInstance?.destroy();
      if (scene.playbackEnabled) {
        try {
          scene.playback.stop();
        } catch {
          /* noop */
        }
      }
      // Disconnect pointer dispatcher
      scene.pointerDispatcher?.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneClass, width, height, controls, autoPlay]);

  const h = (React as unknown as { createElement: (...args: unknown[]) => unknown }).createElement;
  return h(
    "div",
    { className, style },
    h("canvas", { ref: canvasRef, width, height, style: { display: "block" } }),
    controls ? h("div", { ref: controlsRef, style: { marginTop: 6 } }) : null,
  );
}

export default ManimScene;
