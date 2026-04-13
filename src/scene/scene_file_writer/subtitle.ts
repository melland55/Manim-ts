/**
 * Subtitle — simple SRT subtitle data type and composer.
 *
 * Replaces Python's `srt` library usage in SceneFileWriter.
 * Only the subset used by Manim is implemented.
 *
 * Python equivalents:
 *   srt.Subtitle  →  Subtitle interface
 *   srt.compose() →  composeSrt()
 */

// ─── Subtitle ─────────────────────────────────────────────────────────────────

/** Represents one SRT subtitle entry. */
export interface Subtitle {
  /** 1-based sequence index. */
  index: number;
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** Subtitle text content. */
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a time in seconds as SRT timestamp `HH:MM:SS,mmm`.
 */
function formatSrtTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hr = Math.floor(totalMin / 60);

  return (
    String(hr).padStart(2, "0") +
    ":" +
    String(min).padStart(2, "0") +
    ":" +
    String(sec).padStart(2, "0") +
    "," +
    String(ms).padStart(3, "0")
  );
}

// ─── Composer ────────────────────────────────────────────────────────────────

/**
 * Compose an array of Subtitle entries into SRT format text.
 * Python: `srt.compose(subtitles)`
 */
export function composeSrt(subtitles: Subtitle[]): string {
  return subtitles
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(
      (s) =>
        `${s.index}\n` +
        `${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n` +
        `${s.content}\n`,
    )
    .join("\n");
}
