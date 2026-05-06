<script lang="ts">
</script>

<div class="ds-section">
	<h1>Spacing & layout</h1>
	<p class="lead">
		A 4px base. Inside dense rows, 4 / 6 / 8 are the only step values. Cards and dialogs use
		12 / 16 / 24.
	</p>

	<div class="ds-card">
		<div class="ds-card-body col">
			<div class="scale-row">
				<span class="name">space-1</span>
				<div class="bar" style="width: 4px"></div>
				<span class="px">4px</span>
			</div>
			<div class="scale-row">
				<span class="name">space-2</span>
				<div class="bar" style="width: 6px"></div>
				<span class="px">6px</span>
			</div>
			<div class="scale-row">
				<span class="name">space-3</span>
				<div class="bar" style="width: 8px"></div>
				<span class="px">8px</span>
			</div>
			<div class="scale-row">
				<span class="name">space-4</span>
				<div class="bar" style="width: 12px"></div>
				<span class="px">12px</span>
			</div>
			<div class="scale-row">
				<span class="name">space-5</span>
				<div class="bar" style="width: 16px"></div>
				<span class="px">16px</span>
			</div>
			<div class="scale-row">
				<span class="name">space-6</span>
				<div class="bar" style="width: 24px"></div>
				<span class="px">24px</span>
			</div>
			<div class="scale-row">
				<span class="name">space-7</span>
				<div class="bar" style="width: 32px"></div>
				<span class="px">32px</span>
			</div>
		</div>
	</div>

	<h2>Heights</h2>
	<table class="props-table">
		<thead>
			<tr>
				<th>Token</th>
				<th>Value</th>
				<th>Where</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td class="col-name">--row-h</td>
				<td class="col-default">28px</td>
				<td class="col-desc">property row, cardinality row, add-prop</td>
			</tr>
			<tr>
				<td class="col-name">topbar</td>
				<td class="col-default">40px</td>
				<td class="col-desc">app top bar</td>
			</tr>
			<tr>
				<td class="col-name">pane-head</td>
				<td class="col-default">32px</td>
				<td class="col-desc">pane header bar, output tabs</td>
			</tr>
			<tr>
				<td class="col-name">statusbar</td>
				<td class="col-default">24px</td>
				<td class="col-desc">app status bar</td>
			</tr>
			<tr>
				<td class="col-name">btn</td>
				<td class="col-default">26px</td>
				<td class="col-desc">all top-bar buttons</td>
			</tr>
			<tr>
				<td class="col-name">mod / add-mod</td>
				<td class="col-default">18px</td>
				<td class="col-desc">pills inside rows</td>
			</tr>
			<tr>
				<td class="col-name">input</td>
				<td class="col-default">22px</td>
				<td class="col-desc">left-rail inputs</td>
			</tr>
		</tbody>
	</table>

	<h2>App grid</h2>
	<pre class="ds-snippet">
┌────────────────────────────────────────────────┐
│ topbar         40px                            │
├────────┬───────────────────┬───────────────────┤
│ rail   │ builder pane      │ output pane       │
│ 264px  │ minmax(0, 1.05fr) │ minmax(0, 1fr)    │
│        │                   │                   │
├────────┴───────────────────┴───────────────────┤
│ statusbar      24px                            │
└────────────────────────────────────────────────┘</pre>
</div>

<style>
	.ds-section {
		padding: 20px;
		max-width: 1000px;
	}
	h1 {
		font-size: 28px;
		font-weight: 700;
		margin: 0 0 6px;
		letter-spacing: -0.02em;
	}
	h2 {
		font-size: 18px;
		font-weight: 600;
		margin: 32px 0 12px;
		letter-spacing: -0.01em;
	}
	.lead {
		font-size: 15px;
		color: var(--ink-1);
		max-width: 72ch;
		margin-bottom: 24px;
	}
	.ds-card {
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 8px;
		overflow: hidden;
		margin-bottom: 16px;
	}
	.ds-card-body {
		padding: 24px;
	}
	.ds-card-body.col {
		display: flex;
		flex-direction: column;
	}
	.scale-row {
		display: grid;
		grid-template-columns: 100px 1fr 80px;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
	}
	.name {
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		color: var(--ink-0);
	}
	.bar {
		height: 16px;
		border-radius: 3px;
		background: var(--accent-soft);
		border: 1px solid var(--accent-edge);
	}
	.px {
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		color: var(--ink-2);
		text-align: right;
	}
	.props-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12.5px;
	}
	.props-table th,
	.props-table td {
		text-align: left;
		padding: 8px 12px;
		border-bottom: 1px solid var(--line);
		vertical-align: top;
	}
	.props-table th {
		background: var(--bg-2);
		color: var(--ink-1);
		font-weight: 600;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.props-table .col-name {
		font-family: 'JetBrains Mono', monospace;
		color: var(--ink-0);
		font-size: 12px;
		white-space: nowrap;
	}
	.props-table .col-default {
		font-family: 'JetBrains Mono', monospace;
		color: var(--syn-number);
		font-size: 12px;
		white-space: nowrap;
	}
	.props-table td.col-desc {
		color: var(--ink-1);
	}
	.ds-snippet {
		margin: 0;
		padding: 14px 16px;
		background: var(--bg-0);
		border: 1px solid var(--line);
		border-radius: 6px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
		color: var(--ink-1);
		white-space: pre;
		overflow-x: auto;
	}
</style>
