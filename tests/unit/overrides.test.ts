/**
 * Unit tests for the overrides and transform pipeline.
 *
 * Verifies that `options.overrides` (deep partial merge) and
 * `options.transform` (post-merge function) work correctly — both
 * individually and in combination.
 *
 * All tests will fail with "not implemented" until fase 3.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld, defineSubjectType } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const StepSchema = z.object({
  name: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
});

const FileSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "processing", "done", "failed"]),
  metadata: z.object({
    uploadedBy: z.string(),
    sizeBytes: z.number().int().min(0),
    tags: z.array(z.string()),
  }),
  steps: z.array(StepSchema).length(4),
});

const FileSubject = defineSubjectType(
  "file",
  z.object({
    fileId: z.uuid(),
  }),
);

function makeWorld() {
  return createWorld({ seed: 42 })
    .withSubject(FileSubject)
    .withSchema(FileSchema, FileSubject, {
      id: (s) => s.fileId,
    });
}

// ---------------------------------------------------------------------------
// overrides — top-level fields
// ---------------------------------------------------------------------------

describe("overrides — top-level fields", () => {
  it("overrides a scalar field", () => {
    const file = makeWorld().generate(FileSchema, {
      overrides: { status: "failed" },
    });
    expect(file.status).toBe("failed");
  });

  it("does not affect other fields when overriding one", () => {
    const baseline = makeWorld().generate(FileSchema);
    const overridden = makeWorld().generate(FileSchema, {
      overrides: { status: "failed" },
    });
    expect(overridden.id).toBe(baseline.id);
    expect(overridden.metadata).toEqual(baseline.metadata);
  });
});

// ---------------------------------------------------------------------------
// overrides — nested fields (deep merge)
// ---------------------------------------------------------------------------

describe("overrides — nested fields (deep merge)", () => {
  it("overrides a nested scalar field", () => {
    const file = makeWorld().generate(FileSchema, {
      overrides: { metadata: { uploadedBy: "test-user" } },
    });
    expect(file.metadata.uploadedBy).toBe("test-user");
  });

  it("preserves sibling nested fields when overriding one", () => {
    const file = makeWorld().generate(FileSchema, {
      overrides: { metadata: { uploadedBy: "test-user" } },
    });
    expect(typeof file.metadata.sizeBytes).toBe("number");
    expect(Array.isArray(file.metadata.tags)).toBe(true);
  });

  it("overrides replace arrays (no array merge)", () => {
    const file = makeWorld().generate(FileSchema, {
      overrides: { metadata: { tags: ["alpha", "beta"] } },
    });
    expect(file.metadata.tags).toEqual(["alpha", "beta"]);
  });
});

// ---------------------------------------------------------------------------
// transform function
// ---------------------------------------------------------------------------

describe("transform", () => {
  it("can modify a top-level field", () => {
    const file = makeWorld().generate(FileSchema, {
      transform: (data) => {
        // Mutate a shallow copy to avoid TypeScript's spread-widening of enum literals
        const copy = { ...data };
        copy.status = "done";
        return copy;
      },
    });
    expect(file.status).toBe("done");
  });

  it("can modify an array element by index", () => {
    const file = makeWorld().generate(FileSchema, {
      transform: (data) => ({
        ...data,
        steps: data.steps.map((step, i) =>
          i === 2 ? { ...step, status: "failed" as const } : step,
        ),
      }),
    });
    expect(file.steps[2]?.status).toBe("failed");
    // Other steps are untouched
    expect(file.steps[0]?.status).not.toBe("failed");
    expect(file.steps[1]?.status).not.toBe("failed");
    expect(file.steps[3]?.status).not.toBe("failed");
  });

  it("receives the full generated object", () => {
    const calls: unknown[] = [];
    makeWorld().generate(FileSchema, {
      transform: (data) => {
        calls.push(data);
        return data;
      },
    });
    expect(calls).toHaveLength(1);
    expect(FileSchema.safeParse(calls[0]).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// overrides + transform combined
// ---------------------------------------------------------------------------

describe("overrides + transform combined", () => {
  it("overrides are applied before transform", () => {
    // If overrides run before transform, the transform must see 'processing' in data.status
    let seenStatus: string | undefined;
    makeWorld().generate(FileSchema, {
      overrides: { status: "processing" },
      transform: (data) => {
        seenStatus = data.status;
        return data;
      },
    });
    expect(seenStatus).toBe("processing");
  });

  it("transform receives overridden values", () => {
    const seen: string[] = [];
    makeWorld().generate(FileSchema, {
      overrides: { metadata: { uploadedBy: "sentinel" } },
      transform: (data) => {
        seen.push(data.metadata.uploadedBy);
        return data;
      },
    });
    expect(seen[0]).toBe("sentinel");
  });

  it("combined result validates against the schema", () => {
    const file = makeWorld().generate(FileSchema, {
      overrides: { status: "done" },
      transform: (data) => ({
        ...data,
        steps: data.steps.map((s) => ({ ...s, status: "done" as const })),
      }),
    });
    expect(FileSchema.safeParse(file).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No overrides or transform — baseline behaviour
// ---------------------------------------------------------------------------

describe("generate without overrides", () => {
  it("produces a valid file", () => {
    const file = makeWorld().generate(FileSchema);
    expect(FileSchema.safeParse(file).success).toBe(true);
  });

  it("has exactly 4 steps (from .length(4) on StepSchema array)", () => {
    const file = makeWorld().generate(FileSchema);
    expect(file.steps).toHaveLength(4);
  });
});
