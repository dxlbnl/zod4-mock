<script lang="ts">
	import { onMount } from 'svelte';
	import { mount, unmount } from 'svelte';
	import SchemaPlayground from '$lib/components/Docs/SchemaPlayground.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// eslint-disable-next-line no-unassigned-vars -- assigned by Svelte bind:this
	let container: HTMLDivElement;

	onMount(() => {
		const instances: object[] = [];
		container.querySelectorAll<HTMLElement>('[data-playground]').forEach((el) => {
			const initialCode = atob(el.dataset.playground ?? '');
			delete el.dataset.playground;
			instances.push(mount(SchemaPlayground, { target: el, props: { initialCode } }));
		});
		return () => instances.forEach((inst) => unmount(inst));
	});
</script>

<div bind:this={container} class="docs-prose">
	<data.component />
</div>
