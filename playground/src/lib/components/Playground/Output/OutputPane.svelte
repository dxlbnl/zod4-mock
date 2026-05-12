<script lang="ts">
  import OutputTabs from "$lib/components/Surfaces/OutputTabs.svelte";
  import CodeView from "./CodeView.svelte";
  import MockDataView from "./DataView.svelte";
  import WorldView from "./WorldView.svelte";
  import Button from "$lib/components/Primitives/Button.svelte";
  import { getContext } from "svelte";
  import type { OutputStore } from "$lib/output.svelte";

  interface Props {
    activeTab: "code" | "data" | "world";
    selectedFieldId?: string | null;

    // Optional props for testing/stories when context is missing
    codeLines?: any[];
    dataLines?: any[];
    worldLines?: any[];
    fullCode?: string;
    fullData?: string;
    fullWorld?: string;
  }

  let {
    activeTab = $bindable("data"),
    selectedFieldId = null,
    ...restProps
  }: Props = $props();

  const contextOutput = getContext<OutputStore>("output-store");

  // Use context if available, otherwise fall back to props (for stories/tests)
  const output = contextOutput || {
    get codeLines() { return restProps.codeLines || []; },
    get dataLines() { return restProps.dataLines || []; },
    get worldLines() { return restProps.worldLines || []; },
    get fullSchemaCode() { return restProps.fullCode || ""; },
    get fullDataJson() { return restProps.fullData || ""; },
    get fullWorldJson() { return restProps.fullWorld || ""; },
  };

  const tabs = [
    { id: "code", label: "Zod Definition", status: "active" as const },
    { id: "data", label: "Mock Data", status: "active" as const },
    { id: "world", label: "World View", status: "active" as const },
  ];

  async function handleCopy() {
    const text =
      activeTab === "code"
        ? output.fullSchemaCode
        : activeTab === "data"
          ? output.fullDataJson
          : output.fullWorldJson;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  }
</script>

<div class="output-pane">
  <OutputTabs
    {tabs}
    bind:activeTab
  >
    {#snippet actions()}
      <Button variant="ghost" label="Copy" onclick={handleCopy} />
    {/snippet}
  </OutputTabs>

  <div class="content">
    {#if activeTab === "code"}
      <CodeView lines={output.codeLines} {selectedFieldId} title="" />
    {:else if activeTab === "data"}
      <MockDataView lines={output.dataLines} {selectedFieldId} title="" />
    {:else}
      <WorldView lines={output.worldLines} />
    {/if}
  </div>
</div>

<style>
  .output-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-0);
  }

  .content {
    flex: 1;
    overflow: hidden;
  }
</style>
