<script lang="ts">
	const syntaxColors = [
		{ name: '--syn-keyword', hex: '#c4b5fd' },
		{ name: '--syn-type', hex: '#93c5fd' },
		{ name: '--syn-string', hex: '#86efac' },
		{ name: '--syn-number', hex: '#fca5a5' },
		{ name: '--syn-comment', hex: '#5e5e74' },
		{ name: '--syn-fn', hex: '#fde68a' },
		{ name: '--syn-punct', hex: '#8484a0' }
	];
</script>

<div class="ds-section">
	<h1>Syntax Colors</h1>
	<p class="lead">Tokens used for code highlighting and schema metadata.</p>

	<div class="swatch-grid">
		{#each syntaxColors as color}
			<div class="swatch">
				<div class="chip" style="background: var({color.name})"></div>
				<div class="meta">
					<div class="name">{color.name}</div>
					<div class="hex">{color.hex}</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="ds-card">
		<div class="ds-card-head"><span class="label">Preview</span></div>
		<div class="ds-card-body col">
			<pre><code><span style="color: var(--syn-comment)">// User subject</span>
<span style="color: var(--syn-keyword)">const</span> User = <span style="color: var(--syn-fn)">defineSubjectType</span><span style="color: var(--syn-punct)">(</span><span style="color: var(--syn-string)">"User"</span><span style="color: var(--syn-punct)">,</span>
  z<span style="color: var(--syn-punct)">.</span><span style="color: var(--syn-fn)">object</span><span style="color: var(--syn-punct)">(</span><span style="color: var(--syn-punct)">&#123;</span>
    id<span style="color: var(--syn-punct)">:</span> z<span style="color: var(--syn-punct)">.</span><span style="color: var(--syn-fn)">uuid</span><span style="color: var(--syn-punct)">(</span><span style="color: var(--syn-punct)">)</span><span style="color: var(--syn-punct)">,</span>
    age<span style="color: var(--syn-punct)">:</span> z<span style="color: var(--syn-punct)">.</span><span style="color: var(--syn-fn)">number</span><span style="color: var(--syn-punct)">(</span><span style="color: var(--syn-punct)">)</span><span style="color: var(--syn-punct)">.</span><span style="color: var(--syn-fn)">int</span><span style="color: var(--syn-punct)">(</span><span style="color: var(--syn-punct)">)</span><span style="color: var(--syn-punct)">.</span><span style="color: var(--syn-fn)">min</span><span style="color: var(--syn-punct)">(</span><span style="color: var(--syn-number)">18</span><span style="color: var(--syn-punct)">)</span><span style="color: var(--syn-punct)">,</span>
  <span style="color: var(--syn-punct)">&#125;</span><span style="color: var(--syn-punct)">)</span>
<span style="color: var(--syn-punct)">)</span><span style="color: var(--syn-punct)">;</span></code></pre>
		</div>
	</div>
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
	.lead {
		font-size: 15px;
		color: var(--ink-1);
		margin-bottom: 24px;
	}
	.swatch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
		width: 32px;
		height: 32px;
		border-radius: 4px;
		border: 1px solid var(--line-strong);
	}
	.name {
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		color: var(--ink-0);
	}
	.hex {
		font-family: 'JetBrains Mono', monospace;
		font-size: 10px;
		color: var(--ink-2);
	}
	.ds-card {
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: 8px;
		overflow: hidden;
	}
	.ds-card-head {
		padding: 10px 14px;
		border-bottom: 1px solid var(--line);
		font-size: 12px;
		color: var(--ink-1);
		background: var(--bg-2);
	}
	.ds-card-body {
		padding: 16px 24px;
		background: var(--bg-0);
	}
	pre {
		margin: 0;
		font-family: 'JetBrains Mono', monospace;
		font-size: 13px;
		line-height: 1.6;
	}
</style>
