<script lang="ts">
</script>

<div class="ds-section">
	<h1 class="t-heading-lg">Radius & shadows</h1>
	<div class="grid-3">
		<div class="ds-card">
			<div class="ds-card-head">
				<span class="label t-title">--radius-sm</span><span class="meta t-code-sm">3px</span>
			</div>
			<div class="ds-card-body center">
				<div
					style="width: 60px; height: 60px; background: var(--bg-3); border: 1px solid var(--line-strong); border-radius: var(--radius-sm);"
				></div>
			</div>
			<pre class="ds-snippet">pills · inputs · rows</pre>
		</div>
		<div class="ds-card">
			<div class="ds-card-head">
				<span class="label t-title">--radius-md</span><span class="meta t-code-sm">5px</span>
			</div>
			<div class="ds-card-body center">
				<div
					style="width: 60px; height: 60px; background: var(--bg-3); border: 1px solid var(--line-strong); border-radius: var(--radius-md);"
				></div>
			</div>
			<pre class="ds-snippet">buttons · seg control · float-menu</pre>
		</div>
		<div class="ds-card">
			<div class="ds-card-head">
				<span class="label t-title">--radius-lg</span><span class="meta t-code-sm">8px</span>
			</div>
			<div class="ds-card-body center">
				<div
					style="width: 60px; height: 60px; background: var(--bg-3); border: 1px solid var(--line-strong); border-radius: var(--radius-lg);"
				></div>
			</div>
			<pre class="ds-snippet">sheets · cards</pre>
		</div>
	</div>

	<h2 class="t-heading-md">Shadow</h2>
	<p class="rule-text t-body">
		One shadow only — for floating menus and modal sheets. Inline elements never carry
		shadow.
	</p>
	<pre class="ds-snippet t-code-sm">
--shadow-pop:   0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02);
--shadow-modal: 0 24px 64px rgba(0,0,0,0.60);</pre>
</div>

<style>
	.ds-section {
		padding: 20px;
		max-width: 1000px;
	}
	h1 {
		font-size: 28px;
		font-weight: 700;
		margin: 0 0 24px;
		letter-spacing: -0.02em;
	}
	h2 {
		font-size: 18px;
		font-weight: 600;
		margin: 32px 0 12px;
		letter-spacing: -0.01em;
	}
	p {
		color: var(--ink-1);
		font-size: 14px;
		margin-bottom: 16px;
	}
	.grid-3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 16px;
	}
	.ds-card {
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 8px;
		overflow: hidden;
	}
	.ds-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		border-bottom: 1px solid var(--line);
		font-size: 12px;
		background: var(--bg-2);
	}
	.ds-card-head .label {
		font-weight: 600;
		color: var(--ink-0);
	}
	.ds-card-head .meta {
		color: var(--ink-2);
		font-family: 'JetBrains Mono', monospace;
	}
	.ds-card-body.center {
		padding: 32px;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.ds-snippet {
		margin: 0;
		padding: 10px 14px;
		background: var(--bg-0);
		border-top: 1px solid var(--line);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		color: var(--ink-2);
		white-space: pre-wrap;
	}
</style>
