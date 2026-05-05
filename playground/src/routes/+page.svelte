<script lang="ts">
	import { z } from 'zod';
	import { createWorld } from 'zod4-mock';

	const userSchema = z.object({
		id: z.string().uuid(),
		name: z.string(),
		email: z.string().email(),
		age: z.number().min(18).max(99)
	});

	const world = createWorld({ seed: 42 });
	const users = world.generate(z.array(userSchema).min(3).max(5));
</script>

<h1>Zod4-Mock Playground</h1>
<p>Generated mock data from the workspace package:</p>

<pre>
{JSON.stringify(users, null, 2)}
</pre>

<style>
	pre {
		background: #f4f4f4;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
	}
</style>
