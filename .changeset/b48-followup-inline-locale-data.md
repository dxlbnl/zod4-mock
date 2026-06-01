---
"@zod4-mock/locale-core": patch
"@zod4-mock/locale-en": patch
"@zod4-mock/locale-nl": patch
"zod4-mock": patch
---

Fix: ship locale data as plain TypeScript constants instead of a brotli blob decompressed at module load. The previous shape (introduced in 0.9.0) used `node:fs` + `node:zlib` and could not run in browsers, MSW, service workers, or edge runtimes. It also shipped the brotli blob outside the package `files` allowlist, causing "blob not found" errors at runtime. Universal-runtime fix: the data layer is now a barrel of TypeScript `string[]` exports the consumer's bundler can compress as it sees fit. No public API change; the `LocaleData` shape pinned in 0.9.0 is preserved.
