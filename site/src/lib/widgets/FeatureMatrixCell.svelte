<script lang="ts" module>
	export type CellValue = 'yes' | 'no' | 'partial' | 'na';
</script>

<script lang="ts">
	interface Props {
		value: CellValue;
	}

	let { value }: Props = $props();

	const symbols: Record<CellValue, string> = {
		yes: '✓',
		no: '✗',
		partial: '~',
		na: '—'
	};

	const colors: Record<CellValue, string> = {
		yes: 'var(--ok)',
		no: 'var(--danger)',
		partial: 'var(--amber)',
		na: 'var(--ink-faint)'
	};
</script>

<span class="cell" style="color:{colors[value]}">{symbols[value]}</span>

<style>
	.cell {
		display: inline-block;
		font-size: 16px;
		text-align: center;
		font-family: var(--mono);
	}
</style>
