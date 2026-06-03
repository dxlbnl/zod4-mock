<script lang="ts">
	import { Button, PageHero, StatCard } from '@dxlbnl/ui';
	import FeatureMatrix from '$lib/widgets/FeatureMatrix.svelte';
	import JsonTree from '$lib/widgets/JsonTree.svelte';
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
	<PageHero
		eyebrow="zod4-mock"
		heading="Schema-driven mocks, done right for Zod 4"
		variant="hero"
		lede="Type-safe mock data from your Zod v4 schemas — the only library with relational consistency across entities. Competitive with hand-coded faker; faster than @anatine/zod-mock on the CLI baseline (see /bench)."
	>
		<Button as="a" variant="primary" href="/docs/getting-started">Install</Button>
		<Button as="a" variant="cta" href="/showcase">See the relational demo</Button>
	</PageHero>

	<section class="relational-exhibit">
		<h2 class="t-title">Cross-entity consistency, out of the box</h2>
		<p class="t-small" style="color:var(--ink-dim);margin-top:var(--space-2);margin-bottom:var(--space-4)">
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
		<StatCard label="warm path" value="~3×" sublabel="vs zod-mock on flat schemas (CLI baseline)" />
		<StatCard label="entity types" value="7" sublabel="in the relational e-commerce showcase" color="ok" />
		<StatCard label="schema coverage" value="Zod 4" sublabel="full coverage — no feature gaps" color="amber" />
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
	.relational-exhibit {
		background: var(--bg-rail);
		border: 1px solid var(--rule);
		border-radius: 8px;
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
		color: var(--ink-dim);
		margin-bottom: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.json-body {
		font-family: var(--mono);
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
		font-family: var(--mono);
		background: color-mix(in srgb, var(--amber) 20%, transparent);
		color: var(--amber);
		border-radius: 3px;
		padding: 1px 4px;
		font-weight: 600;
		word-break: break-all;
	}
	.proof-arrow {
		color: var(--ink-dim);
	}
	.proof-label {
		color: var(--ink);
	}
	.see-all {
		display: inline-block;
		margin-top: var(--space-3);
		color: var(--amber);
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
		color: var(--ink-dim);
		text-decoration: none;
		margin-top: calc(var(--space-8) * -1 + var(--space-2));
	}
	.bench-link:hover {
		color: var(--amber);
	}
	.matrix-section {
		max-width: 640px;
	}
	.site-footer {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink-dim);
		padding-bottom: var(--space-6);
	}
	.site-footer a {
		color: var(--ink-dim);
		text-decoration: none;
	}
	.site-footer a:hover {
		color: var(--amber);
	}
	.sep {
		color: var(--rule);
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
