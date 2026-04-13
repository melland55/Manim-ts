import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "getting-started",
    {
      type: "category",
      label: "API Reference",
      collapsed: false,
      items: [
        {
          type: "category",
          label: "Core",
          items: [
            "api-reference/core/math",
            "api-reference/core/color",
            "api-reference/core/types",
            "api-reference/core/constants",
          ],
        },
        {
          type: "category",
          label: "Mobjects",
          items: [
            "api-reference/mobjects/mobject",
            "api-reference/mobjects/geometry",
            "api-reference/mobjects/vmobject",
            "api-reference/mobjects/svg",
            "api-reference/mobjects/three-d",
            "api-reference/mobjects/text",
            "api-reference/mobjects/graphing",
            "api-reference/mobjects/graph",
            "api-reference/mobjects/table",
            "api-reference/mobjects/matrix",
            "api-reference/mobjects/vector-field",
            "api-reference/mobjects/value-tracker",
          ],
        },
        {
          type: "category",
          label: "Animations",
          items: [
            "api-reference/animations/animation",
            "api-reference/animations/creation",
            "api-reference/animations/fading",
            "api-reference/animations/growing",
            "api-reference/animations/transform",
            "api-reference/animations/rotation",
            "api-reference/animations/movement",
            "api-reference/animations/indication",
            "api-reference/animations/composition",
            "api-reference/animations/updaters",
            "api-reference/animations/changing",
            "api-reference/animations/numbers",
            "api-reference/animations/specialized",
            "api-reference/animations/speed-modifier",
            "api-reference/animations/transform-matching-parts",
          ],
        },
        {
          type: "category",
          label: "Scenes & Camera",
          items: [
            "api-reference/scenes/scene",
            "api-reference/scenes/camera",
            "api-reference/scenes/renderer",
          ],
        },
        {
          type: "category",
          label: "Utilities",
          items: [
            "api-reference/utils/rate-functions",
            "api-reference/utils/bezier",
            "api-reference/utils/paths",
            "api-reference/utils/iterables",
            "api-reference/utils/space-ops",
            "api-reference/utils/config-ops",
            "api-reference/utils/file-ops",
            "api-reference/utils/tex",
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Guides",
      items: [
        "guides/architecture",
        "guides/conversion",
        "guides/browser-usage",
      ],
    },
  ],
};

export default sidebars;
