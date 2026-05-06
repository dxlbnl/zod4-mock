import { defineConfig, mergeConfig } from 'vitest/config';
import { sveltekit } from "@sveltejs/kit/vite";
import { playwright } from '@vitest/browser-playwright';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ['vitest'],
    include: [
      '@storybook/addon-vitest',
      '@storybook/sveltekit',
      '@storybook/addon-svelte-csf',
      '@storybook/addon-themes',
      'storybook/theming',
    ],
  },
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    retry: 1,
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
            storybookScript: 'npm run storybook -- --no-open',
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
            provider: playwright(),
          },
          setupFiles: ['./.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});

