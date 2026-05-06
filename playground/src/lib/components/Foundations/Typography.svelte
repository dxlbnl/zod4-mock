<script lang="ts">
</script>

<div class="ds-section">
	<h1 class="t-heading-lg">Typography</h1>
	<p class="lead t-body">
		Two typefaces. Inter is for UI chrome; JetBrains Mono is for everything that represents
		code or data. Never mix them within the same word.
	</p>

	<h2 class="t-heading-md">Scale</h2>
	<div class="ds-card">
		<div class="ds-card-body col">
			<div class="type-row">
				<span class="label t-code-sm">heading-lg</span>
				<span class="t-heading-lg">
					Make it real
				</span>
				<span class="meta t-code-sm">28 / 700 / -0.02</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">heading-md</span>
				<span class="t-heading-md">Section heading</span>
				<span class="meta t-code-sm">18 / 600</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">title</span>
				<span class="t-title">Pane title</span>
				<span class="meta t-code-sm">13 / 600</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">body</span>
				<span class="t-body">Body text in panes and dialogs.</span>
				<span class="meta t-code-sm">13 / 400</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">small</span>
				<span class="t-small">Tab labels, button labels, helper text.</span>
				<span class="meta t-code-sm">12 / 400</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">tiny</span>
				<span class="t-tiny" style="color: var(--ink-2);">Meta, file paths in headers</span>
				<span class="meta t-code-sm">11 / 400</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">eyebrow</span>
				<span class="t-eyebrow" style="color: var(--ink-2);">
					Section
				</span>
				<span class="meta t-code-sm">10 / 600 caps</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">code</span>
				<span class="t-code">z.string().min(2)</span>
				<span class="meta t-code-sm">mono 12</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">code-tight</span>
				<span class="t-code-tight">.optional()</span>
				<span class="meta t-code-sm">mono 10.5</span>
			</div>
			<div class="type-row">
				<span class="label t-code-sm">number</span>
				<span class="t-number">
					12,345
				</span>
				<span class="meta t-code-sm">mono · tabular-nums</span>
			</div>
		</div>
	</div>

	<h2 class="t-heading-md">Rules</h2>
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
	}
	.type-row .meta {
		color: var(--ink-2);
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
		background: var(--bg-2);
		padding: 1px 5px;
		border-radius: 3px;
		color: var(--syn-keyword);
	}
</style>
