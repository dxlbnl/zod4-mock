
Self referential relations

```ts
export const categorySchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(2).max(40),
	slug: z.string(),
	parentId: z.string().uuid().nullable()
});

const world = createWorld({ seed })
.withSchema(categorySchema, {
    relations: { parent: categorySchema },
    matchers: {
    parentId: (ctx) => ctx.related("parent").id,
    },
})

```