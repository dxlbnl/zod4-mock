/**
 * B100 — docs sidebar manifest unit test.
 *
 * Maps to one requirement ID from
 * wiki/specs/B100-docs-primitive-library-chrome-landing.md.
 *
 * This test asserts the runtime shape of the typed manifest at
 * site/src/lib/docs/sidebar.ts (B100-R10 scenario 1). Compile-time
 * type errors against the SidebarGroup shape surface through
 * `pnpm site:check` (the test file itself uses the typed export so
 * a wrong shape errors svelte-check on the import line).
 *
 * Red until the implementer creates site/src/lib/docs/sidebar.ts
 * with the typed SIDEBAR export.
 */

import { describe, it, expect } from "vitest";
import { SIDEBAR, type SidebarGroup, type SidebarLink } from "./sidebar.js";

const ALLOWED_GROUP_IDS = ["concepts", "reference", "guides", "how-to"] as const;
type AllowedGroupId = (typeof ALLOWED_GROUP_IDS)[number];

describe("B100-R10 / typed sidebar manifest shape", () => {
  it("SIDEBAR groups carry an allowed id and each group's links are sorted by `order`", () => {
    expect(Array.isArray(SIDEBAR)).toBe(true);
    expect(SIDEBAR.length).toBeGreaterThan(0);

    for (const group of SIDEBAR as ReadonlyArray<SidebarGroup>) {
      expect(
        (ALLOWED_GROUP_IDS as ReadonlyArray<string>).includes(group.id satisfies AllowedGroupId),
        `group.id "${group.id}" must be one of ${ALLOWED_GROUP_IDS.join(", ")}`,
      ).toBe(true);
      expect(typeof group.label).toBe("string");
      expect(group.label.length).toBeGreaterThan(0);

      const orders = (group.links as ReadonlyArray<SidebarLink>).map((l) => l.order);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders, `group "${group.id}" must list links in ascending \`order\``).toEqual(sorted);

      for (const link of group.links) {
        expect(typeof link.href).toBe("string");
        expect(link.href.startsWith("/")).toBe(true);
        expect(typeof link.label).toBe("string");
        expect(link.label.length).toBeGreaterThan(0);
        expect(typeof link.order).toBe("number");
      }
    }
  });
});
