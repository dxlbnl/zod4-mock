<script lang="ts">
	// B101 — Getting Started, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/getting-started.md (the §6 hand-authored
	// convention; parity is human-policed). docs/getting-started.md stays canonical.
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import InstallBlock from '$lib/docs/widgets/InstallBlock.svelte';
	import SpeedClaim from '$lib/docs/widgets/SpeedClaim.svelte';
	import Playground from '$lib/docs/widgets/Playground.svelte';
	import RelatedShowcase from '$lib/docs/widgets/RelatedShowcase.svelte';

	const step1Code = `z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(["admin", "user", "viewer"]),
  createdAt: z.date(),
})`;
</script>

<DocPage title="Getting Started" sidebarGroup="concepts" order={1}>
	<p>Get realistic, deterministic mock data from your Zod schemas in minutes.</p>

	<h2>Prerequisites</h2>
	<ul>
		<li>Node 18+, TypeScript 5.4+</li>
		<li><code>zod@^4</code> (Zod v4 — not v3)</li>
	</ul>

	<InstallBlock pkg="zod4-mock zod" />

	<SpeedClaim
		tier="user"
		value="3.2×"
		vs="vs @anatine/zod-mock (CLI baseline)"
		source="site/bench/results/latest.json"
	/>

	<hr />

	<h2>Step 1 — Generate without any setup</h2>
	<p>The simplest possible use: pass a schema, get data back.</p>

	<Playground initialCode={step1Code} />

	<p>
		Field names drive the output automatically. <code>firstName</code> → a first name,
		<code>email</code> → a valid email, <code>id</code> → a UUID, <code>createdAt</code> → a
		realistic date. See <a href="/docs/key-heuristics">Key-Based Field Heuristics</a> for the full
		list.
	</p>

	<p>For arrays, wrap in <code>z.array()</code>:</p>

	<pre><code>const users = generate(z.array(UserSchema).min(3).max(10));</code></pre>

	<hr />

	<h2>Step 2 — Pin a seed for reproducible data</h2>
	<p>
		Wrap in a <strong>world</strong> to fix the seed. Same seed → byte-identical output on every
		run and every machine:
	</p>

	<pre><code>{`import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 42 });
const users = world.generate(z.array(UserSchema).min(5));`}</code></pre>

	<p>
		A world is just a seeded generation session. Build one per test file and reuse it — the same
		builder chain, same seed, same data.
	</p>

	<hr />

	<h2>Step 3 — Control fields with matchers</h2>
	<p>
		Register matchers to override how specific fields are generated. Use <code>ctx.gen</code> to
		access the full generator library — the PRNG is already applied, so you never pass it manually:
	</p>

	<pre><code>{`import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 42 }).withSchema(ProductSchema, {
  matchers: {
    name: (ctx) => ctx.gen.commerce.productName(),
    sku: (ctx) => \`SKU-\${ctx.gen.string.alphanumeric(6)}\`,
    priceCents: (ctx) => ctx.prng.int(100, 50_000),
  },
});

const products = world.generate(z.array(ProductSchema).min(10));`}</code></pre>

	<p>
		Any field without a matcher falls through automatically: key-name heuristics first, then Zod
		type introspection. You only need to specify what you want to control.
	</p>

	<p>
		For custom ranges and raw PRNG access, use <code>ctx.prng.int(min, max)</code> or
		<code>ctx.prng.pick([...items])</code>.
	</p>

	<hr />

	<h2>Step 4 — Relate schemas to each other</h2>
	<p>
		Declare relations between schemas to keep foreign keys consistent across your generated
		dataset:
	</p>

	<pre><code>{`const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, {
    relations: { author: PersonSchema },
    matchers: {
      authorId: (ctx) => ctx.related("author").personId,
      title: (ctx) => ctx.gen.word.sentence(),
    },
  });

const people = world.generate(z.array(PersonSchema).min(3));
const documents = world.generate(z.array(DocumentSchema).min(10));

// Every document.authorId is guaranteed to be a real person's personId`}</code></pre>

	<p>
		<code>ctx.related("author")</code> resolves the related schema instance based on the declared relation.
	</p>

	<hr />

	<h2>Step 5 — Derive one schema from another</h2>
	<p>
		When two API shapes represent the same entity, bind one to the other with <code>from</code>. The
		source entity's data is available as <code>ctx.source</code>:
	</p>

	<pre><code>{`const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(PersonSummarySchema, {
    from: PersonSchema,
    matchers: {
      id: (ctx) => ctx.source.personId,
      displayName: (ctx) => \`\${ctx.source.firstName} \${ctx.source.lastName}\`,
    },
  });

const people = world.generate(z.array(PersonSchema).min(5));
const summaries = world.generate(z.array(PersonSummarySchema));

// people[0].personId === summaries[0].id — always`}</code></pre>

	<hr />

	<h2>Step 6 — Override and transform</h2>
	<p>After generation you can pin specific fields without redoing the setup.</p>

	<p>
		<strong>Overrides</strong> — deep-merged into the result. Nested objects merge; arrays are
		replaced entirely:
	</p>

	<pre><code>{`const lockedUser = world.generate(UserSchema, {
  overrides: { role: "admin", active: true },
});`}</code></pre>

	<p>
		<strong>Transform</strong> — a function applied after overrides. Use it for array-index edits or
		anything that needs the full generated object:
	</p>

	<pre><code>{`const invoice = world.generate(InvoiceSchema, {
  transform: (data) => ({
    ...data,
    lines: data.lines.map((line, i) => (i === 0 ? { ...line, quantity: 99 } : line)),
  }),
});`}</code></pre>

	<hr />

	<h2>Step 7 — Localize the output (optional)</h2>
	<p>
		By default, generators draw from a <strong>minimal built-in English locale</strong> — short
		curated name/word lists, no Markov generation. Output looks like <code>"John Smith"</code> and
		<code>"$128.94"</code>. For realistic, Markov-generated data or a different language, install a
		locale package and pass it via <code>locale</code>:
	</p>

	<pre><code>{`npm install @zod4-mock/locale-en        # rich English
npm install @zod4-mock/locale-nl        # Dutch (Markov names, € prices, tussenvoegsels)`}</code></pre>

	<pre><code>{`import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

const enWorld = createWorld({ seed: 42, locale: en });
const nlWorld = createWorld({ seed: 42, locale: nl });`}</code></pre>

	<p>
		Locales are plain objects implementing the <code>LocaleData</code> interface — every section
		(names, words, currencies, addresses, phone formats, …) is overridable. For variants like
		British English or <code>nl-BE</code>, use the <code>extend()</code> helper:
	</p>

	<pre><code>{`import { createWorld, extend } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";

const enGB = extend(en, {
  address: { ...en.address, phonePrefix: "+44", countryCode: "GB", ibanPrefix: "GB" },
  commerce: { ...en.commerce, formatPrice: (n) => \`£\${n.toFixed(2)}\` },
});

createWorld({ seed: 1, locale: enGB });`}</code></pre>

	<p>
		See <a href="/docs/api">Localization in the API reference</a> for the full interface, and the
		localization research for the design rationale.
	</p>

	<hr />

	<h2>See it in a real dataset</h2>
	<p>
		Here's one <code>user</code> record from the live <a href="/showcase">showcase</a> dataset —
		every field generated from its schema, seed-pinned and cross-consistent with the orders and
		reviews around it:
	</p>

	<RelatedShowcase entity="user" />

	<hr />

	<h2>Where to go next</h2>
	<ul>
		<li>
			<a href="/docs/concepts">Concepts</a> — how the world, registry, and generation pipeline work
		</li>
		<li><a href="/docs/api">API Reference</a> — every exported function and type</li>
		<li>
			<a href="/docs/key-heuristics">Key-Based Field Heuristics</a> — complete list of
			auto-generated field names
		</li>
		<li>
			<a href="/docs/recipes">Recipes</a> — copy-pasteable patterns for invoicing, document corpora,
			multi-API consistency
		</li>
	</ul>
</DocPage>
