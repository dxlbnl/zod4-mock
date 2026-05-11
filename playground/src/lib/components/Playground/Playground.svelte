<script lang="ts">
	import TopBar from "$lib/components/Surfaces/TopBar.svelte";
	import LeftRail from "./Sidebar/LeftRail.svelte";
	import SchemaEditor from "./Editor/index.svelte";
	import OutputPane from "./Output/OutputPane.svelte";
	import ExportSheet from "$lib/components/Surfaces/ExportSheet.svelte";
	import ExportContent from "./Output/ExportContent.svelte";
	import MobileTabBar from "./MobileTabBar.svelte";

	import { untrack, onMount } from "svelte";
	import { createPlaygroundState } from "$lib/state.svelte";
	import {
		generateTokenizedCode,
		generateTokenizedData,
		generateTokenizedWorldData,
		generateFullExport,
		generateSchemaCode,
		exportLineCount,
	} from "$lib/codegen";
	import {
		generateSchemaPreview,
		generateWorldData,
	} from "$lib/schema-builder";

	interface Props {
		initialState?: any;
	}

	let { initialState = undefined }: Props = $props();

	// Initialize store
	const store = createPlaygroundState(untrack(() => initialState));

	onMount(() => {
		store.fetchAvailableZodVersions();
	});

	// Track selection
	let selectedFieldId = $state<string | null>(null);

	// Derived values
	const activeSchema = $derived(store.activeSchema);
	const activeFields = $derived(store.activeFields);
	const builderTitle = $derived(store.builderTitle);

	const codeLines = $derived.by(() => {
		if (activeSchema) {
			return generateTokenizedCode(activeSchema);
		}
		return [];
	});

	// Mock data generation
	const generationResult = $derived.by(() => {
		if (activeSchema) {
			return generateSchemaPreview(store.state, activeSchema.id);
		}
		return { ok: false };
	});

	const dataLines = $derived(
		generationResult.ok && activeFields.length > 0
			? generateTokenizedData(generationResult.data, activeFields)
			: [],
	);

	// World generation
	const worldResult = $derived(generateWorldData(store.state));
	const worldLines = $derived(
		worldResult.ok
			? generateTokenizedWorldData(worldResult.data as Record<string, any[]>)
			: [],
	);

	// Export logic
	const fullExportCode = $derived(generateFullExport(store.state));
	const exportLines = $derived.by(() => {
		return fullExportCode.split("\n").map((text, i) => ({
			lineNumber: i + 1,
			tokens: [{ kind: "plain" as const, text }],
		}));
	});

	function handleCopyExport() {
		navigator.clipboard.writeText(fullExportCode);
	}

	function handleDownload() {
		const blob = new Blob([fullExportCode], { type: "text/typescript" });
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
			<LeftRail {store} />
		</div>

		<div class="builder-column column">
			<SchemaEditor
				title={builderTitle}
				schema={activeSchema}
				schemas={store.state.schemas}
				{selectedFieldId}
				onselectfield={(id) => (selectedFieldId = id)}
				onaddfield={(pid) => activeSchema ? (store.addField(activeSchema.id, pid) ?? undefined) : undefined}
				onupdatefield={(id, p) => activeSchema && store.updateField(activeSchema.id, id, p)}
				onremovefield={(id) => activeSchema && store.removeField(activeSchema.id, id)}
				onaddmodifier={(id, m) => activeSchema && store.addModifier(activeSchema.id, id, m)}
				onupdatemodifier={(id, idx, val) => activeSchema && store.updateModifierValue(activeSchema.id, id, idx, val)}
				onremovemodifier={(fid, mid) => activeSchema && store.removeModifier(activeSchema.id, fid, mid)}
				onupdateenumvalues={(id, vals) => activeSchema && store.updateField(activeSchema.id, id, { enumValues: vals })}
				onupdatetitle={(val) => activeSchema && store.renameSchema(activeSchema.id, val)}
				onupdatepopulate={(val) => activeSchema && store.setPopulateCount(activeSchema.id, val)}
				onupdatederived={(val) => activeSchema && store.setDerivedFrom(activeSchema.id, val)}
				onaddrelation={(target, name) => activeSchema && store.addSchemaRelation(activeSchema.id, target, name)}
				onremoverelation={(name) => activeSchema && store.removeSchemaRelation(activeSchema.id, name)}

				world={store.state.world}
				onupdateseed={(v) => store.setWorldSeed(v)}
				onupdateprob={(v) => store.setOptionalProbability(v)}

				activeSchemaId={store.state.activeSchemaId}
				onaddschema={() => store.addSchema('NewSchema')}
				onselectschema={(id) => store.setActiveSchema(id)}
			/>
		</div>

		<div class="output-column column">
			<OutputPane
				bind:activeTab={store.state.ui.outputTab}
				{codeLines}
				{dataLines}
				{worldLines}
				fullCode={activeSchema ? generateSchemaCode(activeSchema) : ""}
				fullData={generationResult.ok ? JSON.stringify(generationResult.data, null, 2) : ""}
				fullWorld={worldResult.ok ? JSON.stringify(worldResult.data, null, 2) : ""}
				{selectedFieldId}
				onchangetab={(tab) => store.setOutputTab(tab)}
			/>
		</div>
	</div>

	<MobileTabBar 
		activeTab={store.state.ui.activeMobileTab} 
		onchange={(tab) => store.setMobileTab(tab)} 
	/>

	<ExportSheet
		open={store.state.ui.exportOpen}
		onclose={() => store.setExportOpen(false)}
		oncopy={handleCopyExport}
		ondownload={handleDownload}
		meta={`single file · world.ts · ${exportLineCount(store.state)} lines`}
	>
		<ExportContent lines={exportLines} />
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
		.output-column {
			display: none;
		}
	}

	@media (max-width: 768px) {
		.main-layout {
			grid-template-columns: 1fr;
		}
		.column {
			display: none;
			border-right: none;
		}
		.main-layout.mobile-editor .builder-column { display: block; }
		.main-layout.mobile-output .output-column { display: block; }
	}
</style>
