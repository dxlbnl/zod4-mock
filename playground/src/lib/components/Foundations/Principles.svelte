<script lang="ts">
</script>

<div class="ds-section">
	<h1>Principles</h1>
	<p class="lead">
		Five rules that the components and tokens enforce. Read these first; they decide every
		trade-off below.
	</p>

	<div class="grid-2">
		<div class="ds-card">
			<div class="ds-card-head"><span class="label">1 · Density over decoration</span></div>
			<div class="ds-card-body col">
				<p style="margin: 0">
					Power users want lots on screen. Row height is 28px, padding 4–8, type 11–13. No
					drop shadows on inline elements; no avatars; no decorative iconography.
				</p>
			</div>
		</div>
		<div class="ds-card">
			<div class="ds-card-head">
				<span class="label">2 · One accent, used sparingly</span>
			</div>
			<div class="ds-card-body col">
				<p style="margin: 0">
					Zod purple appears only on: active subject, focused row, focused tab, primary CTA,
					the open <code>+ mod</code> menu, and syntax keywords. Everything else is neutral.
				</p>
			</div>
		</div>
		<div class="ds-card">
			<div class="ds-card-head">
				<span class="label">3 · Tokens are the only source of truth</span>
			</div>
			<div class="ds-card-body col">
				<p style="margin: 0">
					Every value (color, space, radius, type) lives in <code>tokens.css</code> as a CSS
					custom property. Components never hard-code. The light theme is one block of
					overrides.
				</p>
			</div>
		</div>
		<div class="ds-card">
			<div class="ds-card-head">
				<span class="label">4 · Mono for data, sans for UI</span>
			</div>
			<div class="ds-card-body col">
				<p style="margin: 0">
					<b>JetBrains Mono</b> for: keys, types, modifiers, code, JSON, file names, kbd
					hints, counts. <b>Inter</b> for: button text, headings, titles, descriptive copy.
				</p>
			</div>
		</div>
		<div class="ds-card" style="grid-column: span 2">
			<div class="ds-card-head"><span class="label">5 · Inline editing wins</span></div>
			<div class="ds-card-body col">
				<p style="margin: 0">
					Property keys, modifier values, file names — all editable in place. Modifiers are
					removable on hover. The <code>+ mod</code> pill opens a search menu directly under
					the row, never a dialog.
				</p>
			</div>
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
		letter-spacing: -0.02em;
	}
	.lead {
		font-size: 15px;
		color: var(--ink-1);
		max-width: 72ch;
		margin-bottom: 24px;
	}
	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
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
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--line);
		font-size: 12px;
		color: var(--ink-1);
		background: var(--bg-2);
	}
	.ds-card-head .label {
		font-weight: 600;
		color: var(--ink-0);
	}
	.ds-card-body {
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.ds-card-body p {
		color: var(--ink-1);
		font-size: 14px;
		line-height: 1.5;
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
