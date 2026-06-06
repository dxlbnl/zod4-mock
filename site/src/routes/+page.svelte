<script lang="ts">
	import { Button, PageHero, StatCard, Stack, Inline, Card, Grid, Heading, Text } from '@dxlbnl/ui';
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

<Stack gap="xl">
	<PageHero
		eyebrow="zod4-mock"
		heading="Schema-driven mocks, done right for Zod 4"
		variant="hero"
		lede="Type-safe mock data from your Zod v4 schemas — the only library with relational consistency across entities. Competitive with hand-coded faker; faster than @anatine/zod-mock on the CLI baseline (see /bench)."
	>
		<Button as="a" variant="primary" href="/docs/getting-started">Install</Button>
		<Button as="a" variant="cta" href="/showcase">See the relational demo</Button>
	</PageHero>

	<Card>
		<Stack gap="sm" class="relational-exhibit">
			<Heading level={2} variant="h3">Cross-entity consistency, out of the box</Heading>
			<Text variant="body" color="dim">
				Every highlighted ID resolves to a real entity in the same generated world. No manual wiring.
			</Text>
			<div class="exhibit-grid">
				<div class="json-panel">
					<Text variant="mono" color="dim" class="panel-label">Review (generated)</Text>
					<div class="json-body">
						{#if review}
							<JsonTree value={review} highlightIds={allIds} />
						{/if}
					</div>
				</div>
				<Stack gap="sm" class="proofs">
					{#if review && reviewUser}
						<Inline gap="xs" class="proof-row">
							<span class="proof-id">{review.userId}</span>
							<span class="proof-arrow">→</span>
							<span class="proof-label">User "{reviewUser.name}"</span>
						</Inline>
					{/if}
					{#if review && reviewProduct}
						<Inline gap="xs" class="proof-row">
							<span class="proof-id">{review.productId}</span>
							<span class="proof-arrow">→</span>
							<span class="proof-label">Product "{reviewProduct.name}"</span>
						</Inline>
					{/if}
				</Stack>
			</div>
			<a href="/showcase" class="see-all">See all 7 entities →</a>
		</Stack>
	</Card>

	<Stack gap="sm" class="matrix-section">
		<Heading level={2} variant="h3">Feature comparison</Heading>
		<FeatureMatrix {features} />
	</Stack>

	<Grid cols="auto" minColWidth="200px" gap="md">
		<StatCard label="warm path" value="~3×" sublabel="vs zod-mock on flat schemas (CLI baseline)" />
		<StatCard label="entity types" value="7" sublabel="in the relational e-commerce showcase" color="ok" />
		<StatCard label="schema coverage" value="Zod 4" sublabel="full coverage — no feature gaps" color="amber" />
	</Grid>
	<a href="/bench" class="bench-link">See full benchmark results →</a>

	<Inline gap="xs" as="footer" class="site-footer">
		<a href="https://github.com/dxlbnl/zod4-mock" target="_blank" rel="noopener">GitHub</a>
		<span class="sep">·</span>
		<a href="https://npmjs.com/package/zod4-mock" target="_blank" rel="noopener">npm</a>
		<span class="sep">·</span>
		<a href="/docs/getting-started">Docs</a>
	</Inline>
</Stack>

<style>
	:global(.relational-exhibit) {
		padding: var(--u3);
	}
	.exhibit-grid {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--u3);
		align-items: start;
	}
	.json-panel {
		min-width: 0;
	}
	:global(.panel-label) {
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.json-body {
		font-family: var(--mono);
		font-size: 12px;
		overflow: auto;
		max-height: 260px;
	}
	:global(.proofs) {
		min-width: 280px;
	}
	.proof-id {
		font-family: var(--mono);
		font-size: 13px;
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
		font-size: 13px;
		color: var(--ink);
	}
	.see-all {
		display: inline-block;
		font-size: 13px;
		color: var(--amber);
		text-decoration: none;
	}
	.see-all:hover {
		text-decoration: underline;
	}
	.bench-link {
		font-size: 13px;
		color: var(--ink-dim);
		text-decoration: none;
		margin-top: calc(var(--u6) * -1 + var(--u));
	}
	.bench-link:hover {
		color: var(--amber);
	}
	:global(.matrix-section) {
		max-width: 640px;
	}
	:global(.site-footer) {
		font-size: 13px;
		color: var(--ink-dim);
		padding-bottom: var(--u4);
	}
	:global(.site-footer) a {
		color: var(--ink-dim);
		text-decoration: none;
	}
	:global(.site-footer) a:hover {
		color: var(--amber);
	}
	.sep {
		color: var(--rule);
	}

	@media (max-width: 640px) {
		.exhibit-grid {
			grid-template-columns: 1fr;
		}
		:global(.proofs) {
			min-width: 0;
		}
	}
</style>
