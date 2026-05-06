<script lang="ts">
	interface Props {
		keys: string;
	}

	let { keys }: Props = $props();
</script>

<span class="kbd t-code-tight">
	{keys}
</span>
