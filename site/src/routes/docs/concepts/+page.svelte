<script lang="ts">
	// B101 — Concepts, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/concepts.md (the §6 hand-authored
	// convention; parity is human-policed). docs/concepts.md stays canonical.
	// Each major concept is introduced via <DefRef term=…> so it enters the
	// B104 Pagefind concept index (data-pagefind-meta="concept:<term>").
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import DefRef from '$lib/docs/widgets/DefRef.svelte';
</script>

<DocPage title="Concepts" sidebarGroup="concepts" order={2}>
	<p>
		The mental model behind <code>zod4-mock</code>. Read this once and the API will feel obvious.
	</p>

	<hr />

	<h2>World</h2>
	<p>
		A <DefRef term="world">world</DefRef> is a seeded generation session. It holds the PRNG, the
		registry, and all schema registrations.
	</p>

	<pre><code>{`const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, { relations: { author: PersonSchema } });`}</code></pre>

	<p>
		One world = one seed = one deterministic dataset. All schemas registered on a world share the
		same PRNG state and registry, which is what makes cross-schema consistency possible.
	</p>

	<h3>Options</h3>
	<table>
		<thead>
			<tr>
				<th>Option</th>
				<th>Type</th>
				<th>Default</th>
				<th>Description</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>seed</code></td>
				<td><code>number</code></td>
				<td><em>(required)</em></td>
				<td>Master seed. Same seed → same output.</td>
			</tr>
			<tr>
				<td><code>locale</code></td>
				<td><code>LocaleData</code></td>
				<td>minimal <code>en</code></td>
				<td>
					Active locale. Defaults to a built-in minimal English locale; import a richer one from
					<code>@zod4-mock/locale-en</code> / <code>@zod4-mock/locale-nl</code>. See
					<a href="#localization">Localization</a>.
				</td>
			</tr>
			<tr>
				<td><code>optionalProbability</code></td>
				<td><code>number</code></td>
				<td><code>0.2</code></td>
				<td>Chance that <code>z.optional()</code> / <code>z.nullable()</code> fields are omitted.</td>
			</tr>
			<tr>
				<td><code>defaultArrayLength</code></td>
				<td><code>[number, number]</code></td>
				<td><code>[1, 5]</code></td>
				<td>Fallback array length when no <code>.min()</code> / <code>.max()</code> is set.</td>
			</tr>
			<tr>
				<td><code>generators</code></td>
				<td><code>Record&lt;string, KeyGenerator&gt;</code></td>
				<td><code>{'{}'}</code></td>
				<td>Custom key-based generators applied globally.</td>
			</tr>
			<tr>
				<td><code>recursionLimit</code></td>
				<td><code>number</code></td>
				<td><code>8</code></td>
				<td>Max depth for self-referential / recursive schemas.</td>
			</tr>
		</tbody>
	</table>

	<hr />

	<h2>Schemas</h2>
	<p>
		Every schema you register with <code>withSchema</code> is tracked by the world. There are three
		registration modes:
	</p>

	<h3>Primary — identity anchor</h3>
	<pre><code>world.withSchema(PersonSchema);</code></pre>
	<p>
		A primary schema generates independent instances. The world cycles through them
		deterministically as you call <code>generate()</code>. Instances are stored in the registry and
		can be referenced by other schemas.
	</p>

	<h3>Derived — projection of another schema</h3>
	<pre><code>{`world.withSchema(PersonSummarySchema, {
  from: PersonSchema,
  matchers: {
    id: (ctx) => ctx.source.personId,
    name: (ctx) => \`\${ctx.source.firstName} \${ctx.source.lastName}\`,
  },
});`}</code></pre>
	<p>
		<code>from:</code> binds this schema to a primary schema. Each generated instance of
		<code>PersonSummarySchema</code> is a projection of the corresponding <code>PersonSchema</code>
		instance. <code>ctx.source</code> holds the source entity's data.
	</p>

	<h3>Relational — linked to other schemas</h3>
	<pre><code>{`world.withSchema(DocumentSchema, {
  relations: { author: PersonSchema },
  matchers: {
    authorId: (ctx) => ctx.related("author").personId,
  },
});`}</code></pre>
	<p>
		<code>relations</code> declares which other schemas this one references.
		<code>ctx.related("author")</code> resolves to the data of a specific instance of
		<code>PersonSchema</code>.
	</p>

	<p>
		All three modes can be combined — a schema can have both <code>from</code> and
		<code>relations</code>.
	</p>

	<hr />

	<h2>The generation pipeline</h2>
	<p>
		For every field in a schema, values are resolved in this priority order — the seven named steps
		of the canonical <code>PIPELINE</code> list in <code>src/pipeline.ts</code>. The first step that
		produces a value wins:
	</p>
	<ol start="0">
		<li>
			<strong>Eager overrides</strong> — <code>options.overrides</code> primitive/array entries land
			in <code>ctx.current</code> so sibling matchers can read them via
			<code>ctx.current.&lt;sibling&gt;</code>.
		</li>
		<li>
			<strong>Matchers</strong> — user functions from <code>withSchema({'{'} matchers {'}'})</code>.
			Explicit per-field functions; first to win.
		</li>
		<li>
			<strong>Per-schema key map</strong> — entries from <code>withKeyMap({'{ ... }'})</code> matched
			on the field name.
		</li>
		<li>
			<strong>Unwrap optional</strong> — strip <code>optional</code>/<code>nullable</code>/<code
				>default</code
			> and roll absent per layer; sets <code>ctx.inner</code> for downstream steps. Internal — does
			not produce a final value on its own.
		</li>
		<li>
			<strong>World-level custom generators</strong> — entries from
			<code>withGenerators({'{ ... }'})</code> matched on the field name.
		</li>
		<li>
			<strong>Key-based heuristics</strong> — built-in <code>DEFAULT_KEY_MAP</code> exact-key +
			<code>DEFAULT_KEY_PATTERNS</code> regex matches. <code>email</code> → realistic email,
			<code>firstName</code> → first name, <code>createdAt</code> → date.
			<a href="/docs/key-heuristics">Full list →</a>
		</li>
		<li>
			<strong>Schema-based fallback</strong> — Zod type introspection. <code>z.enum([...])</code> →
			random member, <code>z.number().int().min(1).max(100)</code> → integer in range, etc. Always
			resolves.
		</li>
	</ol>

	<h3>After the pipeline</h3>
	<p>Once the pipeline returns a value for a field, two wrapping passes finish the record:</p>
	<ul>
		<li>
			<strong>Override deep-merge</strong> — <code>options.overrides</code> is deep-merged onto the
			pipeline's value (covers nested-object slices step 0 didn't eagerly consume; B12 contract).
		</li>
		<li>
			<strong>Transform</strong> — <code>options.transform</code> is called on the merged value.
		</li>
	</ul>
	<p>You only need to provide matchers for fields the pipeline can't resolve correctly on its own.</p>

	<hr />

	<h2>The <code>ctx</code> object</h2>
	<p>
		Every <DefRef term="matcher">matcher</DefRef> receives a <code>ctx</code> with:
	</p>
	<table>
		<thead>
			<tr>
				<th>Property</th>
				<th>Description</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>ctx.gen</code></td>
				<td>
					Generator library with PRNG pre-applied. <code>ctx.gen.person.firstName()</code>,
					<code>ctx.gen.internet.email()</code>, <code>ctx.gen.finance.amount(10, 999)</code>.
				</td>
			</tr>
			<tr>
				<td><code>ctx.prng</code></td>
				<td>
					Raw PRNG for custom ranges. <code>ctx.prng.int(min, max)</code>,
					<code>ctx.prng.pick([...])</code>, <code>ctx.prng.random()</code>.
				</td>
			</tr>
			<tr>
				<td><code>ctx.source</code></td>
				<td>Data of the source schema instance (only when <code>from:</code> is declared).</td>
			</tr>
			<tr>
				<td><code>ctx.related(name)</code></td>
				<td>Resolves and returns the data of a related schema instance.</td>
			</tr>
			<tr>
				<td><code>ctx.registry</code></td>
				<td>Access to all generated data.</td>
			</tr>
			<tr>
				<td><code>ctx.fieldPath</code></td>
				<td>Dot-path of the field being generated, e.g. <code>"address.street"</code>.</td>
			</tr>
		</tbody>
	</table>

	<h3><code>ctx.gen</code> — generator library</h3>
	<p>
		The full generator namespace, with the PRNG already bound. You never pass <code>prng</code>
		manually:
	</p>
	<pre><code>{`matchers: {
  name:     (ctx) => ctx.gen.person.fullName(),
  email:    (ctx) => ctx.gen.internet.email(),
  city:     (ctx) => ctx.gen.location.city(),
  iban:     (ctx) => ctx.gen.finance.iban(),
  sentence: (ctx) => ctx.gen.word.sentence(),
}`}</code></pre>
	<p>
		Generators that take arguments work the same way — the PRNG is the first argument and is applied
		automatically:
	</p>
	<pre><code>{`(ctx) => ctx.gen.string.alphanumeric(8)   // length = 8
(ctx) => ctx.gen.finance.amount(10, 999)  // min, max`}</code></pre>

	<hr />

	<h2>The registry</h2>
	<p>
		Every generated primary schema instance is stored in the
		<DefRef term="registry">registry</DefRef>. Other matchers can look it up to establish
		cross-schema consistency.
	</p>
	<pre><code>{`// Pick a random instance of a registered schema
const person = ctx.registry.pick(PersonSchema);

// Pick all instances
const people = ctx.registry.all(PersonSchema);

// Filter all matching a predicate
const active = ctx.registry.filter(PersonSchema, (p) => p.active);`}</code></pre>
	<p>Registry lookups are typed from the schema — no manual type casts needed.</p>
	<blockquote>
		<p>
			<code>pick()</code> throws if the registry has no instances of that schema yet. Generate the
			referenced schema before the one that references it.
		</p>
	</blockquote>

	<hr />

	<h2>Composable nested schemas</h2>
	<p>
		Matchers registered for a schema apply automatically wherever that schema appears — including
		nested inside another schema's fields.
	</p>
	<pre><code>{`const world = createWorld({ seed: 42 })
  .withSchema(AddressSchema, {
    matchers: {
      street: (ctx) => ctx.gen.location.street(),
      city: (ctx) => ctx.gen.location.city(),
    },
  })
  .withSchema(PersonSchema); // PersonSchema has address: AddressSchema

// PersonSchema's address field uses AddressSchema's matchers automatically
const person = world.generate(PersonSchema);`}</code></pre>

	<hr />

	<h2>Determinism</h2>
	<p>Two guarantees make <DefRef term="determinism">determinism</DefRef> stable:</p>
	<p>
		<strong>Same seed → same output.</strong> The PRNG is deterministic (SFC32). Rebuild the world
		with the same seed and the same builder chain; you get byte-identical data.
	</p>
	<p>
		<strong>Per-field seeding.</strong> Each field gets an independent PRNG derived from
		<code>hash(worldSeed + schemaId + fieldPath)</code>. Adding or removing a field from a schema
		does <strong>not</strong> disturb the values of other fields. The <code>lastName</code> of
		instance #1 has the same value before and after you add a <code>middleName</code> field.
	</p>
	<p>
		This means you can add fields to schemas mid-project without invalidating existing test
		snapshots.
	</p>

	<hr />

	<h2 id="localization">Localization</h2>
	<p>
		A <strong>locale</strong> decides what data the generators draw from — names, words, currencies,
		date formats, address shapes, phone formats, and so on. The world carries a single locale; all
		generators read from it.
	</p>
	<p>
		<code>zod4-mock</code> ships a <strong>built-in minimal English locale</strong> that's used when
		you don't pass <code>locale</code>. It has small curated word/name arrays — enough to be valid,
		deliberately not realistic. Output looks like <code>"John Smith"</code>, <code>"Section"</code>,
		<code>"$128.94"</code>.
	</p>
	<p>For realistic output, install a locale package and pass it to <code>createWorld</code>:</p>
	<pre><code>{`import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en"; // Markov-trained English
import { nl } from "@zod4-mock/locale-nl"; // Markov-trained Dutch

createWorld({ seed: 42, locale: en });
createWorld({ seed: 42, locale: nl });`}</code></pre>
	<p>
		A locale is a plain <code>LocaleData</code> object — sections for <code>person</code>,
		<code>address</code>, <code>commerce</code>, <code>company</code>, <code>word</code>,
		<code>finance</code>, <code>date</code>, <code>color</code>, <code>phone</code>. Locales can
		supply either Markov models (<code>firstNamesMale</code>, <code>nounModel</code>) or plain
		arrays (<code>simpleFirstNamesMale</code>, <code>nouns</code>); generators prefer the model when
		present.
	</p>
	<p>
		For variants, use <code>extend()</code> (re-exported from each locale package, e.g.
		<code>@zod4-mock/locale-en</code>):
	</p>
	<pre><code>{`import { createWorld } from "zod4-mock";
import { en, extend } from "@zod4-mock/locale-en";

const enGB = extend(en, {
  address: { ...en.address, phonePrefix: "+44", countryCode: "GB", ibanPrefix: "GB" },
  commerce: { ...en.commerce, formatPrice: (n) => \`£\${n.toFixed(2)}\` },
});`}</code></pre>
	<p>
		See the <a href="/docs/api">API reference</a> for the full <code>LocaleData</code> interface.
	</p>

	<h3>Zipf-default picks on open corpora</h3>
	<p>
		<code>zod4-mock</code>'s open-corpus pickers (e.g. <code>person.firstName</code>,
		<code>person.lastName</code>) draw from frequency-sorted locale arrays via
		<code>prng.pickZipf(items, s)</code> — a single closed-form inverse-CDF Zipf draw — rather than
		uniform <code>prng.pick(items)</code>. The exponent <code>s</code> is resolved per call site as
		<code>locale.frequencyExponentOverrides?.[corpus] ?? locale.frequencyExponent ?? 1.0</code>, so
		shipped locales bias the head of each list toward the real world's frequency curve:
		<code>"john"</code> shows up far more than <code>"aaden"</code>, mirroring SSA / Census
		distributions.
	</p>
	<p>
		This is a deliberate divergence from faker, whose default is uniform across each list. If you
		prefer faker-style uniform output, set <code>frequencyExponent: 0</code> (or override an
		individual corpus) on your locale.
	</p>
	<p>
		<strong>Unique contexts auto-flatten to uniform.</strong> When you request
		<code>world.generate(schema, {'{'} unique: true {'}'})</code>, the engine flattens <code>s</code
		> to <code>0</code> for every <code>pickZipf</code> call inside that loop — uniqueness wins over
		realism. The flag has no opt-out; matchers that need head-skewed picks inside a unique loop
		should call <code>ctx.prng.pickZipf(arr, s)</code> directly with an explicit <code>s</code>.
	</p>
	<p>
		Closed / enumerable corpora (states, months, weekdays, currencies, etc.) ignore the Zipf surface
		entirely and stay on <code>prng.pick</code>.
	</p>

	<h3>Realistic numeric distributions</h3>
	<p>
		The same realism axis applies on the numeric side. Money keys (<code>amount</code>,
		<code>balance</code>, <code>total</code>, <code>revenue</code>, <code>cost</code>,
		<code>fee</code>, <code>salary</code>, <code>price</code>, …) draw <strong>log-uniform</strong> —
		<code>min * Math.pow(max / min, u)</code> — so leading-digit-1 values appear ~30% of the time
		(Benford's law), matching real-world ledgers instead of faker's flat uniform-over-range.
		Scale-free measurement keys (<code>fileSize</code>, <code>bytes</code>, <code>views</code>,
		<code>population</code>, <code>distance</code>) follow the same log-uniform default with
		<code>Math.round</code> for the integer routes. <code>age</code> is a clipped log-normal centred
		on μ = ln(36) (US Census median adult), <code>year</code> is an exponential skew toward the
		present (λ = 0.05), and <code>quantity</code> / <code>count</code> are truncated geometrics with
		<code>p = 0.5</code> (modal at the lower bound).
	</p>
	<p>
		Three semantic-meaningful keys stay bounded-uniform on a pinned default range:
		<code>rating</code> (<code>[0, 5]</code>), <code>score</code> and <code>percentage</code> (<code
			>[0, 100]</code
		>).
	</p>
	<p>
		<strong>Un-keyed auto-flip on <code>z.number()</code>.</strong> A plain (un-routed) numeric
		field auto-flips to log-uniform when <strong>all four</strong> of these hold:
		<code>min &gt; 0</code>, <code>log10(max / min) ≥ 3</code> (≥ 3 orders of magnitude),
		<code>!schema.isInt</code>, and no <code>.multipleOf</code>. Anything else stays on today's
		uniform draw. The threshold (3 orders) is deliberately wide enough to catch obvious file-size /
		view-count cases without misfiring on probabilities (<code>.min(0.01).max(1)</code>) or
		sub-percent ranges.
	</p>
	<p>
		Cross-zero or non-positive ranges always fall back to uniform (the log-uniform formula is
		undefined for <code>min ≤ 0</code>) — <code>zod4-mock</code> does <strong>not</strong> silently
		shift your stated bounds with an epsilon. To opt out per-key, use <code>withGenerators</code>
		(see <code>docs/recipes.md</code>).
	</p>

	<hr />

	<h2>Populate</h2>
	<p>
		Use <code>populate()</code> to pre-create a fixed number of instances before generation starts.
		This is useful when you need other schemas to reference a specific number of entities:
	</p>
	<pre><code>{`const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, { relations: { author: PersonSchema } })
  .populate(PersonSchema, 5); // ensure exactly 5 persons exist

const documents = world.generate(z.array(DocumentSchema).min(20));
// All 20 documents reference one of the 5 persons`}</code></pre>

	<hr />

	<h2>Optional and nullable fields</h2>
	<p>
		<code>optionalProbability</code> (default <code>0.2</code>) controls how often
		<code>z.optional()</code> and <code>z.nullable()</code> fields are omitted.
	</p>
	<pre><code>{`createWorld({ seed: 42, optionalProbability: 0 }); // always present
createWorld({ seed: 42, optionalProbability: 1 }); // always absent`}</code></pre>
	<p>
		For test assertions on optional fields, either set <code>optionalProbability: 0</code> or pin
		the field with <code>overrides</code>.
	</p>
</DocPage>
