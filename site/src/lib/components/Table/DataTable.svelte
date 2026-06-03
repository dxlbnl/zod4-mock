<script lang="ts" generics="T extends Record<string, unknown>">
	interface Props {
		rows: T[];
		columns: { key: keyof T; label: string }[];
		filter?: string;
	}

	let { rows, columns, filter = '' }: Props = $props();

	type SortDir = 'asc' | 'desc' | null;
	let sortKey = $state<keyof T | null>(null);
	let sortDir = $state<SortDir>(null);

	function toggleSort(key: keyof T) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc';
			if (sortDir === null) sortKey = null;
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	const filtered = $derived(
		filter
			? rows.filter((r) =>
					columns.some((c) => String(r[c.key]).toLowerCase().includes(filter.toLowerCase()))
			  )
			: rows
	);

	const sorted = $derived(
		sortKey && sortDir
			? [...filtered].sort((a, b) => {
					const av = a[sortKey!];
					const bv = b[sortKey!];
					const cmp = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
					return sortDir === 'asc' ? cmp : -cmp;
			  })
			: filtered
	);
</script>

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				{#each columns as col}
					<th>
						<button type="button" onclick={() => toggleSort(col.key)}>
							<span>{col.label}</span>
							{#if sortKey === col.key}
								<span class="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>
							{:else}
								<span class="sort-icon muted">↕</span>
							{/if}
						</button>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sorted as row}
				<tr>
					{#each columns as col}
						<td class="t-small">
							{#if row[col.key] instanceof Date}
								{(row[col.key] as Date).toLocaleDateString()}
							{:else}
								{row[col.key]}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow: auto;
		max-height: 600px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	thead {
		position: sticky;
		top: 0;
		background: var(--bg-raised);
		z-index: 1;
	}
	th {
		padding: 0;
		text-align: left;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	th button {
		display: flex;
		align-items: center;
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: none;
		border: none;
		font: inherit;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		cursor: pointer;
		user-select: none;
	}
	th button:hover {
		color: var(--text-primary);
	}
	.sort-icon {
		margin-left: 4px;
		font-size: 10px;
	}
	.muted {
		opacity: 0.3;
	}
	td {
		padding: var(--space-1) var(--space-3);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	tr:last-child td {
		border-bottom: none;
	}
	tr:hover td {
		background: var(--bg-raised);
	}
</style>
