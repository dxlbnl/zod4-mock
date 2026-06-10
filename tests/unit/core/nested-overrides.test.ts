/**
 * B12 — BUG: nested-object overrides skip the matcher and don't deep-merge.
 *
 * Spec: wiki/specs/B12-nested-override-skips-matcher.md
 * Item card: wiki/backlog/doing/B12-nested-override-skips-matcher.md
 *
 * These tests verify the in-step deep-merge of object overrides on top of the
 * branch-resolved value in `generateObjectFields` (src/world.ts), across the
 * matcher branch (B12-R1), the per-schema key-map / custom world-level /
 * key-based-heuristic / schema-based branches (B12-R5), and the regression
 * for the card's exact repro (B12-R2 satisfied by the B12-R1 "card repro"
 * scenario living in this file under tests/unit/core/).
 *
 * Each test is named by requirement id + scenario per the test-writer SKILL.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { GeneratorContext } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// B12-R1 — matcher branch deep-merges with object override
// (R2 piggy-backs on the first scenario: it is the "card repro" regression
//  test living under tests/unit/core/, asserting matcher leaves + override
//  leaves both present.)
// ---------------------------------------------------------------------------

describe("B12-R1: matcher branch deep-merges with non-null plain-object override", () => {
  it("B12-R1 / matcher leaves preserved, override leaves win (card repro)", () => {
    // Mirrors the GitHub-issue / item-card repro exactly.
    const UserSchema = z.object({
      name: z.string(),
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
    });

    const world = createWorld({ seed: 42 }).withSchema(UserSchema, {
      matchers: {
        profile: () => ({
          bio: "matcher-bio",
          avatar: "https://example.com/a.png",
        }),
      },
    });

    const user = world.generate(UserSchema, {
      overrides: { profile: { bio: "overridden-bio" } },
    });

    expect(user.profile).toEqual({
      bio: "overridden-bio",
      avatar: "https://example.com/a.png",
    });
  });

  it("B12-R1 / recursive merge into a doubly-nested object", () => {
    const UserSchema = z.object({
      profile: z.object({
        contact: z.object({
          email: z.string(),
          phone: z.string(),
        }),
      }),
    });

    const world = createWorld({ seed: 42 }).withSchema(UserSchema, {
      matchers: {
        profile: () => ({
          contact: { email: "m@example.com", phone: "+10000000000" },
        }),
      },
    });

    const user = world.generate(UserSchema, {
      overrides: { profile: { contact: { email: "o@example.com" } } },
    });

    expect(user.profile.contact).toEqual({
      email: "o@example.com",
      phone: "+10000000000",
    });
  });
});

// ---------------------------------------------------------------------------
// B12-R3 — existing behaviours preserved (guards against regression of the
// fix). These should pass today and continue to pass after the fix lands.
// ---------------------------------------------------------------------------

describe("B12-R3: existing behaviours preserved", () => {
  it("B12-R3 / field without a matcher still deep-merges via the layered model", () => {
    // No matcher for `profile`; schema-based pipeline produces avatar.
    const UserSchema = z.object({
      name: z.string(),
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
    });

    const world = createWorld({ seed: 42 }).withSchema(UserSchema);

    const user = world.generate(UserSchema, {
      overrides: { profile: { bio: "overridden-bio" } },
    });

    expect(user.profile.bio).toBe("overridden-bio");
    expect(typeof user.profile.avatar).toBe("string");
    expect(user.profile.avatar.length).toBeGreaterThan(0);
  });

  it("B12-R3 / matcher with no override produces matcher value unchanged", () => {
    const UserSchema = z.object({
      name: z.string(),
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
    });

    const world = createWorld({ seed: 42 }).withSchema(UserSchema, {
      matchers: {
        profile: () => ({
          bio: "matcher-bio",
          avatar: "https://example.com/a.png",
        }),
      },
    });

    const user = world.generate(UserSchema);

    expect(user.profile).toEqual({
      bio: "matcher-bio",
      avatar: "https://example.com/a.png",
    });
  });

  it("B12-R3 / primitive override on a matcher-backed field replaces (no merge)", () => {
    const Schema = z.object({ name: z.string() });

    const world = createWorld({ seed: 42 }).withSchema(Schema, {
      matchers: { name: () => "matcher-name" },
    });

    const result = world.generate(Schema, {
      overrides: { name: "overridden-name" },
    });

    expect(result.name).toBe("overridden-name");
  });

  it("B12-R3 / array override on a matcher-backed field sets the count to override.length (B136 supersedes B134-R6 tail)", () => {
    // SUPERSEDED by B136: an array override now SETS the element count to
    // `override.length`. A matcher-produced array IS the base, so when the
    // matcher base (length 3) is longer than the override (length 2), the
    // matcher's trailing element ("m3") is dropped — the override length wins
    // (B136-R6 / B134-R6 supersession). The per-index merge (positional replace)
    // is unchanged. See wiki/specs/B136-override-array-length-wins.md.
    const Schema = z.object({ tags: z.array(z.string()) });

    const world = createWorld({ seed: 42 }).withSchema(Schema, {
      matchers: { tags: () => ["m1", "m2", "m3"] },
    });

    const result = world.generate(Schema, {
      overrides: { tags: ["alpha", "beta"] },
    });

    expect(result.tags).toEqual(["alpha", "beta"]); // B136: override length wins, "m3" dropped
  });
});

// ---------------------------------------------------------------------------
// B12-R5 — in-step deep-merge applies to the key-map, custom world-level,
// key-based-heuristic, and schema-based branches too. The per-schema
// key-map and custom-generator scenarios are forward-looking guards
// (today's shipped key-based heuristics emit only primitives, but users
// CAN register a key map or custom generator that returns an object).
// ---------------------------------------------------------------------------

describe("B12-R5: in-step deep-merge across non-matcher branches", () => {
  it("B12-R5 / per-schema key-map branch deep-merges an object override with its returned object", () => {
    const Schema = z.object({
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
    });

    const world = createWorld({ seed: 42 })
      .withSchema(Schema)
      .withKeyMap(Schema, {
        profile: () => ({ bio: "keymap-bio", avatar: "keymap-avatar" }),
      });

    const result = world.generate(Schema, {
      overrides: { profile: { bio: "overridden-bio" } },
    });

    expect(result.profile).toEqual({
      bio: "overridden-bio",
      avatar: "keymap-avatar",
    });
  });

  it("B12-R5 / custom world-level key generator branch deep-merges an object override with its returned object", () => {
    const Schema = z.object({
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
    });

    const world = createWorld({
      seed: 1,
      generators: {
        profile: () => ({ bio: "custom-bio", avatar: "custom-avatar" }),
      },
    }).withSchema(Schema);

    const result = world.generate(Schema, {
      overrides: { profile: { bio: "overridden-bio" } },
    });

    expect(result.profile).toEqual({
      bio: "overridden-bio",
      avatar: "custom-avatar",
    });
  });

  it("B12-R5 / key-based heuristic branch yielding a primitive — primitive override still replaces (today's behaviour pinned)", () => {
    // The shipped key-based heuristic for `email` returns a primitive string.
    // The in-step layer is a no-op for primitive branch values: the primitive
    // override still replaces wholesale.
    const Schema = z.object({ email: z.string() });

    const world = createWorld({ seed: 42 }).withSchema(Schema);

    const result = world.generate(Schema, {
      overrides: { email: "override@example.com" },
    });

    expect(result.email).toBe("override@example.com");
  });

  it("B12-R5 / schema-based branch on a z.object field deep-merges (in-step via recursion)", () => {
    const Schema = z.object({
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
    });

    const world = createWorld({ seed: 42 }).withSchema(Schema);

    const result = world.generate(Schema, {
      overrides: { profile: { bio: "overridden-bio" } },
    });

    expect(result.profile.bio).toBe("overridden-bio");
    expect(typeof result.profile.avatar).toBe("string");
    expect(result.profile.avatar.length).toBeGreaterThan(0);
  });

  it("B12-R5 / sibling matcher reading ctx.current sees the merged value, not the raw schema-based output", () => {
    // `profile` has no matcher (schema-based branch produces it).
    // `summary` has a matcher that reads ctx.current.profile.bio.
    // With `overrides: { profile: { bio: "overridden-bio" } }`, the summary
    // matcher MUST see the merged value (the override's bio) — pinning the
    // in-step deep-merge invariant for the schema-based branch.
    const Schema = z.object({
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
      summary: z.string(),
    });

    const world = createWorld({ seed: 42 }).withSchema(Schema, {
      matchers: {
        summary: (ctx: GeneratorContext) => {
          const current = ctx.current as {
            profile?: { bio?: string };
          };
          return current.profile?.bio ?? "";
        },
      },
    });

    const result = world.generate(Schema, {
      overrides: { profile: { bio: "overridden-bio" } },
    });

    expect(result.summary).toBe("overridden-bio");
  });

  it("B12-R5 / null override on a key-map-backed object field replaces (no merge)", () => {
    const Schema = z.object({
      profile: z.object({
        bio: z.string(),
        avatar: z.string(),
      }),
    });

    const world = createWorld({ seed: 42 })
      .withSchema(Schema)
      .withKeyMap(Schema, {
        profile: () => ({ bio: "keymap-bio", avatar: "keymap-avatar" }),
      });

    const result = world.generate(Schema, {
      // `null` override keeps replace semantics across every branch — the
      // eager step-0 fast path takes it verbatim.
      overrides: { profile: null as unknown as { bio: string; avatar: string } },
    });

    expect(result.profile).toBeNull();
  });
});
