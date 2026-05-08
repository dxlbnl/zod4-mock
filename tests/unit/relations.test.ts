import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, defineSubjectType } from "../../src/index.js";

const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const FileSchema = z.object({
  fileId: z.string(),
  ownerId: z.string(),
});

const PersonSubject = defineSubjectType("person", PersonSchema);

const FileSubject = defineSubjectType("file", FileSchema, {
  relations: {
    owner: { type: "person", cardinality: "1" },
    collaborators: { type: "person", cardinality: "0..n" },
  },
});

describe("Relations", () => {
  it("lazy provisions a missing relationship", () => {
    const world = createWorld({ seed: 1 }).withSubject(PersonSubject).withSubject(FileSubject);

    // Eagerly generate just a file. Since it's lazy, it won't generate an owner yet.
    const file = world.subject("file");
    expect(world.subjects("person").length).toBe(0);

    // Now resolve the relation using the underlying method
    const worldImpl = world as any;
    const ownerData = worldImpl.resolveRelation(file, "owner");

    // Auto-provision should have created exactly 1 person
    expect(ownerData).toBeDefined();
    expect(world.subjects("person").length).toBe(1);

    const person = world.subjects("person")[0]!;
    expect(ownerData.id).toBe(person.data.id);
  });

  it("probabilistically picks existing relationships", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSubject(FileSubject)
      .populate("person", 5);

    const file = world.subject("file");
    expect(world.subjects("person").length).toBe(5);

    const worldImpl = world as any;
    const ownerData = worldImpl.resolveRelation(file, "owner");

    // No new person should be created since 5 already exist
    expect(world.subjects("person").length).toBe(5);

    // The owner should be one of the existing 5 persons
    const persons = world.subjects("person").map((p) => p.data.id);
    expect(persons).toContain(ownerData.id);
  });

  it("handles 0..n cardinality correctly", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSubject(FileSubject)
      .populate("person", 5);

    const file = world.subject("file");
    const worldImpl = world as any;
    const collaborators = worldImpl.resolveRelation(file, "collaborators") as any[];

    expect(Array.isArray(collaborators)).toBe(true);
    // 0..n resolves to 0..3 randomly
    expect(collaborators.length).toBeGreaterThanOrEqual(0);
    expect(collaborators.length).toBeLessThanOrEqual(3);
  });

  it("supports reverse relation lookup", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSubject(FileSubject)
      .populate("person", 1)
      .populate("file", 3);

    const person = world.subjects("person")[0]!;

    const worldImpl = world as any;
    // files point to owner (person).
    // Let's force resolve the forward relations first so the links exist
    const files = world.subjects("file");
    for (const file of files) {
      worldImpl.resolveRelation(file, "owner");
    }

    const linkedFiles = worldImpl.resolveReverseRelation(person, "file", "owner") as any[];

    // Since there's only 1 person, all 3 files must have picked this person as owner
    expect(linkedFiles.length).toBe(3);
    expect(linkedFiles.map((f) => f.fileId).sort()).toEqual(files.map((f) => f.data.fileId).sort());
  });

  it("caches resolved relations for deterministic reads", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject).withSubject(FileSubject);

    const file = world.subject("file");
    const worldImpl = world as any;

    const owner1 = worldImpl.resolveRelation(file, "owner");
    const owner2 = worldImpl.resolveRelation(file, "owner");

    // Should be the exact same object reference due to caching
    expect(owner1).toBe(owner2);
  });

  it("uses topological sort for ensuring subject existence order", () => {
    const world = createWorld({ seed: 42 })
      .withSubject(FileSubject) // registered first, but depends on person
      .withSubject(PersonSubject);

    // Call internal method to check sort order
    const worldImpl = world as any;
    const order = worldImpl.getTopologicallySortedTypes();

    // person must be before file
    const personIndex = order.indexOf("person");
    const fileIndex = order.indexOf("file");

    expect(personIndex).toBeLessThan(fileIndex);
  });

  it("automatically sinks relation IDs into matching field names (Heuristic)", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject).withSubject(FileSubject);

    const file = world.subject("file");
    // Access ownerId first to trigger lazy provisioning
    const ownerId = file.data.ownerId;
    const person = world.subjects("person")[0]!;

    expect(ownerId).toBe(person.data.id);
  });

  it("prioritizes explicit 'key' in RelationDef over heuristics", () => {
    const CustomFileSchema = z.object({
      id: z.string(),
      // This field would heuristically match 'owner', but we want to use 'authorId' instead
      ownerId: z.string(),
      authorId: z.string(),
    });

    const CustomFileSubject = defineSubjectType("file", CustomFileSchema, {
      relations: {
        owner: { type: "person", cardinality: "1", key: "authorId" },
      },
    });

    const world = createWorld({ seed: 42 })
      .withSubject(PersonSubject)
      .withSubject(CustomFileSubject);
    const file = world.subject("file");

    // Access authorId to trigger provisioning
    const authorId = file.data.authorId;
    const person = world.subjects("person")[0]!;

    // Explicit key 'authorId' wins
    expect(authorId).toBe(person.data.id);
    // ownerId should be a random string (no sinking)
    expect(file.data.ownerId).not.toBe(person.data.id);
  });

  it("correctly extracts custom identity fields (e.g. personId) during sinking", () => {
    const CustomPersonSchema = z.object({ personId: z.string().uuid() });
    const CustomPersonSubject = defineSubjectType("person", CustomPersonSchema);

    const world = createWorld({ seed: 1 })
      .withSubject(CustomPersonSubject)
      .withSubject(FileSubject);

    const file = world.subject("file");

    // Access ownerId to trigger provisioning
    const ownerId = file.data.ownerId;
    const person = world.subjects("person")[0]!;

    // Should have sunk the personId, not the synthetic _id or 'id'
    expect(ownerId).toBe(person.data.personId);
  });

  it("remains lazy until the sunk field is actually accessed", () => {
    const world = createWorld({ seed: 42 }).withSubject(PersonSubject).withSubject(FileSubject);

    const file = world.subject("file");

    // Pass 1 and Pass 2 setup the getter, but shouldn't trigger it yet
    expect(world.subjects("person").length).toBe(0);

    // Accessing the field triggers the getter and provisioning
    const id = file.data.ownerId;
    expect(id).toBeDefined();
    expect(world.subjects("person").length).toBe(1);
    expect(world.subjects("person")[0]!.data.id).toBe(id);
  });
});
