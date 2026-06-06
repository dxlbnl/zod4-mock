<script lang="ts">
	// B103 — Zod v4 Schema Coverage, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/zod4-schema-coverage.md (the §6 hand-authored
	// convention; parity is human-policed). docs/zod4-schema-coverage.md stays canonical.
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
</script>

<DocPage title="Schema Coverage" sidebarGroup="reference" order={3}>
	<p>
		This page catalogs every Zod v4 schema type, modifier, and validator and audits
		<code>zod4-mock</code> for coverage.
	</p>

	<p>Status legend: ✅ supported · ❌ not supported · ⚠️ partial</p>

	<hr />

	<h2>Primitive types</h2>
	<table>
		<thead>
			<tr><th>Schema</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>z.string()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.number()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.boolean()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.bigint()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.date()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.symbol()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.null()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.undefined()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.any()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.unknown()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.never()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.void()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.nan()</code></td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>String validators / formats</h2>
	<p>
		These can be applied as methods on <code>z.string()</code> or as top-level <code>z.*()</code>
		shortcuts.
	</p>

	<h3>Length &amp; pattern</h3>
	<table>
		<thead>
			<tr><th>Validator</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.min(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.max(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.length(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.regex(pattern)</code></td><td>✅</td><td>Supports simple patterns and character sets natively; falls back safely</td></tr>
			<tr><td><code>.includes(str)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.startsWith(str)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.endsWith(str)</code></td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<h3>Case / normalization transforms</h3>
	<table>
		<thead>
			<tr><th>Validator</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.trim()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.toLowerCase()</code> / <code>.lowercase()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.toUpperCase()</code> / <code>.uppercase()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.normalize()</code></td><td>❌</td><td>Unicode normalization</td></tr>
		</tbody>
	</table>

	<h3>Semantic formats</h3>
	<table>
		<thead>
			<tr><th>Format</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.email()</code> / <code>z.email()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.url()</code> / <code>z.url()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.httpUrl()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.uuid()</code> / <code>z.uuid()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.uuidv4()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.uuidv6()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.uuidv7()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.uuidv8()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.guid()</code></td><td>✅</td><td>alias for uuid</td></tr>
			<tr><td><code>.ip()</code> / <code>z.ip()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.ipv4()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.ipv6()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.cidr()</code> / <code>z.cidrv4()</code> / <code>z.cidrv6()</code></td><td>✅</td><td>cidrv4 and cidrv6 supported</td></tr>
			<tr><td><code>.e164()</code> / <code>z.e164()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.emoji()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.base64()</code> / <code>z.base64()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.base64url()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.hex()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.jwt()</code> / <code>z.jwt()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.nanoid()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.cuid()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.cuid2()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.ulid()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.mac()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.hostname()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.hash()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.stringbool()</code></td><td>❌</td><td></td></tr>
		</tbody>
	</table>

	<h3>ISO date/time formats</h3>
	<table>
		<thead>
			<tr><th>Format</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>z.iso.date()</code></td><td>✅</td><td><code>YYYY-MM-DD</code></td></tr>
			<tr><td><code>z.iso.time()</code></td><td>✅</td><td><code>HH:MM:SS[.ms]</code></td></tr>
			<tr><td><code>z.iso.datetime()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.iso.duration()</code></td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Number validators</h2>
	<table>
		<thead>
			<tr><th>Validator</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.gt(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.gte(n)</code> / <code>.min(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.lt(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.lte(n)</code> / <code>.max(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.positive()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.nonnegative()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.negative()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.nonpositive()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.multipleOf(n)</code> / <code>.step(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.int()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.finite()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.safe()</code></td><td>⚠️</td><td>Handled contextually</td></tr>
		</tbody>
	</table>

	<h3>Numeric format schemas (top-level)</h3>
	<table>
		<thead>
			<tr><th>Schema</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>z.int()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.float32()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.float64()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.int32()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.uint32()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.int64()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.uint64()</code></td><td>❌</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>BigInt validators</h2>
	<table>
		<thead>
			<tr><th>Validator</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.gt(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.gte(n)</code> / <code>.min(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.lt(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.lte(n)</code> / <code>.max(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.positive()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.nonnegative()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.negative()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.nonpositive()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.multipleOf(n)</code></td><td>❌</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Collection types</h2>

	<h3><code>z.array(schema)</code></h3>
	<table>
		<thead>
			<tr><th>Modifier</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.min(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.max(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.length(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.nonempty()</code></td><td>❌</td><td></td></tr>
		</tbody>
	</table>

	<h3><code>z.tuple([...schemas])</code></h3>
	<table>
		<thead>
			<tr><th>Feature</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td>Fixed-length tuples</td><td>✅</td><td></td></tr>
			<tr><td><code>.rest(schema)</code></td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<h3><code>z.object({'{...}'})</code></h3>
	<table>
		<thead>
			<tr><th>Method</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.extend({'{...}'})</code> / <code>.safeExtend()</code></td><td>✅</td><td>Handled generically via def parsing</td></tr>
			<tr><td><code>.merge(schema)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.pick({'{...}'})</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.omit({'{...}'})</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.partial()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.partial({'{...}'})</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.required()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.deepPartial()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.keyof()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.catchall(schema)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.strict()</code> / <code>z.strictObject()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.passthrough()</code> / <code>z.looseObject()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.strip()</code></td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<h3><code>z.record(keySchema, valueSchema)</code></h3>
	<table>
		<thead>
			<tr><th>Variant</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>z.record(valueSchema)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.record(keySchema, valueSchema)</code></td><td>✅</td><td>When <code>keySchema</code> is a finite-key type (<code>z.enum([...])</code>), the record is exhausted: one entry per enum member in declared order, so the output satisfies Zod's strict-key inferred type. Open-key <code>z.string()</code> / <code>z.number()</code> <code>keySchema</code>s keep the 2–5 random-key shape.</td></tr>
			<tr><td><code>z.partialRecord(keySchema, valueSchema)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.looseRecord()</code></td><td>❌</td><td></td></tr>
		</tbody>
	</table>

	<h3><code>z.map(keySchema, valueSchema)</code></h3>
	<table>
		<thead>
			<tr><th>Feature</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td>Basic Map</td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<h3><code>z.set(schema)</code></h3>
	<table>
		<thead>
			<tr><th>Modifier</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.min(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.max(n)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.size(n)</code></td><td>✅</td><td>Handled generically</td></tr>
			<tr><td><code>.nonempty()</code></td><td>❌</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Enum and literal types</h2>
	<table>
		<thead>
			<tr><th>Schema</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>z.enum([...values])</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.enum().extract([...])</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.enum().exclude([...])</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.nativeEnum(TsEnum)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>z.literal(value)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.literal([...values])</code></td><td>❌</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Union and composition types</h2>
	<table>
		<thead>
			<tr><th>Schema</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>z.union([...schemas])</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.discriminatedUnion(key, [...schemas])</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.intersection(a, b)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.pipe(a, b)</code></td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Special / advanced types</h2>
	<table>
		<thead>
			<tr><th>Schema</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>z.templateLiteral([...parts])</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.lazy(() => schema)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>z.instanceof(Class)</code></td><td>❌</td><td>Throws UnsupportedSchemaError</td></tr>
			<tr><td><code>z.custom(fn)</code></td><td>❌</td><td>Throws UnsupportedSchemaError</td></tr>
			<tr><td><code>z.file()</code></td><td>❌</td><td>Throws UnsupportedSchemaError</td></tr>
			<tr><td><code>z.function()</code></td><td>❌</td><td>Throws UnsupportedSchemaError</td></tr>
			<tr><td><code>z.json()</code></td><td>✅</td><td>Generates valid JSON</td></tr>
			<tr><td><code>z.xor(a, b)</code></td><td>✅</td><td>Generates from left or right</td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Universal schema methods</h2>
	<p>These apply to every schema.</p>
	<table>
		<thead>
			<tr><th>Method</th><th>Status</th><th>Notes</th></tr>
		</thead>
		<tbody>
			<tr><td><code>.optional()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.nullable()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.nullish()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.default(value)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.prefault(value)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.catch(value)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.brand&lt;T&gt;()</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.readonly()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.array()</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.promise()</code></td><td>✅</td><td>Returns undefined</td></tr>
			<tr><td><code>.or(schema)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.and(schema)</code></td><td>✅</td><td></td></tr>
			<tr><td><code>.refine(fn, msg?)</code></td><td>❌</td><td>Runtime validation only</td></tr>
			<tr><td><code>.superRefine(fn)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.check(fn)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.transform(fn)</code></td><td>❌</td><td>Runtime mapping only</td></tr>
			<tr><td><code>.overwrite(fn)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.preprocess(fn, schema)</code></td><td>❌</td><td></td></tr>
			<tr><td><code>.pipe(schema)</code></td><td>✅</td><td></td></tr>
		</tbody>
	</table>

	<hr />

	<h2>Sources</h2>
	<ul>
		<li><a href="https://zod.dev/v4">Zod v4 release notes</a></li>
		<li><a href="https://zod.dev/api">Zod API reference</a></li>
		<li><a href="https://zod.dev/packages/zod">Zod packages/zod</a></li>
	</ul>
</DocPage>
