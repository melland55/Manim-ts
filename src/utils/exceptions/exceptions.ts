/**
 * Custom exception classes for manim-ts.
 * Python: manim.utils.exceptions
 */

export class EndSceneEarlyException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "EndSceneEarlyException";
  }
}

export class RerunSceneException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "RerunSceneException";
  }
}

export class MultiAnimationOverrideException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MultiAnimationOverrideException";
  }
}
