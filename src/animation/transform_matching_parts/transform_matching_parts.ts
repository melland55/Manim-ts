/**
 * Animations that try to transform Mobjects while keeping track of identical parts.
 *
 * Python equivalent: manim/animation/transform_matching_parts.py
 */

import { np } from "../../core/math/index.js";
import type { IScene, IMobject, AnimationOptions, IAnimation } from "../../core/types.js";
import { Animation } from "../animation/index.js";
import { Mobject, Group } from "../../mobject/mobject/index.js";
import { Transform } from "../transform/index.js";
import type { TransformOptions } from "../transform/index.js";
import { FadeTransformPieces } from "../transform/index.js";
import { FadeIn, FadeOut } from "../fading/index.js";

// ─── Minimal AnimationGroup ─────────────────────────────────
// AnimationGroup (composition module) is not yet converted.
// This is a minimal local implementation sufficient for TransformMatchingAbstractBase.

interface AnimationGroupOptions extends AnimationOptions {
  group?: Group;
}

class AnimationGroup extends Animation {
  animations: Animation[];

  constructor(animations: Animation[], options: AnimationGroupOptions = {}) {
    const group = options.group ?? new Group(
      ...animations.map((a) => a.mobject as unknown as Mobject),
    );
    super(group as unknown as IMobject, options);
    this.animations = animations;
  }

  begin(): void {
    for (const anim of this.animations) {
      anim.begin();
    }
  }

  finish(): void {
    for (const anim of this.animations) {
      anim.finish();
    }
  }

  interpolate(alpha: number): void {
    for (const anim of this.animations) {
      anim.interpolate(alpha);
    }
  }

  cleanUpFromScene(scene: IScene): void {
    for (const anim of this.animations) {
      if (typeof (anim as Animation & { cleanUpFromScene?: (s: IScene) => void }).cleanUpFromScene === "function") {
        (anim as Animation & { cleanUpFromScene: (s: IScene) => void }).cleanUpFromScene(scene);
      }
    }
  }
}

// ─── TransformMatchingAbstractBase ──────────────────────────

export interface TransformMatchingOptions extends TransformOptions {
  transformMismatches?: boolean;
  fadeTransformMismatches?: boolean;
  keyMap?: Record<string, string>;
}

/**
 * Abstract base class for transformations that keep track of matching parts.
 *
 * Subclasses must implement `getMobjectParts` and `getMobjectKey`.
 *
 * Maps submobjects returned by `getMobjectParts` to keys via `getMobjectKey`,
 * then transforms submobjects with matching keys into each other.
 */
export class TransformMatchingAbstractBase extends AnimationGroup {
  toRemove: Mobject[];
  toAdd: Mobject;

  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformMatchingOptions = {},
  ) {
    const {
      transformMismatches = false,
      fadeTransformMismatches = false,
      keyMap: keyMapInput = {},
      ...restOptions
    } = options;

    const keyMap = { ...keyMapInput };

    const sourceMap = TransformMatchingAbstractBase._getShapeMap(
      mobject,
      (m: Mobject) => (new.target as typeof TransformMatchingAbstractBase).getMobjectParts(m),
      (m: Mobject) => (new.target as typeof TransformMatchingAbstractBase).getMobjectKey(m),
    );
    const targetMap = TransformMatchingAbstractBase._getShapeMap(
      targetMobject,
      (m: Mobject) => (new.target as typeof TransformMatchingAbstractBase).getMobjectParts(m),
      (m: Mobject) => (new.target as typeof TransformMatchingAbstractBase).getMobjectKey(m),
    );

    // Create groups of matching submobjects
    const transformSource = new Group();
    const transformTarget = new Group();
    const sourceKeys = new Set(sourceMap.keys());
    const targetKeys = new Set(targetMap.keys());

    for (const key of sourceKeys) {
      if (targetKeys.has(key)) {
        transformSource.add(sourceMap.get(key)!);
        transformTarget.add(targetMap.get(key)!);
      }
    }

    const anims: Animation[] = [
      new Transform(
        transformSource as unknown as Mobject,
        transformTarget as unknown as Mobject,
        restOptions,
      ),
    ];

    // Handle user-specified key mappings
    const keyMappedSource = new Group();
    const keyMappedTarget = new Group();
    for (const [key1, key2] of Object.entries(keyMap)) {
      if (sourceMap.has(key1) && targetMap.has(key2)) {
        keyMappedSource.add(sourceMap.get(key1)!);
        keyMappedTarget.add(targetMap.get(key2)!);
        sourceMap.delete(key1);
        targetMap.delete(key2);
      }
    }
    if (keyMappedSource.submobjects.length > 0) {
      anims.push(
        new FadeTransformPieces(
          keyMappedSource as unknown as Mobject,
          keyMappedTarget as unknown as Mobject,
          restOptions,
        ) as unknown as Animation,
      );
    }

    // Handle unmatched submobjects
    const fadeSource = new Group();
    const fadeTarget = new Group();
    for (const key of sourceKeys) {
      if (!targetKeys.has(key)) {
        fadeSource.add(sourceMap.get(key)!);
      }
    }
    for (const key of targetKeys) {
      if (!sourceKeys.has(key)) {
        fadeTarget.add(targetMap.get(key)!);
      }
    }
    const fadeTargetCopy = fadeTarget.copy();

    if (transformMismatches) {
      const mismatchOpts = { ...restOptions };
      if (mismatchOpts.replaceMobjectWithTargetInScene === undefined) {
        mismatchOpts.replaceMobjectWithTargetInScene = true;
      }
      anims.push(
        new Transform(
          fadeSource as unknown as Mobject,
          fadeTarget as unknown as Mobject,
          mismatchOpts,
        ),
      );
    } else if (fadeTransformMismatches) {
      anims.push(
        new FadeTransformPieces(
          fadeSource as unknown as Mobject,
          fadeTarget as unknown as Mobject,
          restOptions,
        ) as unknown as Animation,
      );
    } else {
      anims.push(
        new FadeOut(
          fadeSource as unknown as Mobject,
          { targetPosition: fadeTarget as unknown as Mobject, ...restOptions },
        ) as unknown as Animation,
      );
      anims.push(
        new FadeIn(
          fadeTargetCopy as unknown as Mobject,
          { targetPosition: fadeTarget as unknown as Mobject, ...restOptions },
        ) as unknown as Animation,
      );
    }

    super(anims);

    this.toRemove = [mobject, fadeTargetCopy];
    this.toAdd = targetMobject;
  }

  /**
   * Build a map from key → Group of submobjects sharing that key.
   */
  private static _getShapeMap(
    mobject: Mobject,
    getParts: (m: Mobject) => Mobject[],
    getKey: (m: Mobject) => string | number,
  ): Map<string, Group> {
    const shapeMap = new Map<string, Group>();
    for (const sm of getParts(mobject)) {
      const key = String(getKey(sm));
      if (!shapeMap.has(key)) {
        shapeMap.set(key, new Group());
      }
      shapeMap.get(key)!.add(sm);
    }
    return shapeMap;
  }

  cleanUpFromScene(scene: IScene): void {
    // Interpolate all animations back to 0 to ensure source mobjects remain unchanged.
    for (const anim of this.animations) {
      anim.interpolate(0);
    }
    scene.remove(this.mobject as unknown as IMobject);
    for (const mob of this.toRemove) {
      scene.remove(mob as unknown as IMobject);
    }
    scene.add(this.toAdd as unknown as IMobject);
  }

  /**
   * Return the submobject parts of the given mobject.
   * Must be overridden in subclasses.
   */
  static getMobjectParts(mobject: Mobject): Mobject[] {
    throw new Error("To be implemented in subclass.");
  }

  /**
   * Return a key for the given mobject used to match parts.
   * Must be overridden in subclasses.
   */
  static getMobjectKey(mobject: Mobject): string | number {
    throw new Error("To be implemented in subclass.");
  }
}

// ─── TransformMatchingShapes ────────────────────────────────

/**
 * An animation trying to transform groups by matching the shape of their submobjects.
 *
 * Two submobjects match if the hash of their point coordinates after normalization
 * (translation to origin, height fixed at 1, coordinates rounded to 3 decimal places)
 * matches.
 */
export class TransformMatchingShapes extends TransformMatchingAbstractBase {
  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformMatchingOptions = {},
  ) {
    super(mobject, targetMobject, options);
  }

  static override getMobjectParts(mobject: Mobject): Mobject[] {
    return mobject.familyMembersWithPoints();
  }

  static override getMobjectKey(mobject: Mobject): number {
    mobject.saveState();
    mobject.center();
    mobject.set({ height: 1 });
    // Round points to 3 decimal places, add 0.0 to avoid -0
    const rounded = np.round(mobject.points, 3).add(0.0);
    const flat = rounded.flatten();
    const arr = flat.toArray() as number[];
    // Hash the stringified array for reliable differentiation
    const str = arr.join(",");
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    mobject.restore();
    return hash;
  }
}

// ─── TransformMatchingTex ───────────────────────────────────

/**
 * A transformation trying to transform rendered LaTeX strings.
 *
 * Two submobjects match if their `texString` matches.
 */
export class TransformMatchingTex extends TransformMatchingAbstractBase {
  constructor(
    mobject: Mobject,
    targetMobject: Mobject,
    options: TransformMatchingOptions = {},
  ) {
    super(mobject, targetMobject, options);
  }

  static override getMobjectParts(mobject: Mobject): Mobject[] {
    if (mobject instanceof Group) {
      const parts: Mobject[] = [];
      for (const s of mobject.submobjects) {
        parts.push(...TransformMatchingTex.getMobjectParts(s));
      }
      return parts;
    } else {
      // Assumes mobject has a texString property (e.g., MathTex)
      return mobject.submobjects;
    }
  }

  static override getMobjectKey(mobject: Mobject): string {
    return (mobject as unknown as { texString: string }).texString;
  }
}
