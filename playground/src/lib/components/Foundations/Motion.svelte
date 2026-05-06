<script lang="ts">
</script>

<div class="ds-section">
	<h1>Motion</h1>
	<p class="rule-text">
		Movement is purely functional — never decorative. Hover/active states are instant. The
		only animated transitions are: accordion chevron rotation, sheet fade-in, and
		tab-underline slide.
	</p>
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
				<td class="col-name">--ease-quick</td>
				<td class="col-default">120ms ease-out</td>
				<td class="col-desc">hover states, small toggles</td>
			</tr>
			<tr>
				<td class="col-name">--ease-deliberate</td>
				<td class="col-default">150ms ease-in-out</td>
				<td class="col-desc">panel slides, menu openings</td>
			</tr>
		</tbody>
	</table>
</div>

<style>
	.ds-section {
		padding: 20px;
		max-width: 1000px;
	}
	h1 {
		font-size: 28px;
		font-weight: 700;
		margin: 0 0 16px;
		letter-spacing: -0.02em;
	}
	.rule-text {
		color: var(--ink-1);
		font-size: 14px;
		margin-bottom: 24px;
		max-width: 72ch;
		line-height: 1.5;
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
</style>
