<script lang="ts">
  import OutputTabs from "$lib/components/Surfaces/OutputTabs.svelte";
  import CodeView from "./CodeView.svelte";
  import MockDataView from "./DataView.svelte";
  import WorldView from "./WorldView.svelte";
  import Button from "$lib/components/Primitives/Button.svelte";
  import type { CodeLine } from "$lib/codegen";

  interface Props {
    activeTab: "code" | "data" | "world";
    codeLines: CodeLine[];
    dataLines: CodeLine[];
    worldLines?: CodeLine[];
    fullCode: string;
    fullData: string;
    fullWorld?: string;
    selectedFieldId?: string | null;
    onchangetab?: (tab: "code" | "data" | "world") => void;
  }

  let {
    activeTab = $bindable("data"),
    codeLines = [],
    dataLines = [],
    worldLines = [],
    fullCode = "",
    fullData = "",
    fullWorld = "",
    selectedFieldId = null,
    onchangetab,
  }: Props = $props();

  const tabs = [
    { id: "code", label: "Zod Definition", status: "active" as const },
    { id: "data", label: "Mock Data", status: "active" as const },
    { id: "world", label: "World View", status: "active" as const },
  ];

  async function handleCopy() {
    const text =
      activeTab === "code"
        ? fullCode
        : activeTab === "data"
          ? fullData
          : fullWorld;
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
    onchange={(id) => onchangetab?.(id as "code" | "data" | "world")}
  >
    {#snippet actions()}
      <Button variant="ghost" label="Copy" onclick={handleCopy} />
    {/snippet}
  </OutputTabs>

  <div class="content">
    {#if activeTab === "code"}
      <CodeView lines={codeLines} {selectedFieldId} title="" />
    {:else if activeTab === "data"}
      <MockDataView lines={dataLines} {selectedFieldId} title="" />
    {:else}
      <WorldView lines={worldLines} />
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
