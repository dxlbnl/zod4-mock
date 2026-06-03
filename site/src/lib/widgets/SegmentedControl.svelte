<script lang="ts">
	interface Props {
		options: { value: string; label: string }[];
		value?: string;
		onchange?: (value: string) => void;
	}

	let { options, value = $bindable(options[0]?.value ?? ''), onchange }: Props = $props();

	function select(v: string) {
		value = v;
		onchange?.(v);
	}
</script>

<div class="seg" role="tablist">
	{#each options as opt}
		<button
			class="seg-item {value === opt.value ? 'active' : ''}"
			role="tab"
			aria-selected={value === opt.value}
			onclick={() => select(opt.value)}
			type="button"
		>
			{opt.label}
		</button>
	{/each}
</div>
