<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from '@storybook/test';
	import RelationForm from './RelationForm.svelte';

	const { Story } = defineMeta({
		title: 'Builder/RelationForm',
		component: RelationForm,
		tags: ['autodocs'],
		args: {
			onadd: fn(),
			oncancel: fn()
		}
	});

	const mockSubjects = [
		{ id: '1', name: 'User', fields: [{ id: 'f1', key: 'id', type: 'uuid' }], count: 1 },
		{ 
			id: '2', 
			name: 'Post', 
			fields: [
				{ id: 'f2', key: 'id', type: 'uuid' },
				{ id: 'f3', key: 'userId', type: 'string' }
			], 
			count: 1 
		},
		{ id: '3', name: 'Comment', fields: [{ id: 'f4', key: 'postId', type: 'string' }], count: 1 }
	] as any[];
</script>

<Story 
	name="Default" 
	args={{ 
		subjects: mockSubjects,
		initialFrom: 'Post'
	}} 
/>

<Story 
	name="No Matching Fields" 
	args={{ 
		subjects: [
			{ id: '1', name: 'User', fields: [], count: 1 },
			{ id: '2', name: 'Empty', fields: [], count: 1 }
		] as any[],
		initialFrom: 'Empty'
	}} 
/>
