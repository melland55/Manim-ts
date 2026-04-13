import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "manim-ts",
  tagline: "TypeScript port of 3Blue1Brown's Manim — mathematical animations in the browser",
  favicon: "img/favicon.ico",

  url: "https://manim-ts.dev",
  baseUrl: "/",

  organizationName: "manim-ts",
  projectName: "manim-ts",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/manim-ts/manim-ts/tree/main/docs/",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "manim-ts",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs",
        },
        {
          href: "https://github.com/manim-ts/manim-ts",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting Started", to: "/docs/getting-started" },
            { label: "API Reference", to: "/docs/api-reference/core/math" },
            { label: "Guides", to: "/docs/guides/architecture" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "GitHub", href: "https://github.com/manim-ts/manim-ts" },
            { label: "Manim Community", href: "https://www.manim.community/" },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} manim-ts contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["python", "bash"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
