<script lang="ts">
	// B100-R5 — <InstallBlock> install command with PM switcher.
	// PM tabs are real role="tab" buttons; preference persists in
	// localStorage under "zod4-mock:install-pm"; clicking copy fires a
	// transient toast with "Copied" text.

	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	type Pm = 'pnpm' | 'npm' | 'yarn' | 'bun';

	const PMS: ReadonlyArray<Pm> = ['pnpm', 'npm', 'yarn', 'bun'];
	const STORAGE_KEY = 'zod4-mock:install-pm';

	interface Props {
		pkg: string;
	}

	let { pkg }: Props = $props();

	function commandFor(pm: Pm, packages: string): string {
		switch (pm) {
			case 'pnpm':
				return `pnpm add ${packages}`;
			case 'npm':
				return `npm install ${packages}`;
			case 'yarn':
				return `yarn add ${packages}`;
			case 'bun':
				return `bun add ${packages}`;
		}
	}

	let active: Pm = $state('pnpm');
	let copied = $state(false);

	onMount(() => {
		if (browser) {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (stored && (PMS as ReadonlyArray<string>).includes(stored)) {
				active = stored as Pm;
			}
		}
	});

	function selectPm(pm: Pm) {
		active = pm;
		if (browser) {
			try {
				window.localStorage.setItem(STORAGE_KEY, pm);
			} catch {
				/* localStorage unavailable */
			}
		}
	}

	function onTabKeydown(event: KeyboardEvent, idx: number) {
		const key = event.key;
		if (key === 'ArrowRight' || key === 'ArrowLeft') {
			event.preventDefault();
			const next =
				key === 'ArrowRight' ? (idx + 1) % PMS.length : (idx - 1 + PMS.length) % PMS.length;
			const nextPm = PMS[next];
			if (nextPm === undefined) return;
			selectPm(nextPm);
			// Move keyboard focus to the activated tab.
			queueMicrotask(() => {
				const el = document.getElementById(`install-pm-${nextPm}`);
				if (el) el.focus();
			});
		} else if (key === 'Enter' || key === ' ') {
			event.preventDefault();
			const pm = PMS[idx];
			if (pm) selectPm(pm);
		}
	}

	function copy() {
		const text = commandFor(active, pkg);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 1500);
		if (browser && navigator.clipboard) {
			navigator.clipboard.writeText(text).catch(() => {
				/* clipboard unavailable — toast already shown */
			});
		}
	}
</script>

<div class="install-block">
	<div class="tabs" role="tablist" aria-label="Package manager">
		{#each PMS as pm, idx}
			<button
				id="install-pm-{pm}"
				type="button"
				role="tab"
				aria-selected={active === pm}
				tabindex={active === pm ? 0 : -1}
				class="tab"
				class:active={active === pm}
				onclick={() => selectPm(pm)}
				onkeydown={(e) => onTabKeydown(e, idx)}
			>
				{pm}
			</button>
		{/each}
	</div>
	<div class="cmd-row">
		<pre class="cmd"><code>{commandFor(active, pkg)}</code></pre>
		<button type="button" class="copy" onclick={copy} aria-label="Copy install command">
			Copy
		</button>
	</div>
	{#if copied}
		<div class="toast" role="status">Copied</div>
	{/if}
</div>

<style>
	.install-block {
		border: 1px solid var(--rule);
		border-radius: 8px;
		overflow: hidden;
		position: relative;
	}
	.tabs {
		display: flex;
		background: var(--bg-rail);
		border-bottom: 1px solid var(--rule);
	}
	.tab {
		appearance: none;
		background: none;
		border: none;
		padding: var(--space-2) var(--space-3);
		font-family: var(--mono);
		font-size: 12px;
		color: var(--ink-dim);
		cursor: pointer;
		text-transform: lowercase;
	}
	.tab:hover {
		color: var(--ink);
	}
	.tab.active {
		color: var(--amber);
		border-bottom: 2px solid var(--amber);
	}
	.tab:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: -2px;
	}
	.cmd-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3);
		background: var(--bg-elev);
	}
	.cmd {
		margin: 0;
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink);
	}
	.cmd code {
		background: none;
		font-family: inherit;
		color: inherit;
		padding: 0;
	}
	.copy {
		appearance: none;
		background: none;
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 2px 8px;
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-dim);
		cursor: pointer;
	}
	.copy:hover {
		color: var(--amber);
		border-color: var(--amber);
	}
	.toast {
		position: absolute;
		bottom: var(--space-2);
		right: var(--space-3);
		background: var(--amber);
		color: var(--bg);
		font-family: var(--mono);
		font-size: 11px;
		padding: 2px 8px;
		border-radius: 4px;
	}
</style>
