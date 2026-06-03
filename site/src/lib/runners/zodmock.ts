import { generateMock } from '@anatine/zod-mock';
import type { ZodTypeAny } from 'zod';
import { flatSchema3 } from '../schemas/flat';
import { nestedSchema3 } from '../schemas/nested';
import { arraySchema3 } from '../schemas/array';

type SchemaKey = 'flat' | 'nested' | 'array';

// zod3 schemas are structurally identical to zod4's ZodTypeAny at the call site;
// the peer mismatch is a package-resolution artifact, not a runtime issue.
const g = (schema: unknown) => generateMock(schema as ZodTypeAny);
const generators: Record<SchemaKey, () => unknown> = {
	flat: () => g(flatSchema3),
	nested: () => g(nestedSchema3),
	array: () => g(arraySchema3)
};

export const runZodMock = {
	flat: () => generators.flat(),
	nested: () => generators.nested(),
	array: () => generators.array(),
	batch: (schema: SchemaKey, n: number) => Array.from({ length: n }, generators[schema])
};
