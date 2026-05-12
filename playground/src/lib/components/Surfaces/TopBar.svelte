<script lang="ts">
	import Button from "$lib/components/Primitives/Button.svelte";
	import Select from "$lib/components/Primitives/Select.svelte";
	import Kbd from "$lib/components/Primitives/Kbd.svelte";

	interface Props {
		version: string;
		workspace: string;
		project: string;
		zodVersion: string;
		availableZodVersions: string[];
		isZodLoading?: boolean;
		onchangezod?: (v: string) => void;
		onexport?: () => void;
	}

	let {
		version,
		workspace,
		project,
		zodVersion,
		availableZodVersions,
		isZodLoading = false,
		onchangezod,
		onexport,
	}: Props = $props();

	const zodOptions = $derived(
		availableZodVersions.map((v) => ({ label: `zod@${v}`, value: v })),
	);
</script>

<div class="topbar">
	<div class="brand">
		<div class="brand-logo t-code">z</div>
		<div class="brand-name t-title">zod4-mock</div>
		<div class="brand-sub t-code-sm">v{version}</div>
	</div>

	<div class="workspace-name t-code">
		<span>{workspace}</span>
		<span class="sep">/</span>
		<span class="name">{project}</span>
	</div>

	<div class="top-actions">
		<div class="zod-selector" class:loading={isZodLoading}>
			<Select
				options={zodOptions}
				value={zodVersion}
				onchange={onchangezod}
			/>
		</div>
		<Button variant="primary" onclick={onexport}>⬇ Export</Button>
	</div>
</div>

<style>
	.topbar {
		display: flex;
		align-items: center;
		height: var(--h-topbar);
		padding: 0 var(--space-5);
		background: var(--bg-1);
		border-bottom: 1px solid var(--line);
		gap: var(--space-6);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.brand-logo {
		width: var(--h-input);
		height: var(--h-input);
		border-radius: var(--radius-md);
		background: linear-gradient(
			135deg,
			var(--accent-dim),
			var(--accent-bright)
		);
		display: grid;
		place-items: center;
		color: #fff;
		font-weight: 700;
	}
	.brand-name {
		color: var(--ink-0);
	}
	.brand-sub {
		color: var(--ink-2);
	}

	.workspace-name {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink-2);
	}
	.workspace-name .sep {
		color: var(--ink-3);
	}
	.workspace-name .name {
		color: var(--ink-1);
	}

	.top-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.zod-selector {
		transition: opacity 0.2s ease;
	}

	.zod-selector.loading {
		opacity: 0.5;
		pointer-events: none;
	}

	@media (max-width: 768px) {
		.zod-selector,
		.workspace-name {
			display: none;
		}
	}
</style>
