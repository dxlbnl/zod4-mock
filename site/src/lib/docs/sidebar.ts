/**
 * B100-R10 — typed docs sidebar manifest.
 *
 * Source of truth for `site/src/routes/docs/+layout.svelte`. Adding or
 * reordering doc routes happens here.
 */

export type SidebarLinkId = string;

export type SidebarGroupId = "concepts" | "reference" | "guides" | "how-to";

export type SidebarLink = {
  readonly href: string;
  readonly label: string;
  readonly order: number;
};

export type SidebarGroup = {
  readonly id: SidebarGroupId;
  readonly label: string;
  readonly links: ReadonlyArray<SidebarLink>;
};

export const SIDEBAR: ReadonlyArray<SidebarGroup> = [
  {
    id: "concepts",
    label: "Concepts",
    links: [
      { href: "/docs/getting-started", label: "Getting Started", order: 1 },
      { href: "/docs/concepts", label: "Concepts", order: 2 },
    ],
  },
  {
    id: "reference",
    label: "Reference",
    links: [
      { href: "/docs/api", label: "API Reference", order: 1 },
      { href: "/docs/key-heuristics", label: "Key Heuristics", order: 2 },
      { href: "/docs/zod4-schema-coverage", label: "Schema Coverage", order: 3 },
      { href: "/docs/comparison", label: "Comparison", order: 4 },
      { href: "/docs/bugs", label: "Known Bugs", order: 5 },
    ],
  },
  {
    id: "guides",
    label: "Guides",
    links: [{ href: "/docs/relational", label: "Relational Guide", order: 1 }],
  },
  {
    id: "how-to",
    label: "How-to",
    links: [{ href: "/docs/recipes", label: "Recipes", order: 1 }],
  },
];
