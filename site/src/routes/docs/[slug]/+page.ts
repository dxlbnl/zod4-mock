import type { PageLoad } from "./$types";
import type { Component } from "svelte";
import { error } from "@sveltejs/kit";

type DocModule = { default: Component; metadata: { title: string; slug: string } };

const modules = import.meta.glob<DocModule>("/content/docs/*.md", { eager: true });

export const load: PageLoad = ({ params }) => {
  const key = `/content/docs/${params.slug}.md`;
  const mod = modules[key];
  if (!mod) error(404, `Doc "${params.slug}" not found`);
  return { component: mod.default, meta: mod.metadata };
};

export const entries = () =>
  Object.keys(modules).map((path) => ({ slug: path.split("/").at(-1)!.replace(".md", "") }));
