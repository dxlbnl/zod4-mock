<script lang="ts">
	interface Option {
		label: string;
		value: string;
	}

	interface Props {
		options: Option[];
		value?: string | string[];
		multi?: boolean;
		onchange?: (value: any) => void;
	}

	let { options = [], value = $bindable(), multi = false, onchange }: Props = $props();

	function toggle(val: string) {
		if (multi) {
			if (Array.isArray(value)) {
				if (value.includes(val)) {
					value = value.filter((v) => v !== val);
				} else {
					value = [...value, val];
				}
			} else {
				value = [val];
			}
		} else {
			value = val;
		}
		onchange?.(value);
	}

	function isPressed(val: string) {
		if (multi) {
			return Array.isArray(value) && value.includes(val);
		}
		return value === val;
	}
</script>

<div class="seg">
	{#each options as option}
		<button
			type="button"
			class="seg-btn t-tiny"
			aria-pressed={isPressed(option.value)}
			onclick={() => toggle(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
