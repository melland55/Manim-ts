import * as THREE from "three";
import type { ManimConfig } from "../../core/types.js";

/**
 * ThreeRenderer — singleton-style WebGL renderer for manim-ts.
 *
 * Owns a single THREE.WebGLRenderer, a THREE.Scene, and a camera slot.
 * Attach to a canvas via the constructor, then call render() each frame.
 */
/** SSAA multiplier. Render offscreen at SSAA_SCALE² the pixel count and
 *  downsample to the canvas — matches the super-sampling approach Python
 *  Manim's OpenGLRenderer uses, yielding orientation-independent edge
 *  quality similar to Cairo's analytic coverage AA. */
const SSAA_SCALE = 2;

export class ThreeRenderer {
  private renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  // SSAA pipeline: render scene into renderTarget at SSAA_SCALE× resolution,
  // then blit to the canvas via a fullscreen quad with linear filtering.
  private renderTarget: THREE.WebGLRenderTarget;
  private blitScene: THREE.Scene;
  private blitCamera: THREE.OrthographicCamera;
  private blitMaterial: THREE.ShaderMaterial;

  constructor(canvas: HTMLCanvasElement, config?: Partial<ManimConfig>) {
    // Match Python Manim / Cairo: blend in sRGB space, not linear. three.js's
    // default color management converts sRGB→linear on input and linear→sRGB
    // on output, which blends alpha in linear space — perceptually "correct"
    // but produces different composite hues than Cairo. Python Manim uses
    // Cairo, so we disable color management for parity.
    THREE.ColorManagement.enabled = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA handled implicitly by SSAA downsample
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
    });
    // Use a strict painter-order sort for transparent objects: respect
    // renderOrder first, then fall back to insertion id (stable, matches the
    // order FamilySyncer added adapters — which mirrors Manim's VGroup order).
    // three.js's default transparent sort breaks ties by camera-space z, which
    // is unstable for co-planar 2D geometry even after nudging position.z.
    this.renderer.setTransparentSort((a, b) => {
      if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
      return a.id - b.id;
    });
    this.renderer.setOpaqueSort((a, b) => {
      if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
      return a.id - b.id;
    });

    // Pass-through output: colors stored in textures are already sRGB byte
    // values and we want them written to the canvas as-is (no conversion).
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    // No tone mapping — Manim uses linear color math
    this.renderer.toneMapping = THREE.NoToneMapping;

    // Default camera: perspective, positioned back along Z so the XY plane
    // matches Manim's default view (frame is ~14 units wide)
    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.width / (canvas.height || 1),
      0.01,
      1000,
    );
    this.camera.position.set(0, 0, 14);
    this.camera.lookAt(0, 0, 0);

    this.scene = new THREE.Scene();

    // SSAA render target — start at canvas size; resize() will grow it.
    const w = canvas.width || 1;
    const h = canvas.height || 1;
    this.renderTarget = new THREE.WebGLRenderTarget(
      w * SSAA_SCALE,
      h * SSAA_SCALE,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
      },
    );
    this.renderTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;

    // Fullscreen quad for the downsample blit. A 3×3 tent (bartlett) filter
    // widens the effective resolve kernel beyond bilinear, producing soft
    // edge falloff that approximates Cairo's analytical coverage AA.
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blitScene = new THREE.Scene();
    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        texelSize: { value: new THREE.Vector2(1 / (w * SSAA_SCALE), 1 / (h * SSAA_SCALE)) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 texelSize;
        varying vec2 vUv;
        void main() {
          // 3x3 tent filter weights (1-2-1 / 2-4-2 / 1-2-1) — sum 16
          vec4 c = vec4(0.0);
          c += texture2D(tDiffuse, vUv + texelSize * vec2(-1.0, -1.0)) * 1.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2( 0.0, -1.0)) * 2.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2( 1.0, -1.0)) * 1.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2(-1.0,  0.0)) * 2.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2( 0.0,  0.0)) * 4.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2( 1.0,  0.0)) * 2.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2(-1.0,  1.0)) * 1.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2( 0.0,  1.0)) * 2.0;
          c += texture2D(tDiffuse, vUv + texelSize * vec2( 1.0,  1.0)) * 1.0;
          gl_FragColor = c / 16.0;
        }
      `,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const blitQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.blitMaterial,
    );
    this.blitScene.add(blitQuad);

    // Background color from Manim config when available
    if (config?.backgroundColor) {
      const c = config.backgroundColor;
      const hex =
        (Math.round(c.r * 255) << 16) |
        (Math.round(c.g * 255) << 8) |
        Math.round(c.b * 255);
      this.renderer.setClearColor(hex, c.a);
    } else {
      // Manim default: black background
      this.renderer.setClearColor(0x000000, 1);
    }

    if (config?.pixelWidth != null && config?.pixelHeight != null) {
      this.resize(config.pixelWidth, config.pixelHeight);
    }
  }

  /**
   * Replace the active camera.
   * Accepts either a PerspectiveCamera or an OrthographicCamera.
   */
  setCamera(cam: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    this.camera = cam;
  }

  /**
   * Resize the renderer and update camera aspect / projection.
   */
  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.renderTarget.setSize(width * SSAA_SCALE, height * SSAA_SCALE);
    (this.blitMaterial.uniforms.texelSize.value as THREE.Vector2).set(
      1 / (width * SSAA_SCALE),
      1 / (height * SSAA_SCALE),
    );

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / (height || 1);
      this.camera.updateProjectionMatrix();
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      // Keep the camera's frustum symmetric around the origin
      const aspect = width / (height || 1);
      const halfH = (this.camera.top - this.camera.bottom) / 2 || 4;
      this.camera.left = -halfH * aspect;
      this.camera.right = halfH * aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Render the current scene with the active camera.
   */
  render(): void {
    // 1. Render scene into high-res offscreen target.
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    // 2. Downsample to canvas via linear-filtered fullscreen blit.
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.blitScene, this.blitCamera);
  }

  /**
   * Release GPU resources. Call when the renderer is no longer needed.
   */
  dispose(): void {
    this.renderTarget.dispose();
    this.blitMaterial.dispose();
    this.renderer.dispose();
  }
}
