import type { Preview } from "@storybook/sveltekit";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import theme from "./theme";
import "../src/lib/styles/app.css";

const preview: Preview = {
  parameters: {
    docs: { theme },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "phosphor",
      values: [
        { name: "phosphor", value: "#0b0d0c" },
        { name: "paper", value: "#efece4" },
      ],
    },
    a11y: { test: "todo" },
    options: {
      storySort: {
        order: ["Introduction", "B95", "Widgets", "Bench", "Showcase", "Docs", "Primitives", "*"],
      },
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: { phosphor: "phosphor", paper: "paper" },
      defaultTheme: "phosphor",
      attributeName: "data-palette",
    }),
  ],
};

export default preview;
