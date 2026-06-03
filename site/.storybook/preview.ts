import type { Preview } from '@storybook/sveltekit';
import { withThemeByClassName } from '@storybook/addon-themes';
import theme from './theme';
import '../src/lib/styles/app.css';

const preview: Preview = {
	parameters: {
		docs: { theme },
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		},
		backgrounds: {
			default: 'dark',
			values: [
				{ name: 'dark', value: '#0a0a0f' },
				{ name: 'light', value: '#f7f7fa' }
			]
		},
		a11y: { test: 'todo' },
		options: {
			storySort: {
				order: [
					'Introduction',
					'Foundations',
					['Color', 'Typography', 'Spacing'],
					'Primitives',
					['Button', 'Input', 'RangeSlider', 'SegmentedControl'],
					'Bench',
					['BenchChart', 'MetricBadge', 'WinnerCallout', 'LibraryLegend'],
					'Showcase',
					['CodePanel', 'JsonTree', 'RelationCallout'],
					'Table',
					['DataTable', 'TimingBadge'],
					'Surfaces',
					['FeatureMatrix', 'SummaryCard'],
					'*'
				]
			}
		}
	},
	decorators: [
		withThemeByClassName({
			themes: { light: 'light', dark: 'dark' },
			defaultTheme: 'dark'
		})
	]
};

export default preview;
