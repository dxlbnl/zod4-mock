import type { StorybookConfig } from '@storybook/sveltekit';
import { dirname, resolve } from 'path';

const VIRTUAL_MODULE_PREFIX = 'virtual-module:';

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(js|ts|svelte)'],
	addons: [
		'@storybook/addon-svelte-csf',
		'@chromatic-com/storybook',
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs',
		'@storybook/addon-themes'
	],
	framework: '@storybook/sveltekit',
	viteFinal: (config) => ({
		...config,
		build: {
			...config.build,
			// @ts-ignore - Rolldown options for Vite 8 compatibility
			rolldownOptions: {
				output: { strictExecutionOrder: true }
			}
		},
		optimizeDeps: {
			...config.optimizeDeps,
			rolldownOptions: {
				...config.optimizeDeps?.rolldownOptions,
				plugins: [
					...((config.optimizeDeps?.rolldownOptions?.plugins as unknown[]) ?? []),
					{
						name: 'storybook:svelte-dep-scan-resolve',
						resolveId(source: string, importer: string | undefined) {
							if (!source.endsWith('.svelte') || !importer || !source.startsWith('.')) return;
							if (importer.startsWith(VIRTUAL_MODULE_PREFIX)) {
								const realPath = importer
									.slice(VIRTUAL_MODULE_PREFIX.length)
									.replace(/\?.*$/, '');
								return { id: resolve(dirname(realPath), source), external: true };
							}
						}
					}
				]
			}
		}
	})
};

export default config;
