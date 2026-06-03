import { generate } from 'zod4-mock';
import { flatSchema } from '../schemas/flat';
import { nestedSchema } from '../schemas/nested';
import { arraySchema } from '../schemas/array';

type SchemaKey = 'flat' | 'nested' | 'array';

const generators: Record<SchemaKey, () => unknown> = {
	flat: () => generate(flatSchema),
	nested: () => generate(nestedSchema),
	array: () => generate(arraySchema)
};

export const runZod4Mock = {
	flat: () => generators.flat(),
	nested: () => generators.nested(),
	array: () => generators.array(),
	batch: (schema: SchemaKey, n: number) => Array.from({ length: n }, generators[schema])
};
