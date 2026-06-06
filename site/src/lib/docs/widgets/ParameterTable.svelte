<script lang="ts">
	// B100-R4 — <ParameterTable> typed parameter rows.
	// Renders an accessible <table> with column headers Name / Type /
	// Default / Description. Missing default renders an em-dash so screen
	// readers don't skip an empty <td>.

	export type ParameterRow = {
		name: string;
		type: string;
		default?: string;
		description: string;
	};

	interface Props {
		rows: ReadonlyArray<ParameterRow>;
	}

	let { rows }: Props = $props();
</script>

<table class="param-table">
	<thead>
		<tr>
			<th scope="col">Name</th>
			<th scope="col">Type</th>
			<th scope="col">Default</th>
			<th scope="col">Description</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row}
			<tr>
				<td><code>{row.name}</code></td>
				<td><code>{row.type}</code></td>
				<td>{row.default ?? '—'}</td>
				<td>{row.description}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.param-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	th,
	td {
		text-align: left;
		padding: var(--u) 12px;
		border-bottom: 1px solid var(--rule);
	}
	th {
		color: var(--ink-dim);
		font-weight: 500;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--bg-rail);
	}
	td {
		color: var(--ink-dim);
	}
	td code {
		font-family: var(--mono);
		color: var(--amber);
		font-size: 12px;
		background: var(--bg-elev);
		padding: 2px 5px;
		border-radius: 4px;
	}
</style>
