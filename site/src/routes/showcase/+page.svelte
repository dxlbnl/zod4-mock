<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button, Tabs } from '@dxlbnl/ui';
	import CodePanel from '$lib/widgets/CodePanel.svelte';
	import JsonTree from '$lib/widgets/JsonTree.svelte';
	import RelationCallout from '$lib/widgets/RelationCallout.svelte';
	import { generateWorld } from '$lib/runners/ecommerce';
	import type { EcommerceWorld } from '$lib/schemas/ecommerce';

	let world = $state<EcommerceWorld>(generateWorld());

	function regenerate() {
		world = generateWorld();
	}

	// Collect all entity IDs for cross-highlighting
	const allIds = $derived(
		new Set([
			...world.users.map((u) => u.id),
			...world.categories.map((c) => c.id),
			...world.products.map((p) => p.id),
			...world.variants.map((v) => v.id)
		])
	);

	// Build relation proofs from first review and first order
	const proofs = $derived(() => {
		const r = world.reviews[0];
		const o = world.orders[0];
		if (!r || !o) return [];
		const user = world.users.find((u) => u.id === r.userId);
		const product = world.products.find((p) => p.id === r.productId);
		const orderUser = world.users.find((u) => u.id === o.userId);
		return [
			r && user
				? { label: 'review.userId', value: r.userId, resolves: `User "${user.name}"` }
				: null,
			r && product
				? { label: 'review.productId', value: r.productId, resolves: `Product "${product.name}"` }
				: null,
			o && orderUser
				? { label: 'order.userId', value: o.userId, resolves: `User "${orderUser.name}"` }
				: null
		].filter(Boolean) as { label: string; value: string; resolves: string }[];
	});

	const schemaTabs = [
		{
			label: 'User',
			code: `const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(60),
  email: z.string().email(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string()
  }),
  createdAt: z.date()
});`
		},
		{
			label: 'Category',
			code: `const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().uuid().nullable()
});`
		},
		{
			label: 'Product',
			code: `const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  categoryId: z.string().uuid(), // → Category.id
  price: z.number().min(0.01).max(9999.99),
  rating: z.number().min(1).max(5)
});`
		},
		{
			label: 'Review',
			code: `const reviewSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(), // → Product.id
  userId: z.string().uuid(),    // → User.id
  rating: z.number().int().min(1).max(5),
  body: z.string().max(500),
  createdAt: z.date()
});`
		},
		{
			label: 'Order',
			code: `const orderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(), // → User.id
  items: z.array(z.object({
    productId: z.string().uuid(),  // → Product.id
    variantId: z.string().uuid(),  // → Variant.id
    qty: z.number().int().min(1),
    unitPrice: z.number().min(0)
  })),
  total: z.number().min(0),
  status: z.enum(['pending', 'processing', 'shipped',
                  'delivered', 'cancelled']),
  createdAt: z.date()
});`
		}
	];

	type EntityKey = 'users' | 'categories' | 'products' | 'variants' | 'reviews' | 'orders';

	const entityOptions: { key: EntityKey; label: string }[] = [
		{ key: 'users', label: 'Users' },
		{ key: 'categories', label: 'Categories' },
		{ key: 'products', label: 'Products' },
		{ key: 'variants', label: 'Variants' },
		{ key: 'reviews', label: 'Reviews' },
		{ key: 'orders', label: 'Orders' }
	];
</script>

{#snippet entityPanel(key: EntityKey)}
	<JsonTree value={world[key]} highlightIds={allIds} />
{/snippet}

{#snippet usersPanel()}{@render entityPanel('users')}{/snippet}
{#snippet categoriesPanel()}{@render entityPanel('categories')}{/snippet}
{#snippet productsPanel()}{@render entityPanel('products')}{/snippet}
{#snippet variantsPanel()}{@render entityPanel('variants')}{/snippet}
{#snippet reviewsPanel()}{@render entityPanel('reviews')}{/snippet}
{#snippet ordersPanel()}{@render entityPanel('orders')}{/snippet}

{#snippet entityTabs()}
	{@const panelByKey: Record<EntityKey, Snippet> = {
		users: usersPanel,
		categories: categoriesPanel,
		products: productsPanel,
		variants: variantsPanel,
		reviews: reviewsPanel,
		orders: ordersPanel
	}}
	<Tabs
		active="reviews"
		tabs={entityOptions.map((opt) => ({
			id: opt.key,
			label: `${opt.label} (${world[opt.key].length})`,
			panel: panelByKey[opt.key]
		}))}
	/>
{/snippet}

<div class="page">
	<header class="page-header">
		<h1 class="t-title">Relational Data Demo</h1>
		<p class="t-small" style="color:var(--ink-dim)">
			zod4-mock generates referentially consistent data — IDs cross-reference real entities.
		</p>
	</header>

	<div class="toolbar">
		<Button variant="ghost" onclick={regenerate}>Regenerate</Button>
	</div>

	<RelationCallout proofs={proofs()} />

	<div class="split">
		<div class="left">
			<p class="t-caption section-label">Schema</p>
			<CodePanel tabs={schemaTabs} />
		</div>
		<div class="right">
			<p class="t-caption section-label">Generated output</p>
			<div class="json-wrap">
				{@render entityTabs()}
			</div>
		</div>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-5);
		align-items: start;
	}
	@media (max-width: 800px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
	.section-label {
		margin-bottom: var(--space-2);
	}
	.json-wrap {
		font-family: var(--mono);
		font-size: 12px;
		max-height: 520px;
		overflow: auto;
	}
</style>
