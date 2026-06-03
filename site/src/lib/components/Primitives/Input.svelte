<script lang="ts">
	interface Props {
		value?: string;
		placeholder?: string;
		type?: 'text' | 'search';
		class?: string;
		oninput?: (value: string) => void;
	}

	let {
		value = $bindable(''),
		placeholder = '',
		type = 'text',
		class: className = '',
		oninput
	}: Props = $props();
</script>

<input
	{type}
	bind:value
	{placeholder}
	class={className}
	oninput={(e) => oninput?.((e.target as HTMLInputElement).value)}
/>
