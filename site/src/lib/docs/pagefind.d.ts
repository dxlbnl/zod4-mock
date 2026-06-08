// B104 — typing for the runtime-only Pagefind bundle.
//
// `/pagefind/pagefind.js` is emitted by the build's index step and served from
// the static root; it is not resolvable at build time. These types let DocsSearch
// query the dynamically-imported bundle with full typing and no `any` (D1).

// A sub-result is an anchored location within a page (a heading section).
// `sub_results[0]` is the most relevant section for the query; its `url`
// carries the `#heading` fragment so a hit can scroll to the matched section.
export interface PagefindSubResultAnchor {
  readonly element: string;
  readonly id: string;
  readonly text?: string;
}
export interface PagefindSubResult {
  readonly title: string;
  readonly url: string;
  readonly anchor?: PagefindSubResultAnchor;
}
export interface PagefindResultData {
  readonly url: string;
  readonly excerpt: string;
  readonly meta: Record<string, string>;
  readonly sub_results?: ReadonlyArray<PagefindSubResult>;
}
export interface PagefindResult {
  readonly id: string;
  readonly data: () => Promise<PagefindResultData>;
}
export interface PagefindSearchResponse {
  readonly results: ReadonlyArray<PagefindResult>;
}
export type PagefindFilterCounts = Record<string, Record<string, number>>;

export interface PagefindApi {
  search: (query: string) => Promise<PagefindSearchResponse>;
  filters: () => Promise<PagefindFilterCounts>;
}
