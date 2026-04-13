import { describe, it, expect } from "vitest";
import {
  EndSceneEarlyException,
  RerunSceneException,
  MultiAnimationOverrideException,
} from "../../src/utils/exceptions/index.js";

describe("EndSceneEarlyException", () => {
  it("is an instance of Error", () => {
    const err = new EndSceneEarlyException();
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct name", () => {
    const err = new EndSceneEarlyException();
    expect(err.name).toBe("EndSceneEarlyException");
  });

  it("accepts an optional message", () => {
    const err = new EndSceneEarlyException("scene ended early");
    expect(err.message).toBe("scene ended early");
  });

  it("can be thrown and caught", () => {
    expect(() => {
      throw new EndSceneEarlyException("stopping");
    }).toThrow(EndSceneEarlyException);
  });
});

describe("RerunSceneException", () => {
  it("is an instance of Error", () => {
    const err = new RerunSceneException();
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct name", () => {
    const err = new RerunSceneException();
    expect(err.name).toBe("RerunSceneException");
  });

  it("accepts an optional message", () => {
    const err = new RerunSceneException("rerun requested");
    expect(err.message).toBe("rerun requested");
  });

  it("can be thrown and caught", () => {
    expect(() => {
      throw new RerunSceneException();
    }).toThrow(RerunSceneException);
  });
});

describe("MultiAnimationOverrideException", () => {
  it("is an instance of Error", () => {
    const err = new MultiAnimationOverrideException();
    expect(err).toBeInstanceOf(Error);
  });

  it("has the correct name", () => {
    const err = new MultiAnimationOverrideException();
    expect(err.name).toBe("MultiAnimationOverrideException");
  });

  it("accepts an optional message", () => {
    const err = new MultiAnimationOverrideException("override conflict");
    expect(err.message).toBe("override conflict");
  });

  it("can be thrown and caught", () => {
    expect(() => {
      throw new MultiAnimationOverrideException("conflict");
    }).toThrow(MultiAnimationOverrideException);
  });

  it("is distinct from other exception types", () => {
    const err = new MultiAnimationOverrideException();
    expect(err).not.toBeInstanceOf(EndSceneEarlyException);
    expect(err).not.toBeInstanceOf(RerunSceneException);
  });
});
