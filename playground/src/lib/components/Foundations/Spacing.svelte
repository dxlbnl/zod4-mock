<script lang="ts">
</script>

<div class="ds-section">
	<h1 class="t-heading-lg">Spacing & layout</h1>
	<p class="lead t-body">
		A 4px base. Inside dense rows, 4 / 6 / 8 are the only step values. Cards and dialogs use
		12 / 16 / 24.
	</p>

	<div class="ds-card">
		<div class="ds-card-body col">
			<div class="scale-row">
				<span class="name t-code-sm">var(--space-1)</span>
				<div class="bar" style="width: var(--space-1)"></div>
				<span class="px t-number">4px</span>
			</div>
			<div class="scale-row">
				<span class="name t-code-sm">var(--space-2)</span>
				<div class="bar" style="width: var(--space-2)"></div>
				<span class="px t-number">6px</span>
			</div>
			<div class="scale-row">
				<span class="name t-code-sm">var(--space-3)</span>
				<div class="bar" style="width: var(--space-3)"></div>
				<span class="px t-number">8px</span>
			</div>
			<div class="scale-row">
				<span class="name t-code-sm">var(--space-4)</span>
				<div class="bar" style="width: var(--space-4)"></div>
				<span class="px t-number">12px</span>
			</div>
			<div class="scale-row">
				<span class="name t-code-sm">var(--space-5)</span>
				<div class="bar" style="width: var(--space-5)"></div>
				<span class="px t-number">16px</span>
			</div>
			<div class="scale-row">
				<span class="name t-code-sm">var(--space-6)</span>
				<div class="bar" style="width: var(--space-6)"></div>
				<span class="px t-number">24px</span>
			</div>
			<div class="scale-row">
				<span class="name t-code-sm">var(--space-7)</span>
				<div class="bar" style="width: var(--space-7)"></div>
				<span class="px t-number">32px</span>
			</div>
		</div>
	</div>

	<h2 class="t-heading-md">Heights</h2>
	<table class="props-table">
		<thead>
			<tr>
				<th class="t-eyebrow">Token</th>
				<th class="t-eyebrow">Value</th>
				<th class="t-eyebrow">Where</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td class="col-name t-code-sm">--h-row</td>
				<td class="col-default t-number">28px</td>
				<td class="col-desc t-small">property row, cardinality row, add-prop</td>
			</tr>
			<tr>
				<td class="col-name t-code-sm">--h-topbar</td>
				<td class="col-default t-number">40px</td>
				<td class="col-desc t-small">app top bar</td>
			</tr>
			<tr>
				<td class="col-name t-code-sm">--h-pane-head</td>
				<td class="col-default t-number">32px</td>
				<td class="col-desc t-small">pane header bar, output tabs</td>
			</tr>
			<tr>
				<td class="col-name t-code-sm">--h-statusbar</td>
				<td class="col-default t-number">24px</td>
				<td class="col-desc t-small">app status bar</td>
			</tr>
			<tr>
				<td class="col-name t-code-sm">--h-btn</td>
				<td class="col-default t-number">26px</td>
				<td class="col-desc t-small">all top-bar buttons</td>
			</tr>
			<tr>
				<td class="col-name t-code-sm">--h-mod</td>
				<td class="col-default t-number">18px</td>
				<td class="col-desc t-small">pills inside rows</td>
			</tr>
			<tr>
				<td class="col-name t-code-sm">--h-input</td>
				<td class="col-default t-number">22px</td>
				<td class="col-desc t-small">left-rail inputs</td>
			</tr>
		</tbody>
	</table>

	<h2 class="t-heading-md">App grid</h2>
	<pre class="ds-snippet t-code-sm">
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
