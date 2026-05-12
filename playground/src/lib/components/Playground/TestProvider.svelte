<script lang="ts">
  import { setContext, untrack } from "svelte";
  import { createPlaygroundState } from "$lib/state.svelte";
  import { createOutputState } from "$lib/output.svelte";

  interface Props {
    children: import('svelte').Snippet;
    initialState?: any;
    // Manual overrides for testing specific scenarios
    store?: any;
    output?: any;
  }

  let { children, initialState, store: manualStore, output: manualOutput }: Props = $props();

  const store = untrack(() => manualStore || createPlaygroundState(initialState));
  const output = untrack(() => manualOutput || createOutputState(store));

  setContext("playground-store", store);
  setContext("output-store", output);
</script>

{@render children()}
