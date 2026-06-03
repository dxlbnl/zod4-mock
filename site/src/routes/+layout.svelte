<script lang="ts">
	import '$lib/styles/app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app">
	<nav class="topbar">
		<a href="/" class="brand t-label">gen-bench</a>
		<div class="links">
			<a href="/docs" class="t-small">Docs</a>
			<a href="/bench" class="t-small">Bench</a>
			<a href="/showcase" class="t-small">Showcase</a>
			<a href="/table" class="t-small">Table</a>
		</div>
	</nav>
	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		height: var(--h-topbar);
		padding: 0 var(--space-5);
		display: flex;
		align-items: center;
		gap: var(--space-6);
		border-bottom: 1px solid var(--border);
		background: var(--bg-raised);
	}
	.brand {
		color: var(--accent);
		text-decoration: none;
		font-weight: 600;
	}
	.links {
		display: flex;
		gap: var(--space-4);
	}
	.links a {
		color: var(--text-muted);
		text-decoration: none;
		transition: color var(--t-quick);
	}
	.links a:hover {
		color: var(--text-primary);
	}
	main {
		flex: 1;
		padding: var(--space-6) var(--space-5);
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
	}
</style>
