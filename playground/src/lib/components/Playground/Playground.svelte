<script lang="ts">
	import TopBar from "$lib/components/Surfaces/TopBar.svelte";
	import LeftRail from "./Sidebar/LeftRail.svelte";
	import SchemaEditor from "./Editor/index.svelte";
	import OutputPane from "./Output/OutputPane.svelte";
	import ExportSheet from "$lib/components/Surfaces/ExportSheet.svelte";
	import ExportContent from "./Output/ExportContent.svelte";

	import { untrack, onMount } from "svelte";
	import { createPlaygroundState } from "$lib/state.svelte";
	import {
		generateTokenizedCode,
		generateTokenizedData,
		generateTokenizedWorldData,
		generateSubjectCode,
		generateFullExport,
		exportLineCount,
	} from "$lib/codegen";
	import {
		generateSubjectData,
		generateWorldData,
		buildWorld,
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
	const activeEntityType = $derived(store.state.activeEntityType);
	const activeFields = $derived(store.activeFields);
	const builderTitle = $derived(store.builderTitle);

	// Active entity helper — used in builder callbacks
	const entityId = $derived(
		activeEntityType === "subject"
			? store.activeSubject?.id
			: store.activeSchema?.id,
	);

	const codeLines = $derived.by(() => {
		if (activeEntityType === "subject" && store.activeSubject) {
			return generateTokenizedCode(
				store.activeSubject,
				store.state.relationships,
			);
		}
		if (activeEntityType === "schema" && store.activeSchema) {
			return generateTokenizedCode(
				{
					...store.activeSchema,
					count: 0,
				} as any,
				[],
			);
		}
		return [];
	});

	// Mock data generation
	const generationResult = $derived.by(() => {
		if (activeEntityType === "subject" && store.activeSubject) {
			return generateSubjectData(store.state, store.activeSubject.id);
		}
		if (activeEntityType === "schema" && store.activeSchema) {
			try {
				const { world, schemaMap } = buildWorld(store.state);
				const apiSchema = schemaMap.get(store.activeSchema.id);
				if (!apiSchema) return { ok: false, error: "Schema not found in world map" };

				const data = world.generate(
					store.state.z.array(apiSchema).length(3),
				) as unknown[];
				return { ok: true, data };
			} catch (e) {
				return { ok: false, error: e instanceof Error ? e.message : String(e) };
			}
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
			? generateTokenizedWorldData(
					worldResult.data as Record<string, any[]>,
				)
			: [],
	);

	// Export logic
	const fullExportCode = $derived(generateFullExport(store.state));
	const exportLines = $derived.by(() => {
		// We'd need a full tokenized version of the export
		// For now, let's just show the raw lines with basic highlighting
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

	<div class="main-layout">
		<div class="rail-column">
			<LeftRail {store} />
		</div>

		<div class="builder-column">
			<SchemaEditor
				title={builderTitle}
				fields={activeFields}
				{selectedFieldId}
				{activeEntityType}
				subjects={store.state.subjects}
				relationships={store.state.relationships}
				activeBinding={store.activeBinding}
				onbindschema={(sid) =>
					store.bindSchemaToSubject(store.state.activeSchemaId!, sid)}
				onsetmapping={(fk, sk) =>
					store.setFieldMapping(store.state.activeSchemaId!, fk, sk)}
				onremovemapping={(fk) =>
					store.removeFieldMapping(store.state.activeSchemaId!, fk)}
				onupdaterelationmapping={(fid, rid) =>
					entityId &&
					store.setRelationMapping(activeEntityType, entityId, fid, rid)}
				onselectfield={(id) => (selectedFieldId = id)}
				onaddfield={(pid) =>
					(entityId
						? store.addField(activeEntityType, entityId, pid)
						: null) ?? undefined}
				onupdatefield={(id, p) =>
					entityId &&
					store.updateField(activeEntityType, entityId, id, p)}
				onremovefield={(id) =>
					entityId &&
					store.removeField(activeEntityType, entityId, id)}
				onaddmodifier={(id, m) =>
					entityId &&
					store.addModifier(activeEntityType, entityId, id, m)}
				onupdatemodifier={(id, idx, val) =>
					entityId &&
					store.updateModifierValue(
						activeEntityType,
						entityId,
						id,
						idx,
						val,
					)}
				onremovemodifier={(fid, mid) =>
					entityId &&
					store.removeModifier(activeEntityType, entityId, fid, mid)}
				onupdateenumvalues={(id, vals) =>
					entityId &&
					store.updateField(activeEntityType, entityId, id, {
						enumValues: vals,
					})}
				onupdatetitle={(val) => {
					if (activeEntityType === "subject" && store.activeSubject) {
						store.renameSubject(store.activeSubject.id, val);
					} else if (
						activeEntityType === "schema" &&
						store.activeSchema
					) {
						store.renameSchema(store.activeSchema.id, val);
					}
				}}
			/>
		</div>

		<div class="output-column">
			<OutputPane
				bind:activeTab={store.state.ui.outputTab}
				{codeLines}
				{dataLines}
				{worldLines}
				fullCode={store.activeSubject
					? generateSubjectCode(
							store.activeSubject,
							store.state.relationships,
						)
					: ""}
				fullData={generationResult.ok
					? JSON.stringify(generationResult.data, null, 2)
					: ""}
				fullWorld={worldResult.ok
					? JSON.stringify(worldResult.data, null, 2)
					: ""}
				{selectedFieldId}
				onchangetab={(tab) => store.setOutputTab(tab)}
			/>
		</div>
	</div>

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

	.rail-column {
		border-right: 1px solid var(--line);
		overflow: hidden;
	}

	.builder-column {
		border-right: 1px solid var(--line);
		overflow-y: auto;
	}

	.output-column {
		overflow: hidden;
	}
</style>
