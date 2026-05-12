<script lang="ts">
	import TopBar from "$lib/components/Surfaces/TopBar.svelte";
	import LeftRail from "./Sidebar/LeftRail.svelte";
	import SchemaEditor from "./Editor/index.svelte";
	import OutputPane from "./Output/OutputPane.svelte";
	import ExportSheet from "$lib/components/Surfaces/ExportSheet.svelte";
	import ExportContent from "./Output/ExportContent.svelte";
	import MobileTabBar from "./MobileTabBar.svelte";

	import { untrack, onMount, setContext } from "svelte";
	import { createPlaygroundState } from "$lib/state.svelte";
	import { createOutputState } from "$lib/output.svelte";
	import { exportLineCount } from "$lib/codegen";

	interface Props {
		initialState?: any;
	}

	let { initialState = undefined }: Props = $props();

	// Initialize stores
	const store = createPlaygroundState(untrack(() => initialState));
	const output = createOutputState(store);

	// Provide to context
	setContext("playground-store", store);
	setContext("output-store", output);

	onMount(() => {
		store.fetchAvailableZodVersions();
	});

	// Track selection
	let selectedFieldId = $state<string | null>(null);

	function handleCopyExport() {
		navigator.clipboard.writeText(output.fullExportCode);
	}

	function handleDownload() {
		const blob = new Blob([output.fullExportCode], { type: "text/typescript" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "world.ts";
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="app-shell">
	<TopBar
		version={__PKG_VERSION__}
		workspace="dxlbnl"
		project="zod4-mock"
		zodVersion={store.state.world.zodVersion}
		availableZodVersions={store.state.availableZodVersions}
		isZodLoading={store.state.isZodLoading}
		onchangezod={(v) => store.setZodVersion(v)}
		onexport={() => store.setExportOpen(true)}
	/>

	<div class="main-layout" class:mobile-editor={store.state.ui.activeMobileTab === 'editor'} class:mobile-output={store.state.ui.activeMobileTab === 'output'}>
		<div class="rail-column column">
			<LeftRail />
		</div>

		<div class="builder-column column">
			<SchemaEditor
				title={store.builderTitle}
				schema={store.activeSchema}
				schemas={store.state.schemas}
				{selectedFieldId}
				onselectfield={(id) => (selectedFieldId = id)}

				world={store.state.world}
				activeSchemaId={store.state.activeSchemaId}
				availableZodVersions={store.state.availableZodVersions}
			/>
		</div>

		<div class="output-column column">
			<OutputPane
				bind:activeTab={store.state.ui.outputTab}
				{selectedFieldId}
			/>
		</div>
	</div>

	<MobileTabBar 
		activeTab={store.state.ui.activeMobileTab as any} 
		onchange={(tab) => store.setMobileTab(tab)} 
	/>

	<ExportSheet
		open={store.state.ui.exportOpen}
		onclose={() => store.setExportOpen(false)}
		oncopy={handleCopyExport}
		ondownload={handleDownload}
		meta={`single file · world.ts · ${exportLineCount(store.state)} lines`}
	>
		<ExportContent lines={output.exportLines} />
	</ExportSheet>
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg-0);
		overflow: hidden;
	}

	.main-layout {
		display: grid;
		grid-template-columns: 264px 1fr 1fr;
		flex: 1;
		min-height: 0;
	}

	.column {
		border-right: 1px solid var(--line);
		overflow: hidden;
	}

	.builder-column {
		overflow-y: auto;
	}

	.output-column {
		border-right: none;
	}

	@media (max-width: 1024px) {
		.main-layout {
			grid-template-columns: 264px 1fr;
		}
		.builder-column, .output-column {
			display: none;
		}
		.main-layout.mobile-editor .builder-column { display: block; }
		.main-layout.mobile-output .output-column { display: block; }
	}

	@media (max-width: 768px) {
		.main-layout {
			grid-template-columns: 1fr;
		}
		.rail-column {
			display: none;
		}
		.column {
			border-right: none;
		}
	}
</style>
