<script lang="ts">
</script>

<div class="ds-section">
	<h1>Typography</h1>
	<p class="lead">
		Two typefaces. Inter is for UI chrome; JetBrains Mono is for everything that represents
		code or data. Never mix them within the same word.
	</p>

	<h2>Scale</h2>
	<div class="ds-card">
		<div class="ds-card-body col">
			<div class="type-row">
				<span class="label">heading-lg</span>
				<span style="font-family: Inter; font-size: 28px; font-weight: 700; letter-spacing: -0.02em;">
					Make it real
				</span>
				<span class="meta">28 / 700 / -0.02</span>
			</div>
			<div class="type-row">
				<span class="label">heading-md</span>
				<span style="font-family: Inter; font-size: 18px; font-weight: 600;">Section heading</span>
				<span class="meta">18 / 600</span>
			</div>
			<div class="type-row">
				<span class="label">title</span>
				<span style="font-family: Inter; font-size: 13px; font-weight: 600;">Pane title</span>
				<span class="meta">13 / 600</span>
			</div>
			<div class="type-row">
				<span class="label">body</span>
				<span style="font-family: Inter; font-size: 13px;">Body text in panes and dialogs.</span>
				<span class="meta">13 / 400</span>
			</div>
			<div class="type-row">
				<span class="label">small</span>
				<span style="font-family: Inter; font-size: 12px;">Tab labels, button labels, helper text.</span>
				<span class="meta">12 / 400</span>
			</div>
			<div class="type-row">
				<span class="label">tiny</span>
				<span style="font-family: Inter; font-size: 11px; color: var(--ink-2);">Meta, file paths in headers</span>
				<span class="meta">11 / 400</span>
			</div>
			<div class="type-row">
				<span class="label">eyebrow</span>
				<span style="font-family: Inter; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-2);">
					Section
				</span>
				<span class="meta">10 / 600 caps</span>
			</div>
			<div class="type-row">
				<span class="label">code</span>
				<span style="font-family: 'JetBrains Mono', monospace; font-size: 12px;">z.string().min(2)</span>
				<span class="meta">mono 12</span>
			</div>
			<div class="type-row">
				<span class="label">code-tight</span>
				<span style="font-family: 'JetBrains Mono', monospace; font-size: 10.5px;">.optional()</span>
				<span class="meta">mono 10.5</span>
			</div>
			<div class="type-row">
				<span class="label">number</span>
				<span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-variant-numeric: tabular-nums;">
					12,345
				</span>
				<span class="meta">mono · tabular-nums</span>
			</div>
		</div>
	</div>

	<h2>Rules</h2>
	<ul class="rule-list">
		<li>
			<b>Mono</b> = anything that <i>is</i> code or could be typed: keys, types, modifier
			names, modifier values, JSON, file names, kbd hints, counts, version strings.
		</li>
		<li>
			<b>Sans</b> = chrome that describes UI: section labels, button labels, body copy,
			headings.
		</li>
		<li>Never use mono for paragraph text; never use sans inside a code block.</li>
		<li>
			Numbers shown in tables or status bars use
			<code>font-variant-numeric: tabular-nums</code>.
		</li>
	</ul>
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
		padding: 0 24px;
	}
	.ds-card-body.col {
		display: flex;
		flex-direction: column;
	}
	.type-row {
		display: grid;
		grid-template-columns: 120px 1fr 110px;
		align-items: baseline;
		gap: 16px;
		padding: 12px 0;
		border-bottom: 1px solid var(--line);
	}
	.type-row:last-child {
		border-bottom: 0;
	}
	.type-row .label {
		color: var(--ink-2);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
	}
	.type-row .meta {
		color: var(--ink-2);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		text-align: right;
	}
	.rule-list {
		padding-left: 18px;
	}
	.rule-list li {
		margin-bottom: 6px;
		color: var(--ink-1);
		font-size: 14px;
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
