<script lang="ts">
</script>

<div class="intro-container">
	<div class="hero">
		<div class="logo-orb">z</div>
		<h1>ZodMock Design System</h1>
		<p class="lead">
			A high-fidelity component library for building schema-driven mock data playgrounds.
			Powered by <strong>Svelte 5 Runes</strong> and a token-first design language.
		</p>
	</div>

	<div class="grid">
		<div class="card">
			<h3>Primitives</h3>
			<p>Atomic UI building blocks: buttons, inputs, chips, and typography tokens.</p>
		</div>

		<div class="card">
			<h3>Builder</h3>
			<p>Layout surfaces and interaction patterns for the visual schema editor.</p>
		</div>
	</div>
</div>

<style>
	.intro-container {
		padding: 64px 40px;
		max-width: 900px;
		margin: 0 auto;
		font-family: 'Inter', sans-serif;
	}

	.hero {
		margin-bottom: 64px;
	}

	.logo-orb {
		width: 48px;
		height: 48px;
		background: linear-gradient(135deg, var(--accent), var(--accent-bright));
		border-radius: 12px;
		display: grid;
		place-items: center;
		color: #fff;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 24px;
		margin-bottom: 24px;
		box-shadow: 0 8px 24px var(--accent-soft);
	}

	h1 {
		font-size: 40px;
		font-weight: 700;
		color: var(--ink-0);
		letter-spacing: -0.02em;
		margin: 0 0 16px 0;
	}

	.lead {
		font-size: 18px;
		color: var(--ink-1);
		line-height: 1.6;
		max-width: 600px;
		margin: 0;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 32px;
	}

	.card {
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		padding: 32px;
		transition: all var(--ease-quick);
	}

	.card:hover {
		border-color: var(--accent-edge);
		transform: translateY(-2px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
	}

	.card h3 {
		margin: 0 0 12px 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--accent);
	}

	.card p {
		color: var(--ink-2);
		font-size: 14px;
		line-height: 1.5;
		margin: 0 0 24px 0;
	}
</style>
