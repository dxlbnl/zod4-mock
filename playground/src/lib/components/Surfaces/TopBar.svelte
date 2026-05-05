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
		<div class="brand-logo">z</div>
		<div class="brand-name">zod4-mock</div>
		<div class="brand-sub">{version}</div>
	</div>

	<div class="workspace-name">
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
		height: 40px;
		padding: 0 16px;
		background: var(--bg-1);
		border-bottom: 1px solid var(--line);
		gap: 24px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.brand-logo {
		width: 22px;
		height: 22px;
		border-radius: 5px;
		background: linear-gradient(135deg, var(--accent-dim), var(--accent-bright));
		display: grid;
		place-items: center;
		color: #fff;
		font-family: 'JetBrains Mono', monospace;
		font-weight: 700;
		font-size: 13px;
	}
	.brand-name {
		font-weight: 600;
		font-size: 13px;
		color: var(--ink-0);
	}
	.brand-sub {
		color: var(--ink-2);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
	}

	.workspace-name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
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
		gap: 12px;
	}
</style>
