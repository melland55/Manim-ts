import { describe, it, expect, vi, beforeEach } from "vitest";
import { Section, DefaultSectionType } from "../../src/scene/section/index.js";

describe("DefaultSectionType", () => {
  it("has the correct NORMAL value", () => {
    expect(DefaultSectionType.NORMAL).toBe("default.normal");
  });

  it("is a string enum", () => {
    expect(typeof DefaultSectionType.NORMAL).toBe("string");
  });
});

describe("Section", () => {
  let section: Section;

  beforeEach(() => {
    section = new Section(DefaultSectionType.NORMAL, "output.mp4", "intro", false);
  });

  it("constructs with provided values", () => {
    expect(section.type_).toBe(DefaultSectionType.NORMAL);
    expect(section.video).toBe("output.mp4");
    expect(section.name).toBe("intro");
    expect(section.skipAnimations).toBe(false);
    expect(section.partialMovieFiles).toEqual([]);
  });

  it("accepts null video", () => {
    const s = new Section(DefaultSectionType.NORMAL, null, "no-video", false);
    expect(s.video).toBeNull();
  });

  it("isEmpty returns true for a new section", () => {
    expect(section.isEmpty()).toBe(true);
  });

  it("isEmpty returns false after adding a partial movie file", () => {
    section.partialMovieFiles.push("part1.mp4");
    expect(section.isEmpty()).toBe(false);
  });

  it("isEmpty counts null entries", () => {
    section.partialMovieFiles.push(null);
    expect(section.isEmpty()).toBe(false);
  });

  it("getCleanPartialMovieFiles returns only non-null entries", () => {
    section.partialMovieFiles.push("a.mp4", null, "b.mp4", null, "c.mp4");
    expect(section.getCleanPartialMovieFiles()).toEqual(["a.mp4", "b.mp4", "c.mp4"]);
  });

  it("getCleanPartialMovieFiles returns empty array when all entries are null", () => {
    section.partialMovieFiles.push(null, null);
    expect(section.getCleanPartialMovieFiles()).toEqual([]);
  });

  it("getCleanPartialMovieFiles returns empty array for empty section", () => {
    expect(section.getCleanPartialMovieFiles()).toEqual([]);
  });

  it("getDict throws when video is null", async () => {
    const s = new Section(DefaultSectionType.NORMAL, null, "no-video", false);
    await expect(s.getDict("/some/dir")).rejects.toThrow(
      "does not have a video path assigned",
    );
  });

  it("toString returns expected string representation", () => {
    expect(section.toString()).toBe("<Section 'intro' stored in 'output.mp4'>");
  });

  it("toString works with null video", () => {
    const s = new Section(DefaultSectionType.NORMAL, null, "intro", false);
    expect(s.toString()).toBe("<Section 'intro' stored in 'null'>");
  });

  it("skipAnimations flag is preserved", () => {
    const s = new Section(DefaultSectionType.NORMAL, "x.mp4", "test", true);
    expect(s.skipAnimations).toBe(true);
  });
});
