/**
 * Vue 3 wrapper — `<ManimScene>` component.
 * Not part of Python Manim. Peer-dep: vue >= 3.
 *
 * Usage:
 *   import { ManimScene } from "manim-ts/vue";
 *   <ManimScene :scene-class="MyScene" controls playback :width="800" :height="450" />
 */

// @ts-expect-error — peer dep. Users install vue themselves.
import { defineComponent, h, onMounted, onBeforeUnmount, ref } from "vue";
import type { Scene, SceneOptions } from "../scene/scene/index.js";
import { TimelineControls } from "../scene/timeline/controls.js";

export const ManimScene = defineComponent({
  name: "ManimScene",
  props: {
    sceneClass: { type: Function, required: true },
    controls: { type: Boolean, default: false },
    playback: { type: Boolean, default: false },
    interactive: { type: Boolean, default: false },
    width: { type: Number, default: 800 },
    height: { type: Number, default: 450 },
    autoPlay: { type: Boolean, default: false },
    frameRate: { type: Number, default: 30 },
  },
  emits: ["ready"],
  setup(props: Record<string, unknown>, ctx: { emit: (event: string, ...args: unknown[]) => void }) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const controlsContainerRef = ref<HTMLDivElement | null>(null);
    let scene: Scene | null = null;
    let controlsInstance: TimelineControls | null = null;

    onMounted(async () => {
      const canvas = canvasRef.value;
      if (!canvas) return;
      canvas.width = props.width as number;
      canvas.height = props.height as number;

      const SceneClass = props.sceneClass as new (opts?: SceneOptions) => Scene;
      const needsPlayback = (props.controls as boolean) || (props.playback as boolean);

      scene = new SceneClass({
        playback: needsPlayback,
        interactive: props.interactive as boolean,
        frameRate: props.frameRate as number,
        canvas,
      });

      await scene.render();

      if (props.controls && controlsContainerRef.value && scene.playbackEnabled) {
        controlsInstance = new TimelineControls(
          scene.playback,
          controlsContainerRef.value,
          { autoPlay: props.autoPlay as boolean },
        );
      } else if (props.autoPlay && scene.playbackEnabled) {
        scene.playback.play();
      }

      ctx.emit("ready", scene);
    });

    onBeforeUnmount(() => {
      controlsInstance?.destroy();
      if (scene?.playbackEnabled) {
        try {
          scene.playback.stop();
        } catch {
          /* noop */
        }
      }
      scene?.pointerDispatcher?.detach();
    });

    return () =>
      h("div", [
        h("canvas", {
          ref: canvasRef,
          width: props.width,
          height: props.height,
          style: { display: "block" },
        }),
        props.controls
          ? h("div", { ref: controlsContainerRef, style: { marginTop: "6px" } })
          : null,
      ]);
  },
});

export default ManimScene;
