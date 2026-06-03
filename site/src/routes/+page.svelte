<script lang="ts">
	import FeatureMatrix from '$lib/components/Surfaces/FeatureMatrix.svelte';
	import SummaryCard from '$lib/components/Surfaces/SummaryCard.svelte';
	import Button from '$lib/components/Primitives/Button.svelte';
	import JsonTree from '$lib/components/Showcase/JsonTree.svelte';
	import { generateWorld } from '$lib/runners/ecommerce';

	const features = [
		{ label: 'Zod v4 schemas', zod4mock: 'yes' as const, zodmock: 'no' as const, faker: 'na' as const },
		{ label: 'Relational / cross-entity IDs', zod4mock: 'yes' as const, zodmock: 'no' as const, faker: 'no' as const },
		{ label: 'Type-safe output', zod4mock: 'yes' as const, zodmock: 'yes' as const, faker: 'no' as const },
		{ label: 'Seeded / deterministic', zod4mock: 'yes' as const, zodmock: 'no' as const, faker: 'yes' as const },
		{ label: 'No schema required', zod4mock: 'no' as const, zodmock: 'no' as const, faker: 'yes' as const },
		{ label: 'Handles discriminated unions', zod4mock: 'yes' as const, zodmock: 'partial' as const, faker: 'na' as const }
	];

	const world = generateWorld(42);

	const allIds = new Set([
		...world.users.map((u) => u.id),
		...world.categories.map((c) => c.id),
		...world.products.map((p) => p.id),
		...world.variants.map((v) => v.id)
	]);

	const review = world.reviews[0];
	const reviewUser = world.users.find((u) => u.id === review?.userId);
	const reviewProduct = world.products.find((p) => p.id === review?.productId);
</script>

<div class="page">
	<header class="hero">
		<h1 class="t-large">Schema-driven mocks,<br />done right for Zod 4</h1>
		<p class="t-base" style="color:var(--text-muted);max-width:520px;margin-top:var(--space-3)">
			<strong style="color:var(--accent)">zod4-mock</strong> generates type-safe mock data from your
			Zod v4 schemas — the only library with relational consistency across entities. Faster than
			@anatine/zod-mock by 3–5×, and competitive with hand-coded faker with zero shape maintenance.
		</p>
		<div class="ctas">
			<Button label="Install" variant="primary" onclick={() => (window.location.href = '/docs/getting-started')} />
			<Button label="See relational demo →" onclick={() => (window.location.href = '/showcase')} />
		</div>
	</header>

	<section class="relational-exhibit">
		<h2 class="t-title">Cross-entity consistency, out of the box</h2>
		<p class="t-small" style="color:var(--text-muted);margin-top:var(--space-2);margin-bottom:var(--space-4)">
			Every highlighted ID resolves to a real entity in the same generated world. No manual wiring.
		</p>
		<div class="exhibit-grid">
			<div class="json-panel">
				<div class="panel-label t-small">Review (generated)</div>
				<div class="json-body">
					{#if review}
						<JsonTree value={review} highlightIds={allIds} />
					{/if}
				</div>
			</div>
			<div class="proofs">
				{#if review && reviewUser}
					<div class="proof-row">
						<span class="proof-id t-small">{review.userId}</span>
						<span class="proof-arrow">→</span>
						<span class="proof-label t-small">User "{reviewUser.name}"</span>
					</div>
				{/if}
				{#if review && reviewProduct}
					<div class="proof-row">
						<span class="proof-id t-small">{review.productId}</span>
						<span class="proof-arrow">→</span>
						<span class="proof-label t-small">Product "{reviewProduct.name}"</span>
					</div>
				{/if}
			</div>
		</div>
		<a href="/showcase" class="t-small see-all">See all 7 entities →</a>
	</section>

	<section class="matrix-section">
		<h2 class="t-title" style="margin-bottom:var(--space-4)">Feature comparison</h2>
		<FeatureMatrix {features} />
	</section>

	<section class="summary-cards">
		<SummaryCard headline="~3×" description="faster than zod-mock on flat schemas" />
		<SummaryCard
			headline="7"
			unit="entity types"
			description="in the relational e-commerce showcase"
			color="var(--success)"
		/>
		<SummaryCard headline="Zod 4" description="full schema coverage — no feature gaps" color="var(--warning)" />
	</section>
	<a href="/bench" class="t-small bench-link">See full benchmark results →</a>

	<footer class="site-footer t-small">
		<a href="https://github.com/dxlbnl/zod4-mock" target="_blank" rel="noopener">GitHub</a>
		<span class="sep">·</span>
		<a href="https://npmjs.com/package/zod4-mock" target="_blank" rel="noopener">npm</a>
		<span class="sep">·</span>
		<a href="/docs/getting-started">Docs</a>
	</footer>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-8);
	}
	.hero {
		padding-top: var(--space-6);
	}
	.ctas {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-5);
		align-items: center;
	}
	.relational-exhibit {
		background: var(--surface-2, var(--surface));
		border: 1px solid var(--border);
		border-radius: var(--radius-lg, 8px);
		padding: var(--space-5);
	}
	.exhibit-grid {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-5);
		align-items: start;
	}
	.json-panel {
		min-width: 0;
	}
	.panel-label {
		color: var(--text-muted);
		margin-bottom: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.json-body {
		font-family: var(--font-mono);
		font-size: 12px;
		overflow: auto;
		max-height: 260px;
	}
	.proofs {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 280px;
	}
	.proof-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.proof-id {
		font-family: var(--font-mono);
		background: var(--accent-soft);
		color: var(--accent);
		border-radius: 3px;
		padding: 1px 4px;
		font-weight: 600;
		word-break: break-all;
	}
	.proof-arrow {
		color: var(--text-muted);
	}
	.proof-label {
		color: var(--text-primary);
	}
	.see-all {
		display: inline-block;
		margin-top: var(--space-3);
		color: var(--accent);
		text-decoration: none;
	}
	.see-all:hover {
		text-decoration: underline;
	}
	.summary-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-4);
	}
	.bench-link {
		color: var(--text-muted);
		text-decoration: none;
		margin-top: calc(var(--space-8) * -1 + var(--space-2));
	}
	.bench-link:hover {
		color: var(--accent);
	}
	.matrix-section {
		max-width: 640px;
	}
	.site-footer {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text-muted);
		padding-bottom: var(--space-6);
	}
	.site-footer a {
		color: var(--text-muted);
		text-decoration: none;
	}
	.site-footer a:hover {
		color: var(--accent);
	}
	.sep {
		color: var(--border);
	}

	@media (max-width: 640px) {
		.exhibit-grid {
			grid-template-columns: 1fr;
		}
		.proofs {
			min-width: 0;
		}
	}
</style>
