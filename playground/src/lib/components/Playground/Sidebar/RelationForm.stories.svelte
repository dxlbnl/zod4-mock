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
</script>

<Story 
	name="Default" 
	args={{ 
		subjects: ['User', 'Post', 'Comment', 'Profile'],
		initialFrom: 'Post'
	}} 
/>

<Story 
	name="Single Subject" 
	args={{ 
		subjects: ['User'],
		initialFrom: 'User'
	}} 
/>
