import { create } from "storybook/theming";

export default create({
  base: "dark",

  // UI
  appBg: "#0a0a0f",
  appContentBg: "#0a0a0f",
  appBorderColor: "#252533",
  appBorderRadius: 8,

  // Typography
  fontBase: '"Inter", sans-serif',
  fontCode: '"JetBrains Mono", monospace',

  // Colors
  colorPrimary: "#a78bfa",
  colorSecondary: "#a78bfa",

  // Branding
  brandTitle: "ZodMock Playground",
  brandUrl: "/",
  brandTarget: "_self",
});
