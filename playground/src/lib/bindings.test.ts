import { describe, it, expect } from 'vitest';
import { createPlaygroundState, makeField } from './state.svelte';
import { buildWorld } from './schema-builder';

describe('Schema Bindings', () => {
  it('should honor schema-to-subject bindings in buildWorld', () => {
    const store = createPlaygroundState();
    const state = store.state;

    // 1. Create a subject
    state.subjects = [{
      id: 'subj-1',
      name: 'User',
      count: 1,
      fields: [
        makeField({ key: 'id', type: 'uuid' }),
        makeField({ key: 'name', type: 'string' })
      ]
    }];

    // 2. Create an API schema
    state.schemas = [{
      id: 'schema-1',
      name: 'UserApi',
      fields: [
        makeField({ key: 'userId', type: 'uuid' }),
        makeField({ key: 'fullName', type: 'string' })
      ]
    }];

    // 3. Bind them
    state.bindings = [{
      schemaId: 'schema-1',
      subjectId: 'subj-1',
      fieldMap: {
        userId: 'id',
        fullName: 'name'
      }
    }];

    // 4. Build world
    const { world, schemaMap } = buildWorld(state);
    const apiSchema = schemaMap.get('schema-1');
    expect(apiSchema).toBeDefined();

    // 5. Generate data
    const data = world.generate(apiSchema) as any;

    // 6. Verify data matches subject
    const user = world.subjects('User')[0].data as any;
    expect(data.userId).toBe(user.id);
    expect(data.fullName).toBe(user.name);
  });

  it('should honor bindings when generating an array of schemas', () => {
    const store = createPlaygroundState();
    const state = store.state;

    // 1. Create a subject with 3 instances
    state.subjects = [{
      id: 'subj-1',
      name: 'User',
      count: 3,
      fields: [
        makeField({ key: 'id', type: 'uuid' }),
        makeField({ key: 'name', type: 'string' })
      ]
    }];

    // 2. Create an API schema
    state.schemas = [{
      id: 'schema-1',
      name: 'UserApi',
      fields: [
        makeField({ key: 'userId', type: 'uuid' }),
        makeField({ key: 'fullName', type: 'string' })
      ]
    }];

    // 3. Bind them
    state.bindings = [{
      schemaId: 'schema-1',
      subjectId: 'subj-1',
      fieldMap: {
        userId: 'id',
        fullName: 'name'
      }
    }];

    // 4. Build world
    const { world, schemaMap } = buildWorld(state);
    const apiSchema = schemaMap.get('schema-1');

    // 5. Generate array of 3
    const data = world.generate(state.z.array(apiSchema!).length(3)) as any[];

    // 6. Verify all 3 match subject data
    const users = world.subjects('User').map(u => u.data) as any[];
    expect(data).toHaveLength(3);
    
    // zod4-mock cycles through subjects
    for (let i = 0; i < 3; i++) {
      expect(data[i].userId).toBe(users[i].id);
      expect(data[i].fullName).toBe(users[i].name);
    }
  });
});
