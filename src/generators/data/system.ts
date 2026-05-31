import type { Prng } from "../../types.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

const PLATFORMS = ["windows", "macos", "linux", "ios", "android"] as const;
const BROWSERS = ["chrome", "firefox", "safari", "edge"] as const;

const FILE_EXTENSIONS = [
  "pdf",
  "jpg",
  "png",
  "gif",
  "mp4",
  "csv",
  "json",
  "xml",
  "zip",
  "docx",
  "xlsx",
  "txt",
  "md",
  "html",
  "ts",
  "js",
] as const;

const MIME_TYPES = [
  "application/json",
  "text/plain",
  "text/html",
  "image/jpeg",
  "image/png",
  "video/mp4",
  "application/pdf",
  "text/csv",
  "application/zip",
  "application/xml",
  "image/gif",
  "text/markdown",
] as const;

const FILE_NAME_BASES = [
  "document",
  "report",
  "invoice",
  "image",
  "photo",
  "backup",
  "export",
  "data",
  "archive",
  "config",
  "notes",
  "log",
  "output",
] as const;

const DIR_COMPONENTS = [
  "documents",
  "downloads",
  "projects",
  "data",
  "config",
  "logs",
  "backup",
  "exports",
  "assets",
  "uploads",
  "src",
  "dist",
] as const;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function platform(prng: Prng): string {
  return prng.pick(PLATFORMS);
}

export function browser(prng: Prng): string {
  return prng.pick(BROWSERS);
}

export function semver(prng: Prng): string {
  return `${prng.int(0, 10)}.${prng.int(0, 20)}.${prng.int(0, 99)}`;
}

export function fileExtension(prng: Prng): string {
  return prng.pick(FILE_EXTENSIONS);
}

export function mimeType(prng: Prng): string {
  return prng.pick(MIME_TYPES);
}

export function fileName(prng: Prng): string {
  return `${prng.pick(FILE_NAME_BASES)}_${prng.int(1, 999)}.${fileExtension(prng)}`;
}

export function filePath(prng: Prng): string {
  const depth = prng.int(1, 3);
  const dirs = Array.from({ length: depth }, () => prng.pick(DIR_COMPONENTS));
  return `/${dirs.join("/")}/${fileName(prng)}`;
}
