/**
 * TimelineControls — minimal drop-in DOM widget for play/pause/scrub.
 * Not part of Python Manim.
 *
 * Usage:
 *   const scene = new MyScene({ playback: true });
 *   await scene.render();
 *   const controls = new TimelineControls(scene.playback, container);
 *
 * Or: pass { controls: true } to Scene options (wires up automatically
 * if a canvas was provided).
 */

import type { Timeline } from "./timeline.js";

export interface TimelineControlsOptions {
  /** Auto-play when constructed. */
  autoPlay?: boolean;
  /** Show speed selector. Default true. */
  showSpeed?: boolean;
  /** Show time readout. Default true. */
  showTime?: boolean;
  /** Extra CSS class on the root element. */
  className?: string;
}

export class TimelineControls {
  private _timeline: Timeline;
  private _root: HTMLElement;
  private _playBtn!: HTMLButtonElement;
  private _scrubber!: HTMLInputElement;
  private _timeLabel!: HTMLSpanElement;
  private _speedSelect?: HTMLSelectElement;
  private _unsubscribe: Array<() => void> = [];
  private _scrubbing = false;

  constructor(
    timeline: Timeline,
    container: HTMLElement,
    options: TimelineControlsOptions = {},
  ) {
    this._timeline = timeline;
    this._root = this._buildDOM(options);
    container.appendChild(this._root);
    this._wire();
    if (options.autoPlay) timeline.play();
    this._refresh();
  }

  destroy(): void {
    for (const off of this._unsubscribe) off();
    this._unsubscribe = [];
    this._root.remove();
  }

  get element(): HTMLElement {
    return this._root;
  }

  // ─── Build ────────────────────────────────────────────────

  private _buildDOM(opts: TimelineControlsOptions): HTMLElement {
    const root = document.createElement("div");
    root.className = "manim-ts-controls" + (opts.className ? " " + opts.className : "");
    root.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "padding:8px 12px",
      "background:rgba(10,10,26,0.9)",
      "color:#e0e0ec",
      "border-radius:6px",
      "font:13px system-ui,-apple-system,Segoe UI,sans-serif",
      "user-select:none",
    ].join(";");

    // Play/pause button
    this._playBtn = document.createElement("button");
    this._playBtn.textContent = "▶";
    this._playBtn.setAttribute("aria-label", "Play");
    this._playBtn.style.cssText = [
      "background:#58c4dd",
      "color:#0a0a1a",
      "border:none",
      "border-radius:4px",
      "width:32px",
      "height:28px",
      "font-size:14px",
      "cursor:pointer",
      "font-weight:600",
    ].join(";");
    root.appendChild(this._playBtn);

    // Scrubber
    this._scrubber = document.createElement("input");
    this._scrubber.type = "range";
    this._scrubber.min = "0";
    this._scrubber.max = "1000";
    this._scrubber.value = "0";
    this._scrubber.step = "1";
    this._scrubber.style.cssText = "flex:1;min-width:100px;accent-color:#58c4dd;";
    root.appendChild(this._scrubber);

    // Time readout
    if (opts.showTime !== false) {
      this._timeLabel = document.createElement("span");
      this._timeLabel.textContent = "0:00 / 0:00";
      this._timeLabel.style.cssText =
        "font-variant-numeric:tabular-nums;opacity:0.8;min-width:80px;text-align:right;";
      root.appendChild(this._timeLabel);
    } else {
      this._timeLabel = document.createElement("span");
    }

    // Speed selector
    if (opts.showSpeed !== false) {
      this._speedSelect = document.createElement("select");
      for (const s of [0.25, 0.5, 1, 1.5, 2, 4]) {
        const opt = document.createElement("option");
        opt.value = String(s);
        opt.textContent = s + "×";
        if (s === 1) opt.selected = true;
        this._speedSelect.appendChild(opt);
      }
      this._speedSelect.style.cssText = [
        "background:#1a1a2e",
        "color:#e0e0ec",
        "border:1px solid #2a2a3e",
        "border-radius:4px",
        "padding:2px 4px",
        "cursor:pointer",
      ].join(";");
      root.appendChild(this._speedSelect);
    }

    return root;
  }

  // ─── Wire up ──────────────────────────────────────────────

  private _wire(): void {
    this._playBtn.addEventListener("click", () => {
      this._timeline.toggle();
    });

    this._scrubber.addEventListener("input", () => {
      this._scrubbing = true;
      const ratio = Number(this._scrubber.value) / 1000;
      const t = ratio * this._timeline.duration;
      this._timeline.seek(t);
    });

    this._scrubber.addEventListener("change", () => {
      this._scrubbing = false;
    });

    if (this._speedSelect) {
      this._speedSelect.addEventListener("change", () => {
        this._timeline.setSpeed(Number(this._speedSelect!.value));
      });
    }

    // Subscribe to timeline events
    for (const evt of ["tick", "seek", "play", "pause", "resume", "stop", "ended", "record"] as const) {
      this._unsubscribe.push(
        this._timeline.on(evt, () => this._refresh()),
      );
    }
  }

  // ─── Refresh ──────────────────────────────────────────────

  private _refresh(): void {
    const dur = this._timeline.duration;
    const t = this._timeline.currentTime;

    // Scrubber
    if (!this._scrubbing) {
      const ratio = dur > 0 ? t / dur : 0;
      this._scrubber.value = String(Math.round(ratio * 1000));
    }

    // Play button
    const playing = this._timeline.state === "playing";
    this._playBtn.textContent = playing ? "❚❚" : "▶";
    this._playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");

    // Time label
    this._timeLabel.textContent = `${formatTime(t)} / ${formatTime(dur)}`;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
