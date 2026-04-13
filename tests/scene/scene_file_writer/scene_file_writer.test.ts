import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
  SceneFileWriter,
  toFfmpegFrameRate,
  AudioSegment,
  composeSrt,
} from "../../../src/scene/scene_file_writer/index.js";
import type {
  SceneFileWriterConfig,
  SceneFileWriterRenderer,
  Subtitle,
} from "../../../src/scene/scene_file_writer/index.js";
import { DefaultSectionType } from "../../../src/scene/section/index.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeRenderer(numPlays = 0): SceneFileWriterRenderer {
  return { numPlays };
}

function makeConfig(
  overrides: Partial<SceneFileWriterConfig> = {},
): SceneFileWriterConfig {
  return {
    pixelWidth: 1920,
    pixelHeight: 1080,
    frameRate: 30,
    mediaDir: path.join(os.tmpdir(), `manim_test_${Date.now()}`),
    dryRun: true, // avoid touching disk by default
    ...overrides,
  };
}

// ─── toFfmpegFrameRate ────────────────────────────────────────────────────────

describe("toFfmpegFrameRate", () => {
  it("returns num=fps, denom=1 for integer fps", () => {
    expect(toFfmpegFrameRate(30)).toEqual({ num: 30, denom: 1 });
    expect(toFfmpegFrameRate(60)).toEqual({ num: 60, denom: 1 });
    expect(toFfmpegFrameRate(15)).toEqual({ num: 15, denom: 1 });
  });

  it("rounds near-integer fps to integers", () => {
    // epsilon1 = 1e-4; must be strictly less than epsilon1 to round
    expect(toFfmpegFrameRate(29.99999)).toEqual({ num: 30, denom: 1 });
    expect(toFfmpegFrameRate(60.00001)).toEqual({ num: 60, denom: 1 });
  });

  it("converts 23.976 fps to 24000/1001", () => {
    const { num, denom } = toFfmpegFrameRate(23.976023976);
    expect(denom).toBe(1001);
    expect(Math.abs(num / denom - 23.976023976)).toBeLessThan(0.02);
  });

  it("converts 29.97 fps to 30000/1001", () => {
    const { num, denom } = toFfmpegFrameRate(29.97002997);
    expect(denom).toBe(1001);
    expect(Math.abs(num / denom - 29.97002997)).toBeLessThan(0.02);
  });

  it("throws for truly invalid frame rates", () => {
    expect(() => toFfmpegFrameRate(7.3)).toThrow("Invalid frame rate");
  });
});

// ─── composeSrt ──────────────────────────────────────────────────────────────

describe("composeSrt", () => {
  it("composes a single subtitle correctly", () => {
    const subs: Subtitle[] = [
      { index: 1, start: 0, end: 2.5, content: "Hello, world!" },
    ];
    const srt = composeSrt(subs);
    expect(srt).toContain("1\n");
    expect(srt).toContain("00:00:00,000 --> 00:00:02,500");
    expect(srt).toContain("Hello, world!");
  });

  it("sorts subtitles by index", () => {
    const subs: Subtitle[] = [
      { index: 2, start: 3, end: 5, content: "Second" },
      { index: 1, start: 0, end: 2, content: "First" },
    ];
    const srt = composeSrt(subs);
    const firstIdx = srt.indexOf("First");
    const secondIdx = srt.indexOf("Second");
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("returns empty string for no subtitles", () => {
    expect(composeSrt([])).toBe("");
  });

  it("formats hours correctly", () => {
    const subs: Subtitle[] = [
      { index: 1, start: 3661.001, end: 3662, content: "Late subtitle" },
    ];
    const srt = composeSrt(subs);
    expect(srt).toContain("01:01:01,001 --> 01:01:02,000");
  });
});

// ─── AudioSegment ─────────────────────────────────────────────────────────────

describe("AudioSegment", () => {
  it("silent(0) has zero duration", () => {
    const seg = AudioSegment.silent(0);
    expect(seg.duration_seconds).toBe(0);
  });

  it("silent(2000) has 2 second duration", () => {
    const seg = AudioSegment.silent(2000);
    expect(seg.duration_seconds).toBe(2);
  });

  it("silent() with no args has zero duration", () => {
    const seg = AudioSegment.silent();
    expect(seg.duration_seconds).toBe(0);
  });

  it("append extends duration", () => {
    const a = AudioSegment.silent(1000);
    const b = AudioSegment.silent(500);
    const combined = a.append(b);
    expect(combined.duration_seconds).toBeCloseTo(1.5);
  });

  it("overlay does not shrink duration", () => {
    const a = AudioSegment.silent(3000);
    const b = AudioSegment.silent(1000);
    const mixed = a.overlay(b, { position: 0 });
    expect(mixed.duration_seconds).toBeCloseTo(3);
  });

  it("overlay can extend duration when overlaid past end", () => {
    const a = AudioSegment.silent(1000);
    const b = AudioSegment.silent(1000);
    const mixed = a.overlay(b, { position: 500 });
    // Ends at 500ms + 1000ms = 1500ms
    expect(mixed.duration_seconds).toBeCloseTo(1.5);
  });

  it("applyGain returns a new segment with same duration", () => {
    const seg = AudioSegment.silent(2000);
    const gained = seg.applyGain(6);
    expect(gained.duration_seconds).toBe(seg.duration_seconds);
  });

  it("applyGain does not mutate original", () => {
    const seg = AudioSegment.silent(2000);
    seg.applyGain(6);
    // duration_seconds should not be affected
    expect(seg.duration_seconds).toBe(2);
  });
});

// ─── SceneFileWriter (dry-run / unit tests) ───────────────────────────────────

describe("SceneFileWriter — constructor", () => {
  it("initialises with defaults in dry-run mode", () => {
    const renderer = makeRenderer();
    const config = makeConfig({ dryRun: true });
    const writer = new SceneFileWriter(renderer, "TestScene", config);

    expect(writer.frameCount).toBe(0);
    expect(writer.partialMovieFiles).toEqual([]);
    expect(writer.subcaptions).toEqual([]);
    expect(writer.includesSound).toBe(false);
  });

  it("auto-creates first section named 'autocreated'", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig());
    expect(writer.sections).toHaveLength(1);
    expect(writer.sections[0].name).toBe("autocreated");
    expect(writer.sections[0].skipAnimations).toBe(false);
  });

  it("forceOutputAsSceneName is false by default", () => {
    expect(SceneFileWriter.forceOutputAsSceneName).toBe(false);
  });
});

describe("SceneFileWriter — getResolutionDirectory", () => {
  it("returns <height>p<frameRate>", () => {
    const writer = new SceneFileWriter(
      makeRenderer(),
      "TestScene",
      makeConfig({ pixelHeight: 480, frameRate: 15 }),
    );
    expect(writer.getResolutionDirectory()).toBe("480p15");
  });

  it("uses config values", () => {
    const writer = new SceneFileWriter(
      makeRenderer(),
      "TestScene",
      makeConfig({ pixelHeight: 2160, frameRate: 60 }),
    );
    expect(writer.getResolutionDirectory()).toBe("2160p60");
  });
});

describe("SceneFileWriter — addPartialMovieFile", () => {
  it("does nothing in dry-run mode", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig({ dryRun: true }));
    writer.addPartialMovieFile("abc123");
    expect(writer.partialMovieFiles).toEqual([]);
  });

  it("adds null when hash is null", () => {
    // Even without a partialMovieDirectory the method guards on that; we just
    // verify the null path is reached when partialMovieDirectory is set.
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig({ dryRun: true }));
    // Manually set partialMovieDirectory to simulate non-dry-run directory setup
    (writer as unknown as { partialMovieDirectory: string }).partialMovieDirectory = "/tmp/partial";
    // Also override _writeToMovie to return true for this test
    const origConfig = (writer as unknown as { _config: SceneFileWriterConfig })._config;
    origConfig.dryRun = false;
    origConfig.writeToMovie = true;

    writer.addPartialMovieFile(null);
    expect(writer.partialMovieFiles).toContain(null);
    expect(writer.sections[0].partialMovieFiles).toContain(null);
  });
});

describe("SceneFileWriter — isAlreadyCached", () => {
  it("returns false when no partialMovieDirectory", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig({ dryRun: true }));
    expect(writer.isAlreadyCached("someHash")).toBe(false);
  });

  it("returns false when writeToMovie is false", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig({ dryRun: true }));
    (writer as unknown as { partialMovieDirectory: string }).partialMovieDirectory = "/tmp/partial";
    expect(writer.isAlreadyCached("someHash")).toBe(false);
  });
});

describe("SceneFileWriter — finishLastSection / nextSection", () => {
  it("finishLastSection removes an empty section", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig());
    // The autocreated section is empty
    writer.finishLastSection();
    expect(writer.sections).toHaveLength(0);
  });

  it("finishLastSection keeps a non-empty section", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig());
    writer.sections[0].partialMovieFiles.push("a.mp4");
    writer.finishLastSection();
    expect(writer.sections).toHaveLength(1);
  });

  it("nextSection creates a new section", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig());
    // Mark the first section as non-empty so it survives
    writer.sections[0].partialMovieFiles.push("a.mp4");
    writer.nextSection("intro", DefaultSectionType.NORMAL, false);
    expect(writer.sections).toHaveLength(2);
    expect(writer.sections[1].name).toBe("intro");
  });

  it("nextSection removes the previous empty section before adding", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig());
    // autocreated is still empty
    writer.nextSection("second", DefaultSectionType.NORMAL, false);
    // autocreated was empty so it should be gone
    expect(writer.sections).toHaveLength(1);
    expect(writer.sections[0].name).toBe("second");
  });
});

describe("SceneFileWriter — addAudioSegment", () => {
  it("initialises includesSound on first call", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig());
    expect(writer.includesSound).toBe(false);
    writer.addAudioSegment(AudioSegment.silent(1000));
    expect(writer.includesSound).toBe(true);
  });

  it("throws when time is negative", () => {
    const writer = new SceneFileWriter(makeRenderer(), "TestScene", makeConfig());
    expect(() => {
      writer.addAudioSegment(AudioSegment.silent(500), -1);
    }).toThrow("Adding sound at timestamp < 0");
  });
});
