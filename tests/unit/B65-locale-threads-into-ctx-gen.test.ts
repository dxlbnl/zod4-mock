/**
 * B65 regression — `world.generate(S, { locale })` MUST thread the per-call
 * locale into the matcher's `ctx`. Without the fix, the matcher's ctx (and
 * therefore `ctx.gen.*` calls) saw `defaultLocale` instead of the per-call
 * locale, so locale callbacks like `loc.formatSentence` never fired through
 * that path.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";
import { en } from "@zod4-mock/locale-en";

describe("B65: per-call locale threads into the matcher ctx", () => {
  it("matcher ctx.locale equals the locale passed to generate()", () => {
    const observed: Array<unknown> = [];
    const S = z.object({ probe: z.string() });

    const world = createWorld({ seed: 1 }).withSchema(S, {
      matchers: {
        probe: (ctx) => {
          observed.push(ctx.locale);
          return "ok";
        },
      },
    });

    world.generate(S, { locale: en });

    expect(observed).toHaveLength(1);
    expect(observed[0]).toBe(en);
  });
});
