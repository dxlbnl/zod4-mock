<script lang="ts">
	// B103 — Known issues, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/bugs.md (the §6 hand-authored
	// convention; parity is human-policed). docs/bugs.md stays canonical.
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
</script>

<DocPage title="Known Bugs" sidebarGroup="reference" order={5}>
	<p><em>No open known issues.</em></p>

	<h2>Resolved</h2>
	<ul>
		<li>
			<strong>Self-referential relations</strong> — a schema relating to itself (e.g. a category whose
			<code>parentId</code> points at another category) used to recurse forever. Now supported: the
			root record's relation resolves to <code>undefined</code> (so <code>parentId</code> can be
			<code>null</code>) and later records reference earlier ones. See
			<a href="/docs/api"><code>related(name)</code> → self-referential relations</a> in the API
			reference. Regression tests live in <code>tests/unit/core/relations.test.ts</code>
			("self-referential relations (B1)").
		</li>
	</ul>
</DocPage>
