import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

const theme = create({
	base: 'dark',
	appBg: '#0a0a0f',
	appContentBg: '#0a0a0f',
	appBorderColor: '#252533',
	appBorderRadius: 8,
	fontBase: '"Inter", sans-serif',
	fontCode: '"JetBrains Mono", monospace',
	colorPrimary: '#a78bfa',
	colorSecondary: '#a78bfa',
	brandTitle: 'gen-bench',
	brandUrl: '/',
	brandTarget: '_self'
});

addons.setConfig({ theme });
