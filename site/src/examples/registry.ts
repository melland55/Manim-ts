import type { ComponentType } from "react";

export interface ExampleDef {
  id: string;
  className: string;
  description: string;
  is3D?: boolean;
  /**
   * Reference rendering from docs.manim.community, downloaded into
   * `site/public/manim-community/` for comparison (educational fair use).
   * `kind` drives whether the pane renders an <img> or a <video>.
   */
  reference: { kind: "image" | "video"; src: string };
  /** Python source (verbatim from Manim Community docs). */
  pythonSource: string;
  /** manim-ts source (the exact code the live canvas runs). */
  manimTsSource: string;
  /**
   * Live render component. Renders its own <canvas> and manages the Scene
   * lifecycle (start on mount, dispose on unmount). Omit to show the
   * fallback asset or a "coming soon" placeholder.
   */
  live?: ComponentType<Record<string, never>>;
  /** Fallback asset path (served from /public) if live is absent or fails. */
  fallbackAsset?: string;
}

export interface ExampleSection {
  id: string;
  title: string;
  examples: ExampleDef[];
}
