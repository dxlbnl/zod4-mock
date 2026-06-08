<script lang="ts">
	// B103 — Zod v4 Schema Coverage, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/zod4-schema-coverage.md (the §6 hand-authored
	// convention; parity is human-policed). docs/zod4-schema-coverage.md stays canonical.
	//
	// B132 — the 18 status <table>s (Schema → Status → Notes) are replaced by the
	// non-table <CoverageList> pip-list (no <table> in the docs site). Each
	// section's rows map to a CoverageItem[]: ✅ → supported, ❌ → unsupported,
	// ⚠️ / "partial" → partial; the Notes cell → note (surfaced inline per row).
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import CoverageList, {
		type CoverageItem
	} from '$lib/docs/widgets/CoverageList.svelte';

	const primitives: CoverageItem[] = [
		{ schema: 'z.string()', status: 'supported' },
		{ schema: 'z.number()', status: 'supported' },
		{ schema: 'z.boolean()', status: 'supported' },
		{ schema: 'z.bigint()', status: 'supported' },
		{ schema: 'z.date()', status: 'supported' },
		{ schema: 'z.symbol()', status: 'supported' },
		{ schema: 'z.null()', status: 'supported' },
		{ schema: 'z.undefined()', status: 'supported' },
		{ schema: 'z.any()', status: 'supported' },
		{ schema: 'z.unknown()', status: 'supported' },
		{ schema: 'z.never()', status: 'supported' },
		{ schema: 'z.void()', status: 'supported' },
		{ schema: 'z.nan()', status: 'supported' }
	];

	const stringLengthPattern: CoverageItem[] = [
		{ schema: '.min(n)', status: 'supported' },
		{ schema: '.max(n)', status: 'supported' },
		{ schema: '.length(n)', status: 'supported' },
		{
			schema: '.regex(pattern)',
			status: 'supported',
			note: 'Supports simple patterns and character sets natively; falls back safely'
		},
		{ schema: '.includes(str)', status: 'supported' },
		{ schema: '.startsWith(str)', status: 'supported' },
		{ schema: '.endsWith(str)', status: 'supported' }
	];

	const stringCase: CoverageItem[] = [
		{ schema: '.trim()', status: 'supported' },
		{ schema: '.toLowerCase() / .lowercase()', status: 'supported' },
		{ schema: '.toUpperCase() / .uppercase()', status: 'supported' },
		{ schema: '.normalize()', status: 'unsupported', note: 'Unicode normalization' }
	];

	const stringFormats: CoverageItem[] = [
		{ schema: '.email() / z.email()', status: 'supported' },
		{ schema: '.url() / z.url()', status: 'supported' },
		{ schema: 'z.httpUrl()', status: 'unsupported' },
		{ schema: '.uuid() / z.uuid()', status: 'supported' },
		{ schema: 'z.uuidv4()', status: 'supported' },
		{ schema: 'z.uuidv6()', status: 'unsupported' },
		{ schema: 'z.uuidv7()', status: 'unsupported' },
		{ schema: 'z.uuidv8()', status: 'unsupported' },
		{ schema: 'z.guid()', status: 'supported', note: 'alias for uuid' },
		{ schema: '.ip() / z.ip()', status: 'unsupported' },
		{ schema: 'z.ipv4()', status: 'unsupported' },
		{ schema: 'z.ipv6()', status: 'unsupported' },
		{
			schema: 'z.cidr() / z.cidrv4() / z.cidrv6()',
			status: 'supported',
			note: 'cidrv4 and cidrv6 supported'
		},
		{ schema: '.e164() / z.e164()', status: 'supported' },
		{ schema: '.emoji()', status: 'supported' },
		{ schema: '.base64() / z.base64()', status: 'supported' },
		{ schema: 'z.base64url()', status: 'supported' },
		{ schema: '.hex()', status: 'unsupported' },
		{ schema: '.jwt() / z.jwt()', status: 'supported' },
		{ schema: '.nanoid()', status: 'supported' },
		{ schema: '.cuid()', status: 'supported' },
		{ schema: '.cuid2()', status: 'supported' },
		{ schema: '.ulid()', status: 'supported' },
		{ schema: '.mac()', status: 'unsupported' },
		{ schema: '.hostname()', status: 'supported' },
		{ schema: '.hash()', status: 'unsupported' },
		{ schema: 'z.stringbool()', status: 'unsupported' }
	];

	const isoFormats: CoverageItem[] = [
		{ schema: 'z.iso.date()', status: 'supported', note: 'YYYY-MM-DD' },
		{ schema: 'z.iso.time()', status: 'supported', note: 'HH:MM:SS[.ms]' },
		{ schema: 'z.iso.datetime()', status: 'supported' },
		{ schema: 'z.iso.duration()', status: 'supported' }
	];

	const numberValidators: CoverageItem[] = [
		{ schema: '.gt(n)', status: 'supported' },
		{ schema: '.gte(n) / .min(n)', status: 'supported' },
		{ schema: '.lt(n)', status: 'supported' },
		{ schema: '.lte(n) / .max(n)', status: 'supported' },
		{ schema: '.positive()', status: 'unsupported' },
		{ schema: '.nonnegative()', status: 'unsupported' },
		{ schema: '.negative()', status: 'unsupported' },
		{ schema: '.nonpositive()', status: 'unsupported' },
		{ schema: '.multipleOf(n) / .step(n)', status: 'supported' },
		{ schema: '.int()', status: 'supported' },
		{ schema: '.finite()', status: 'unsupported' },
		{ schema: '.safe()', status: 'partial', note: 'Handled contextually' }
	];

	const numberFormats: CoverageItem[] = [
		{ schema: 'z.int()', status: 'supported' },
		{ schema: 'z.float32()', status: 'unsupported' },
		{ schema: 'z.float64()', status: 'unsupported' },
		{ schema: 'z.int32()', status: 'supported' },
		{ schema: 'z.uint32()', status: 'unsupported' },
		{ schema: 'z.int64()', status: 'unsupported' },
		{ schema: 'z.uint64()', status: 'unsupported' }
	];

	const bigintValidators: CoverageItem[] = [
		{ schema: '.gt(n)', status: 'supported' },
		{ schema: '.gte(n) / .min(n)', status: 'supported' },
		{ schema: '.lt(n)', status: 'supported' },
		{ schema: '.lte(n) / .max(n)', status: 'supported' },
		{ schema: '.positive()', status: 'unsupported' },
		{ schema: '.nonnegative()', status: 'unsupported' },
		{ schema: '.negative()', status: 'unsupported' },
		{ schema: '.nonpositive()', status: 'unsupported' },
		{ schema: '.multipleOf(n)', status: 'unsupported' }
	];

	const arrayModifiers: CoverageItem[] = [
		{ schema: '.min(n)', status: 'supported' },
		{ schema: '.max(n)', status: 'supported' },
		{ schema: '.length(n)', status: 'supported' },
		{ schema: '.nonempty()', status: 'unsupported' }
	];

	const tupleFeatures: CoverageItem[] = [
		{ schema: 'Fixed-length tuples', status: 'supported' },
		{ schema: '.rest(schema)', status: 'supported' }
	];

	const objectMethods: CoverageItem[] = [
		{
			schema: '.extend({...}) / .safeExtend()',
			status: 'supported',
			note: 'Handled generically via def parsing'
		},
		{ schema: '.merge(schema)', status: 'supported' },
		{ schema: '.pick({...})', status: 'supported' },
		{ schema: '.omit({...})', status: 'supported' },
		{ schema: '.partial()', status: 'supported' },
		{ schema: '.partial({...})', status: 'supported' },
		{ schema: '.required()', status: 'supported' },
		{ schema: '.deepPartial()', status: 'supported' },
		{ schema: '.keyof()', status: 'supported' },
		{ schema: '.catchall(schema)', status: 'unsupported' },
		{ schema: '.strict() / z.strictObject()', status: 'supported' },
		{ schema: '.passthrough() / z.looseObject()', status: 'supported' },
		{ schema: '.strip()', status: 'supported' }
	];

	const recordVariants: CoverageItem[] = [
		{ schema: 'z.record(valueSchema)', status: 'supported' },
		{
			schema: 'z.record(keySchema, valueSchema)',
			status: 'supported',
			note: 'When keySchema is a finite-key type (z.enum([...])), the record is exhausted: one entry per enum member in declared order, so the output satisfies Zod’s strict-key inferred type. Open-key z.string() / z.number() keySchemas keep the 2–5 random-key shape.'
		},
		{ schema: 'z.partialRecord(keySchema, valueSchema)', status: 'unsupported' },
		{ schema: 'z.looseRecord()', status: 'unsupported' }
	];

	const mapFeatures: CoverageItem[] = [{ schema: 'Basic Map', status: 'supported' }];

	const setModifiers: CoverageItem[] = [
		{ schema: '.min(n)', status: 'supported' },
		{ schema: '.max(n)', status: 'supported' },
		{ schema: '.size(n)', status: 'supported', note: 'Handled generically' },
		{ schema: '.nonempty()', status: 'unsupported' }
	];

	const enumLiteral: CoverageItem[] = [
		{ schema: 'z.enum([...values])', status: 'supported' },
		{ schema: 'z.enum().extract([...])', status: 'supported' },
		{ schema: 'z.enum().exclude([...])', status: 'supported' },
		{ schema: 'z.nativeEnum(TsEnum)', status: 'unsupported' },
		{ schema: 'z.literal(value)', status: 'supported' },
		{ schema: 'z.literal([...values])', status: 'unsupported' }
	];

	const unionComposition: CoverageItem[] = [
		{ schema: 'z.union([...schemas])', status: 'supported' },
		{ schema: 'z.discriminatedUnion(key, [...schemas])', status: 'supported' },
		{ schema: 'z.intersection(a, b)', status: 'supported' },
		{ schema: 'z.pipe(a, b)', status: 'supported' }
	];

	const specialAdvanced: CoverageItem[] = [
		{ schema: 'z.templateLiteral([...parts])', status: 'supported' },
		{ schema: 'z.lazy(() => schema)', status: 'supported' },
		{ schema: 'z.instanceof(Class)', status: 'unsupported', note: 'Throws UnsupportedSchemaError' },
		{ schema: 'z.custom(fn)', status: 'unsupported', note: 'Throws UnsupportedSchemaError' },
		{ schema: 'z.file()', status: 'unsupported', note: 'Throws UnsupportedSchemaError' },
		{ schema: 'z.function()', status: 'unsupported', note: 'Throws UnsupportedSchemaError' },
		{ schema: 'z.json()', status: 'supported', note: 'Generates valid JSON' },
		{ schema: 'z.xor(a, b)', status: 'supported', note: 'Generates from left or right' }
	];

	const universalMethods: CoverageItem[] = [
		{ schema: '.optional()', status: 'supported' },
		{ schema: '.nullable()', status: 'supported' },
		{ schema: '.nullish()', status: 'supported' },
		{ schema: '.default(value)', status: 'supported' },
		{ schema: '.prefault(value)', status: 'unsupported' },
		{ schema: '.catch(value)', status: 'supported' },
		{ schema: '.brand<T>()', status: 'unsupported' },
		{ schema: '.readonly()', status: 'supported' },
		{ schema: '.array()', status: 'supported' },
		{ schema: '.promise()', status: 'supported', note: 'Returns undefined' },
		{ schema: '.or(schema)', status: 'supported' },
		{ schema: '.and(schema)', status: 'supported' },
		{ schema: '.refine(fn, msg?)', status: 'unsupported', note: 'Runtime validation only' },
		{ schema: '.superRefine(fn)', status: 'unsupported' },
		{ schema: '.check(fn)', status: 'unsupported' },
		{ schema: '.transform(fn)', status: 'unsupported', note: 'Runtime mapping only' },
		{ schema: '.overwrite(fn)', status: 'unsupported' },
		{ schema: '.preprocess(fn, schema)', status: 'unsupported' },
		{ schema: '.pipe(schema)', status: 'supported' }
	];
</script>

<DocPage title="Schema Coverage" sidebarGroup="reference" order={3}>
	<p>
		This page catalogs every Zod v4 schema type, modifier, and validator and audits
		<code>zod4-mock</code> for coverage.
	</p>

	<p>Status legend: ✅ supported · ❌ not supported · ⚠️ partial</p>

	<hr />

	<h2>Primitive types</h2>
	<CoverageList items={primitives} />

	<hr />

	<h2>String validators / formats</h2>
	<p>
		These can be applied as methods on <code>z.string()</code> or as top-level <code>z.*()</code>
		shortcuts.
	</p>

	<h3>Length &amp; pattern</h3>
	<CoverageList items={stringLengthPattern} />

	<h3>Case / normalization transforms</h3>
	<CoverageList items={stringCase} />

	<h3>Semantic formats</h3>
	<CoverageList items={stringFormats} />

	<h3>ISO date/time formats</h3>
	<CoverageList items={isoFormats} />

	<hr />

	<h2>Number validators</h2>
	<CoverageList items={numberValidators} />

	<h3>Numeric format schemas (top-level)</h3>
	<CoverageList items={numberFormats} />

	<hr />

	<h2>BigInt validators</h2>
	<CoverageList items={bigintValidators} />

	<hr />

	<h2>Collection types</h2>

	<h3><code>z.array(schema)</code></h3>
	<CoverageList items={arrayModifiers} />

	<h3><code>z.tuple([...schemas])</code></h3>
	<CoverageList items={tupleFeatures} />

	<h3><code>z.object({'{...}'})</code></h3>
	<CoverageList items={objectMethods} />

	<h3><code>z.record(keySchema, valueSchema)</code></h3>
	<CoverageList items={recordVariants} />

	<h3><code>z.map(keySchema, valueSchema)</code></h3>
	<CoverageList items={mapFeatures} />

	<h3><code>z.set(schema)</code></h3>
	<CoverageList items={setModifiers} />

	<hr />

	<h2>Enum and literal types</h2>
	<CoverageList items={enumLiteral} />

	<hr />

	<h2>Union and composition types</h2>
	<CoverageList items={unionComposition} />

	<hr />

	<h2>Special / advanced types</h2>
	<CoverageList items={specialAdvanced} />

	<hr />

	<h2>Universal schema methods</h2>
	<p>These apply to every schema.</p>
	<CoverageList items={universalMethods} />

	<hr />

	<h2>Sources</h2>
	<ul>
		<li><a href="https://zod.dev/v4">Zod v4 release notes</a></li>
		<li><a href="https://zod.dev/api">Zod API reference</a></li>
		<li><a href="https://zod.dev/packages/zod">Zod packages/zod</a></li>
	</ul>
</DocPage>
