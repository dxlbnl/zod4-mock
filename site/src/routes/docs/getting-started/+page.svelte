<script lang="ts">
	// B127 — Getting Started: one complete example, then self-contained variations
	// (not numbered steps). Every code block is a build-time Shiki + Twoslash
	// highlighted, type-checked, type-linked <CodeSample> (B126). The canonical
	// end-user reference stays docs/getting-started.md.
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import InstallBlock from '$lib/docs/widgets/InstallBlock.svelte';
	import CodeSample from '$lib/docs/widgets/CodeSample.svelte';
	import RelatedShowcase from '$lib/docs/widgets/RelatedShowcase.svelte';
</script>

<DocPage title="Getting Started" sidebarGroup="concepts" order={1}>
	<p>
		Pass a Zod schema, get realistic mock data back. The whole library is one idea: your schema
		already describes the shape and the field names, so it has enough information to fill itself
		in.
	</p>

	<h2>One complete example</h2>
	<p>
		Here is everything you need. Define a schema, call <code>generate</code>, and you get a fully
		populated value — field names drive the output, so <code>firstName</code> becomes a first
		name, <code>email</code> a valid address, <code>createdAt</code> a realistic date. The example
		below is type-checked at build time, and its type tokens link straight into the
		<a href="/docs/api">API reference</a>:
	</p>

	<CodeSample id="getting-started-lead" />

	<h2>Install</h2>
	<p>
		Two packages: the generator and <code>zod@^4</code> (your schemas). Node 18+ and TypeScript
		5.4+:
	</p>

	<InstallBlock pkg="zod4-mock zod" />

	<p>
		That is the zero-config path. The variations below are different ways to do the same thing
		when you need more control — pick whichever one fits; each is complete on its own.
	</p>

	<h2>Pin a seed for reproducible data</h2>
	<p>
		Wrap generation in a <strong>world</strong> and pass it a <code>seed</code>. A world is a
		single generation session, and the seed is the one number that determines its output: the
		<strong>same seed</strong> yields the same data on every run and every machine. Build one per
		test file and reuse it.
	</p>

	<CodeSample id="getting-started-seeded-world" />

	<p>
		Everything else you can pass to <code>createWorld</code> — optional-field probability, default
		array length, locale — is a default for that session. The seed is the only one you usually
		need.
	</p>

	<h2>Take over a field with matchers</h2>
	<p>
		When a field needs a specific shape, register a <strong>matcher</strong> for it. Each matcher
		receives a <code>ctx</code> with the seeded PRNG already applied (<code>ctx.prng</code>) and
		the full generator library (<code>ctx.gen</code>). Fields without a matcher fall through to
		the defaults — you only describe what you want to control.
	</p>

	<CodeSample id="getting-started-matchers" />

	<h2>Keep foreign keys consistent with relations</h2>
	<p>
		To make one schema reference real records from another, declare a <strong>relation</strong> and
		read it in a matcher with <code>ctx.related(name)</code>. Every generated post then points at a
		post author that actually exists in the dataset.
	</p>

	<CodeSample id="getting-started-relations" />

	<h2>See it in a real dataset</h2>
	<p>
		Here's one <code>user</code> record from the live <a href="/showcase">showcase</a> dataset —
		every field generated from its schema, seed-pinned and cross-consistent with the orders and
		reviews around it:
	</p>

	<RelatedShowcase entity="user" />

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
			<a href="/docs/recipes">Recipes</a> — deriving schemas, transforms, localization, and more
			copy-pasteable patterns
		</li>
	</ul>
</DocPage>
