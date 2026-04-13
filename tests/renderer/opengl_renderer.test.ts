import { describe, it, expect } from "vitest";
import { np, PI, ORIGIN, OUT, RIGHT } from "../../src/core/math/index.js";
import "../../tests/helpers/point-matchers.js";
import {
  OpenGLCamera,
  OpenGLRenderer,
} from "../../src/renderer/opengl_renderer/index.js";

// ---------------------------------------------------------------------------
// OpenGLCamera
// ---------------------------------------------------------------------------

describe("OpenGLCamera", () => {
  it("constructs with default options", () => {
    const cam = new OpenGLCamera();
    expect(cam.useZIndex).toBe(true);
    expect(cam.frameRate).toBe(60);
    expect(cam.orthographic).toBe(false);
    expect(cam.focalDistance).toBe(2.0);
    expect(cam.minimumPolarAngle).toBeCloseTo(-PI / 2);
    expect(cam.maximumPolarAngle).toBeCloseTo(PI / 2);
  });

  it("constructs with custom frame shape", () => {
    const cam = new OpenGLCamera({ frameShape: [20, 10] });
    expect(cam.frameShape).toEqual([20, 10]);
    expect(cam.getWidth()).toBeCloseTo(20);
    expect(cam.getHeight()).toBeCloseTo(10);
  });

  it("constructs with orthographic projection", () => {
    const cam = new OpenGLCamera({ orthographic: true });
    expect(cam.orthographic).toBe(true);
    expect(cam.projectionMatrix).toBeDefined();
  });

  it("getShape returns [width, height]", () => {
    const cam = new OpenGLCamera({ frameShape: [16, 9] });
    const shape = cam.getShape();
    expect(shape[0]).toBeCloseTo(16);
    expect(shape[1]).toBeCloseTo(9);
  });

  it("getCenter returns first point", () => {
    const cam = new OpenGLCamera();
    const center = cam.getCenter();
    expect(center.get([0])).toBeCloseTo(0);
    expect(center.get([1])).toBeCloseTo(0);
    expect(center.get([2])).toBeCloseTo(0);
  });

  it("getFocalDistance returns focalDistance * height", () => {
    const cam = new OpenGLCamera({ frameShape: [14, 8], focalDistance: 2.0 });
    expect(cam.getFocalDistance()).toBeCloseTo(2.0 * 8);
  });

  it("setEulerAngles updates angles and returns this", () => {
    const cam = new OpenGLCamera();
    const result = cam.setEulerAngles(0.1, 0.2, 0.3);
    expect(result).toBe(cam);
    expect(cam.eulerAngles.get([0])).toBeCloseTo(0.1);
    expect(cam.eulerAngles.get([1])).toBeCloseTo(0.2);
    expect(cam.eulerAngles.get([2])).toBeCloseTo(0.3);
  });

  it("setTheta/setPhi/setGamma only update the targeted angle", () => {
    const cam = new OpenGLCamera();
    cam.setEulerAngles(0.1, 0.2, 0.3);
    cam.setTheta(0.5);
    expect(cam.eulerAngles.get([0])).toBeCloseTo(0.5);
    expect(cam.eulerAngles.get([1])).toBeCloseTo(0.2);
    expect(cam.eulerAngles.get([2])).toBeCloseTo(0.3);
  });

  it("incrementTheta adds to current theta", () => {
    const cam = new OpenGLCamera();
    cam.setTheta(1.0);
    cam.incrementTheta(0.5);
    expect(cam.eulerAngles.get([0])).toBeCloseTo(1.5);
  });

  it("incrementPhi clamps to [-PI/2, PI/2]", () => {
    const cam = new OpenGLCamera();
    cam.setPhi(PI / 2 - 0.1);
    cam.incrementPhi(1.0); // would exceed PI/2
    expect(cam.eulerAngles.get([1]) as number).toBeLessThanOrEqual(PI / 2 + 1e-10);
  });

  it("rotate returns this for chaining", () => {
    const cam = new OpenGLCamera();
    const result = cam.rotate(0.1);
    expect(result).toBe(cam);
  });

  it("toDefaultState resets euler angles", () => {
    const cam = new OpenGLCamera();
    cam.setEulerAngles(1.0, 0.5, 0.3);
    cam.toDefaultState();
    expect(cam.eulerAngles.get([0])).toBeCloseTo(0);
    expect(cam.eulerAngles.get([1])).toBeCloseTo(0);
    expect(cam.eulerAngles.get([2])).toBeCloseTo(0);
  });

  it("refreshRotationMatrix produces a valid 3x3 matrix", () => {
    const cam = new OpenGLCamera();
    cam.refreshRotationMatrix();
    expect(cam.inverseRotationMatrix.shape).toEqual([3, 3]);
  });

  it("getPosition extracts from model matrix", () => {
    const cam = new OpenGLCamera();
    const pos = cam.getPosition();
    // Default model matrix translates to (0, 0, 11)
    expect(pos.get([2]) as number).toBeCloseTo(11);
  });

  it("setPosition updates model matrix column", () => {
    const cam = new OpenGLCamera();
    cam.setPosition(np.array([1, 2, 3]));
    const pos = cam.getPosition();
    expect(pos.get([0])).toBeCloseTo(1);
    expect(pos.get([1])).toBeCloseTo(2);
    expect(pos.get([2])).toBeCloseTo(3);
  });
});

// ---------------------------------------------------------------------------
// OpenGLRenderer
// ---------------------------------------------------------------------------

describe("OpenGLRenderer", () => {
  it("constructs with default options", () => {
    const renderer = new OpenGLRenderer();
    expect(renderer.antiAliasWidth).toBe(1.5);
    expect(renderer.skipAnimations).toBe(false);
    expect(renderer.animationStartTime).toBe(0);
    expect(renderer.animationElapsedTime).toBe(0);
    expect(renderer.time).toBe(0);
    expect(renderer.numPlays).toBe(0);
    expect(renderer.camera).toBeInstanceOf(OpenGLCamera);
    expect(renderer.pressedKeys.size).toBe(0);
    expect(renderer.window).toBeNull();
    expect(renderer.pathToTextureId.size).toBe(0);
  });

  it("constructs with skipAnimations=true", () => {
    const renderer = new OpenGLRenderer({ skipAnimations: true });
    expect(renderer.skipAnimations).toBe(true);
    expect(renderer._originalSkippingStatus).toBe(true);
  });

  it("getPixelShape returns null when no framebuffer", () => {
    const renderer = new OpenGLRenderer();
    // frameBufferObject is null by default
    expect(renderer.getPixelShape()).toBeNull();
  });

  it("getTextureId assigns incrementing IDs", () => {
    const renderer = new OpenGLRenderer();
    const id0 = renderer.getTextureId("texture_a.png");
    const id1 = renderer.getTextureId("texture_b.png");
    expect(id0).toBe(0);
    expect(id1).toBe(1);
    // Same path returns same ID
    expect(renderer.getTextureId("texture_a.png")).toBe(0);
  });

  it("getRawFrameBufferObjectData returns empty when no framebuffer", () => {
    const renderer = new OpenGLRenderer();
    const data = renderer.getRawFrameBufferObjectData();
    expect(data).toBeInstanceOf(Uint8Array);
    expect(data.length).toBe(0);
  });

  it("pixelCoordsToSpaceCoords returns origin when no pixel shape", () => {
    const renderer = new OpenGLRenderer();
    const result = renderer.pixelCoordsToSpaceCoords(100, 100);
    expect(result.get([0])).toBeCloseTo(0);
    expect(result.get([1])).toBeCloseTo(0);
    expect(result.get([2])).toBeCloseTo(0);
  });

  it("backgroundColor getter/setter round-trips", () => {
    const renderer = new OpenGLRenderer();
    renderer.backgroundColor = [0.5, 0.6, 0.7, 1.0];
    const bg = renderer.backgroundColor;
    expect(bg[0]).toBeCloseTo(0.5);
    expect(bg[1]).toBeCloseTo(0.6);
    expect(bg[2]).toBeCloseTo(0.7);
    expect(bg[3]).toBeCloseTo(1.0);
  });

  it("shouldSaveLastFrame returns true when numPlays=0", () => {
    const renderer = new OpenGLRenderer();
    // Mock scene with interactiveMode false
    (renderer as unknown as { scene: { interactiveMode: boolean } }).scene = {
      interactiveMode: false,
    };
    expect(renderer.numPlays).toBe(0);
    expect(renderer.shouldSaveLastFrame()).toBe(true);
  });

  it("clearScreen does not throw when window is null", () => {
    const renderer = new OpenGLRenderer();
    expect(() => renderer.clearScreen()).not.toThrow();
  });
});
