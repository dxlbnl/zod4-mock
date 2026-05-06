<script lang="ts">
	import Button from '../Primitives/Button.svelte';
	import SegmentedControl from '../Primitives/SegmentedControl.svelte';
	import Kbd from '../Primitives/Kbd.svelte';

	interface Props {
		version: string;
		workspace: string;
		project: string;
		onrun?: () => void;
		onexport?: () => void;
	}

	let { version, workspace, project, onrun, onexport }: Props = $props();
</script>

<div class="topbar">
	<div class="brand">
		<div class="brand-logo t-code">z</div>
		<div class="brand-name t-title">zod4-mock</div>
		<div class="brand-sub t-code-sm">{version}</div>
	</div>

	<div class="workspace-name t-code">
		<span>{workspace}</span>
		<span class="sep">/</span>
		<span class="name">{project}</span>
	</div>

	<div class="top-actions">
		<SegmentedControl
			options={[
				{ label: 'auto-run', value: 'auto' },
				{ label: 'manual', value: 'manual' }
			]}
			value="auto"
		/>
		<Button onclick={onrun}>▶ Run</Button>
		<Button variant="primary" onclick={onexport}>⬇ Export</Button>
		<Kbd keys="⌘ K" />
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
		border-radius: var(--r-md);
		background: linear-gradient(135deg, var(--accent-dim), var(--accent-bright));
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
</style>
