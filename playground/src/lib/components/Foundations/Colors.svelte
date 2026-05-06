<script lang="ts">
	const surfaceColors = [
		{ name: '--bg-0', hex: '#0a0a0f', desc: 'app' },
		{ name: '--bg-1', hex: '#11111a', desc: 'pane' },
		{ name: '--bg-2', hex: '#181822', desc: 'header / hover' },
		{ name: '--bg-3', hex: '#1f1f2c', desc: 'raised' },
		{ name: '--line', hex: '#252533', desc: 'border' },
		{ name: '--line-strong', hex: '#34344a', desc: 'button border' }
	];

	const inkColors = [
		{ name: '--ink-0', hex: '#e8e8f0', desc: 'primary' },
		{ name: '--ink-1', hex: '#b4b4c4', desc: 'body' },
		{ name: '--ink-2', hex: '#6f6f85', desc: 'meta / dim' },
		{ name: '--ink-3', hex: '#4a4a5e', desc: 'disabled / grip' }
	];

	const accentColors = [
		{ name: '--accent', hex: '#a78bfa', desc: 'primary accent' },
		{ name: '--accent-bright', hex: '#c4b5fd', desc: 'text on accent bg' },
		{ name: '--accent-dim', hex: '#7c3aed', desc: 'primary button' },
		{ name: '--accent-soft', hex: 'rgba(167, 139, 250, 0.12)', desc: 'selected row bg' },
		{ name: '--warn', hex: '#f59e0b', desc: 'unbound enum' },
		{ name: '--ok', hex: '#34d399', desc: 'valid status' }
	];
</script>

<div class="ds-section">
	<h1>Color</h1>
	<p class="lead">
		All colors are tokens. Every component reads from CSS custom properties; nothing is hex-coded
		inline.
	</p>

	<h2>Surfaces</h2>
	<div class="swatch-grid">
		{#each surfaceColors as color}
			<div class="swatch">
				<div class="chip" style="background: var({color.name})"></div>
				<div class="meta">
					<div class="name">{color.name}</div>
					<div class="hex">{color.hex} · {color.desc}</div>
				</div>
			</div>
		{/each}
	</div>

	<h2>Ink</h2>
	<div class="swatch-grid">
		{#each inkColors as color}
			<div class="swatch">
				<div class="chip" style="background: var({color.name})"></div>
				<div class="meta">
					<div class="name">{color.name}</div>
					<div class="hex">{color.hex} · {color.desc}</div>
				</div>
			</div>
		{/each}
	</div>

	<h2>Accent & States</h2>
	<div class="swatch-grid">
		{#each accentColors as color}
			<div class="swatch">
				<div class="chip" style="background: var({color.name})"></div>
				<div class="meta">
					<div class="name">{color.name}</div>
					<div class="hex">{color.hex} · {color.desc}</div>
				</div>
			</div>
		{/each}
	</div>

	<h2>Where each color is used</h2>
	<table class="props-table">
		<thead>
			<tr>
				<th>Token</th>
				<th>Used by</th>
				<th>Never used for</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td class="col-name">--accent</td>
				<td class="col-desc">
					selected row stripe, focused tab underline, accent indicator dots, focus ring
				</td>
				<td class="col-desc">large fills, body text, headings</td>
			</tr>
			<tr>
				<td class="col-name">--accent-dim</td>
				<td class="col-desc">primary button bg, hover state of accent</td>
				<td class="col-desc">borders</td>
			</tr>
			<tr>
				<td class="col-name">--accent-bright</td>
				<td class="col-desc">
					text on <code>--accent-soft</code> bg, syntax keywords, selected-subject name
				</td>
				<td class="col-desc">backgrounds</td>
			</tr>
			<tr>
				<td class="col-name">--accent-soft</td>
				<td class="col-desc">selected-row bg, +mod hover bg, focused enum chip</td>
				<td class="col-desc">solid surface</td>
			</tr>
			<tr>
				<td class="col-name">--warn</td>
				<td class="col-desc">unbound enum, mismatch row stripe, validation icon</td>
				<td class="col-desc">decorative</td>
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
		margin: 0 0 6px;
	}
	h2 {
		font-size: 18px;
		font-weight: 600;
		margin: 32px 0 12px;
	}
	.lead {
		font-size: 15px;
		color: var(--ink-1);
		margin-bottom: 24px;
	}
	.swatch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
		margin-bottom: 32px;
	}
	.swatch {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--bg-1);
	}
	.chip {
		width: 36px;
		height: 36px;
		border-radius: 5px;
		border: 1px solid var(--line-strong);
		flex-shrink: 0;
	}
	.meta {
		min-width: 0;
	}
	.name {
		font-family: 'JetBrains Mono', monospace;
		font-size: 11.5px;
		color: var(--ink-0);
	}
	.hex {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: var(--ink-2);
	}

	.props-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12.5px;
		margin-top: 16px;
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
	.props-table td.col-desc {
		color: var(--ink-1);
	}
	code {
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
		background: var(--bg-2);
		padding: 1px 5px;
		border-radius: 3px;
		color: var(--syn-keyword);
	}
</style>
