import type { StorybookConfig } from "@storybook/sveltekit";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|ts|svelte)"],
  addons: [
    "@storybook/addon-svelte-csf",
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-themes",
  ],
  framework: "@storybook/sveltekit",
  viteFinal: (config) => ({
    ...config,
    build: {
      ...config.build,
      // @ts-ignore - Rolldown options for Vite 8 compatibility
      rolldownOptions: {
        output: {
          strictExecutionOrder: true,
        },
      },
    },
    optimizeDeps: {
      exclude: ["@storybook/svelte"],
    },
  }),
};
export default config;
