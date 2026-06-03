<script lang="ts">
	import { Table } from '@dxlbnl/ui';
	import FeatureMatrixCell, { type CellValue } from './FeatureMatrixCell.svelte';

	interface Feature {
		label: string;
		zod4mock: CellValue;
		zodmock: CellValue;
		faker: CellValue;
	}

	interface Props {
		features: Feature[];
	}

	let { features }: Props = $props();
</script>

<div class="wrap">
	<Table headers={['Feature', 'zod4-mock', 'zod-mock', 'faker']}>
		{#each features as f}
			<tr>
				<td class="label">{f.label}</td>
				<td class="cell"><FeatureMatrixCell value={f.zod4mock} /></td>
				<td class="cell"><FeatureMatrixCell value={f.zodmock} /></td>
				<td class="cell"><FeatureMatrixCell value={f.faker} /></td>
			</tr>
		{/each}
	</Table>
</div>

<style>
	.wrap {
		border: 1px solid var(--rule);
		border-radius: 8px;
		overflow: hidden;
	}
	.label {
		font-size: 13px;
	}
	.cell {
		text-align: center;
	}
</style>
