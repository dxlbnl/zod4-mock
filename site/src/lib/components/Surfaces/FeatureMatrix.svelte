<script lang="ts">
	type CellValue = 'yes' | 'no' | 'partial' | 'na';

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

	const symbols: Record<CellValue, string> = {
		yes: '✓',
		no: '✗',
		partial: '~',
		na: '—'
	};

	const colors: Record<CellValue, string> = {
		yes: 'var(--success)',
		no: 'var(--danger)',
		partial: 'var(--warning)',
		na: 'var(--text-muted)'
	};
</script>

<div class="wrap">
	<table>
		<thead>
			<tr>
				<th class="feature-col">Feature</th>
				<th style="color:var(--lib-zod4mock)">zod4-mock</th>
				<th style="color:var(--lib-zodmock)">zod-mock</th>
				<th style="color:var(--lib-faker)">faker</th>
			</tr>
		</thead>
		<tbody>
			{#each features as f}
				<tr>
					<td class="t-small">{f.label}</td>
					{#each ['zod4mock', 'zodmock', 'faker'] as lib}
						<td class="cell">
							<span style="color:{colors[f[lib as keyof Feature] as CellValue]}">
								{symbols[f[lib as keyof Feature] as CellValue]}
							</span>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.wrap {
		overflow: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		padding: var(--space-2) var(--space-4);
		text-align: center;
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		font-weight: 600;
		background: var(--bg-raised);
	}
	th.feature-col {
		text-align: left;
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 10px;
		letter-spacing: 0.06em;
	}
	td {
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--border);
	}
	td.cell {
		text-align: center;
		font-size: 16px;
	}
	tr:last-child td {
		border-bottom: none;
	}
	tr:hover td {
		background: var(--bg-raised);
	}
</style>
