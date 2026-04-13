/**
 * Tests for animation/transform — Transform, ReplacementTransform,
 * ClockwiseTransform, CounterclockwiseTransform, MoveToTarget,
 * ApplyMethod, ScaleInPlace, ShrinkToCenter, Restore, ApplyFunction,
 * CyclicReplace, Swap, FadeTransform, FadeTransformPieces.
 */

import { describe, it, expect } from "vitest";
import "../../tests/helpers/point-matchers.js";

import { np, ORIGIN, OUT } from "../../src/core/math/index.js";
import { Mobject, Group } from "../../src/mobject/mobject/index.js";
import {
  Transform,
  ReplacementTransform,
  TransformFromCopy,
  ClockwiseTransform,
  CounterclockwiseTransform,
  MoveToTarget,
  _MethodAnimation,
  ApplyMethod,
  ApplyPointwiseFunction,
  ApplyPointwiseFunctionToCenter,
  FadeToColor,
  ScaleInPlace,
  ShrinkToCenter,
  Restore,
  ApplyFunction,
  ApplyMatrix,
  ApplyComplexFunction,
  CyclicReplace,
  Swap,
  TransformAnimations,
  FadeTransform,
  FadeTransformPieces,
} from "../../src/animation/transform/index.js";
import type { TransformOptions } from "../../src/animation/transform/index.js";
import { pathAlongArc, straightPath } from "../../src/utils/paths/index.js";

// ─── Tests ───────────────────────────────────────────────────

describe("Transform", () => {
  it("constructs with defaults", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new Transform(source, target);

    expect(anim.targetMobject).toBe(target);
    expect(anim.replaceMobjectWithTargetInScene).toBe(false);
    expect(anim.pathArc).toBe(0);
    expect(anim.runTime).toBe(1);
  });

  it("constructs with options", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new Transform(source, target, {
      pathArc: Math.PI / 2,
      runTime: 2,
      replaceMobjectWithTargetInScene: true,
    });

    expect(anim.pathArc).toBe(Math.PI / 2);
    expect(anim.runTime).toBe(2);
    expect(anim.replaceMobjectWithTargetInScene).toBe(true);
  });

  it("creates empty Mobject when no target given", () => {
    const source = new Mobject();
    const anim = new Transform(source);

    expect(anim.targetMobject).toBeInstanceOf(Mobject);
  });

  it("pathArc setter updates pathFunc", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new Transform(source, target);

    const func1 = anim.pathFunc;
    anim.pathArc = Math.PI;
    const func2 = anim.pathFunc;

    expect(func1).not.toBe(func2);
  });

  it("accepts custom pathFunc", () => {
    const source = new Mobject();
    const target = new Mobject();
    const customPath = straightPath();
    const anim = new Transform(source, target, { pathFunc: customPath });

    expect(anim.pathFunc).toBe(customPath);
  });

  it("createTarget returns targetMobject by default", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new Transform(source, target);

    expect(anim.createTarget()).toBe(target);
  });
});

describe("ReplacementTransform", () => {
  it("sets replaceMobjectWithTargetInScene to true", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new ReplacementTransform(source, target);

    expect(anim.replaceMobjectWithTargetInScene).toBe(true);
  });
});

describe("TransformFromCopy", () => {
  it("swaps mobject and target", () => {
    const source = new Mobject({ name: "source" });
    const target = new Mobject({ name: "target" });
    const anim = new TransformFromCopy(source, target);

    // TransformFromCopy passes (target, source) to Transform
    expect(anim.targetMobject.name).toBe("source");
  });
});

describe("ClockwiseTransform", () => {
  it("sets pathArc to -PI", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new ClockwiseTransform(source, target);

    expect(anim.pathArc).toBe(-Math.PI);
  });
});

describe("CounterclockwiseTransform", () => {
  it("sets pathArc to PI", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new CounterclockwiseTransform(source, target);

    expect(anim.pathArc).toBe(Math.PI);
  });
});

describe("MoveToTarget", () => {
  it("throws if mobject has no target", () => {
    const mob = new Mobject();
    expect(() => new MoveToTarget(mob)).toThrow(
      "MoveToTarget called on mobject without attribute 'target'",
    );
  });

  it("works when mobject has a target", () => {
    const mob = new Mobject();
    mob.generateTarget();
    const anim = new MoveToTarget(mob);
    expect(anim.targetMobject).toBe(mob.target);
  });
});

describe("ApplyMethod", () => {
  it("constructs with method name and args", () => {
    const mob = new Mobject();
    const anim = new ApplyMethod(mob, "scale", [2]);

    expect(anim.methodName).toBe("scale");
    expect(anim.methodArgs).toEqual([2]);
  });

  it("createTarget applies method to copy", () => {
    const mob = new Mobject();
    const anim = new ApplyMethod(mob, "shift", [np.array([1, 0, 0])]);

    const target = anim.createTarget();
    expect(target).toBeInstanceOf(Mobject);
    expect(target).not.toBe(mob);
  });

  it("throws for non-existent method", () => {
    const mob = new Mobject();
    const anim = new ApplyMethod(mob, "nonExistentMethod");

    expect(() => anim.createTarget()).toThrow("not found on mobject");
  });
});

describe("ScaleInPlace", () => {
  it("constructs correctly", () => {
    const mob = new Mobject();
    const anim = new ScaleInPlace(mob, 2);
    expect(anim).toBeInstanceOf(Transform);
  });
});

describe("ShrinkToCenter", () => {
  it("uses scale factor of 0", () => {
    const mob = new Mobject();
    const anim = new ShrinkToCenter(mob);
    expect(anim).toBeInstanceOf(ScaleInPlace);
  });
});

describe("Restore", () => {
  it("throws if no saved state", () => {
    const mob = new Mobject();
    expect(() => new Restore(mob)).toThrow(
      "Trying to restore without having saved",
    );
  });

  it("works after saveState", () => {
    const mob = new Mobject();
    mob.saveState();
    const anim = new Restore(mob);
    expect(anim.targetMobject).toBe(mob.savedState);
  });
});

describe("ApplyFunction", () => {
  it("throws if function returns non-Mobject", () => {
    const mob = new Mobject();
    const anim = new ApplyFunction(
      (_m) => "not a mobject" as unknown as Mobject,
      mob,
    );
    expect(() => anim.createTarget()).toThrow(
      "Functions passed to ApplyFunction must return object of type Mobject",
    );
  });

  it("applies function to copy of mobject", () => {
    const mob = new Mobject();
    const anim = new ApplyFunction((m) => m, mob);

    const target = anim.createTarget();
    expect(target).toBeInstanceOf(Mobject);
    expect(target).not.toBe(mob);
  });
});

describe("ApplyMatrix", () => {
  it("initializes 2x2 matrix to 3x3", () => {
    const mat = ApplyMatrix.initializeMatrix([[1, 0], [0, 1]]);
    expect(mat.shape).toEqual([3, 3]);
    expect(mat.get([0, 0])).toBe(1);
    expect(mat.get([2, 2])).toBe(1);
  });

  it("passes through 3x3 matrix", () => {
    const input = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const mat = ApplyMatrix.initializeMatrix(input);
    expect(mat.shape).toEqual([3, 3]);
  });

  it("throws for bad dimensions", () => {
    expect(() => ApplyMatrix.initializeMatrix([[1, 2, 3, 4]])).toThrow(
      "Matrix has bad dimensions",
    );
  });
});

describe("CyclicReplace", () => {
  it("creates group from mobjects", () => {
    const a = new Mobject({ name: "a" });
    const b = new Mobject({ name: "b" });
    const c = new Mobject({ name: "c" });
    const anim = new CyclicReplace([a, b, c]);

    expect(anim.group).toBeInstanceOf(Group);
    expect(anim.group.submobjects).toHaveLength(3);
  });

  it("defaults pathArc to 90 degrees", () => {
    const a = new Mobject();
    const b = new Mobject();
    const anim = new CyclicReplace([a, b]);

    expect(anim.pathArc).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe("Swap", () => {
  it("extends CyclicReplace", () => {
    const a = new Mobject();
    const b = new Mobject();
    const anim = new Swap([a, b]);

    expect(anim).toBeInstanceOf(CyclicReplace);
  });
});

describe("FadeTransform", () => {
  it("constructs with stretch defaults", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new FadeTransform(source, target);

    expect(anim.stretch).toBe(true);
    expect(anim.dimToMatch).toBe(1);
    expect(anim.toAddOnCompletion).toBe(target);
  });

  it("constructs with custom stretch options", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new FadeTransform(source, target, {
      stretch: false,
      dimToMatch: 0,
    });

    expect(anim.stretch).toBe(false);
    expect(anim.dimToMatch).toBe(0);
  });
});

describe("FadeTransformPieces", () => {
  it("extends FadeTransform", () => {
    const source = new Mobject();
    const target = new Mobject();
    const anim = new FadeTransformPieces(source, target);

    expect(anim).toBeInstanceOf(FadeTransform);
  });
});

describe("barrel exports", () => {
  it("exports all public classes", () => {
    expect(Transform).toBeDefined();
    expect(ReplacementTransform).toBeDefined();
    expect(TransformFromCopy).toBeDefined();
    expect(ClockwiseTransform).toBeDefined();
    expect(CounterclockwiseTransform).toBeDefined();
    expect(MoveToTarget).toBeDefined();
    expect(_MethodAnimation).toBeDefined();
    expect(ApplyMethod).toBeDefined();
    expect(ApplyPointwiseFunction).toBeDefined();
    expect(ApplyPointwiseFunctionToCenter).toBeDefined();
    expect(FadeToColor).toBeDefined();
    expect(ScaleInPlace).toBeDefined();
    expect(ShrinkToCenter).toBeDefined();
    expect(Restore).toBeDefined();
    expect(ApplyFunction).toBeDefined();
    expect(ApplyMatrix).toBeDefined();
    expect(ApplyComplexFunction).toBeDefined();
    expect(CyclicReplace).toBeDefined();
    expect(Swap).toBeDefined();
    expect(TransformAnimations).toBeDefined();
    expect(FadeTransform).toBeDefined();
    expect(FadeTransformPieces).toBeDefined();
  });
});
