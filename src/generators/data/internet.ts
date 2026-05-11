import type { Prng } from "../../types.js";
import { firstName, lastName } from "./person.js";
import { noun } from "./word.js";

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export const DOMAINS = ["example.com", "test.org", "demo.nl", "sample.io", "mock.dev"] as const;
const DOMAIN_SUFFIXES = ["com", "net", "org", "nl", "io", "dev", "ai", "app", "me", "co"] as const;
const PROTOCOLS = ["http", "https", "ftp", "ssh", "ws", "wss"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;
export const EMOJIS = ["😀", "😂", "🚀", "🔥", "🌈", "💻", "✨", "🍕", "🍔", "🍦"] as const;

const EXAMPLE_SUFFIXES = ["com", "net", "org", "nl"] as const;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
] as const;

const HTTP_STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 500, 502, 503] as const;

const JWT_ALGORITHMS = ["HS256", "HS384", "HS512", "RS256"] as const;

const PASSWORD_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()".split("") as [
    string,
    ...string[],
  ];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function domainSuffix(prng: Prng): string {
  return prng.pick(DOMAIN_SUFFIXES);
}

export function domainWord(prng: Prng): string {
  return noun(prng)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function domainName(prng: Prng): string {
  return `${domainWord(prng)}.${domainSuffix(prng)}`;
}

export function username(prng: Prng): string {
  const fn = firstName(prng).toLowerCase();
  const ln = lastName(prng).toLowerCase().replace(/\s/g, "");
  return prng.random() < 0.5 ? `${fn}.${ln}` : `${fn}${prng.int(10, 99)}`;
}

export function displayName(prng: Prng): string {
  return `${firstName(prng)} ${lastName(prng)}`;
}

export function email(prng: Prng): string {
  return `${username(prng)}@${domainName(prng)}`;
}

export function exampleEmail(prng: Prng): string {
  return `${username(prng)}@voorbeeld.${prng.pick(EXAMPLE_SUFFIXES)}`;
}

export function emoji(prng: Prng): string {
  return prng.pick(EMOJIS);
}

export function password(prng: Prng, length = 12): string {
  return Array.from({ length: length }, () => prng.pick(PASSWORD_CHARS)).join("");
}

export function protocol(prng: Prng): string {
  return prng.pick(PROTOCOLS);
}

export function url(prng: Prng): string {
  return `https://${domainName(prng)}/${domainWord(prng)}`;
}

export function userAgent(prng: Prng): string {
  return prng.pick(USER_AGENTS);
}

export function ipv4(prng: Prng): string {
  return Array.from({ length: 4 }, () => prng.int(0, 255)).join(".");
}

export function ip(prng: Prng): string {
  return ipv4(prng);
}

export function ipv6(prng: Prng): string {
  return Array.from({ length: 8 }, () => prng.int(0, 65535).toString(16)).join(":");
}

export function port(prng: Prng): number {
  return prng.int(1, 65535);
}

export function mac(prng: Prng): string {
  return Array.from({ length: 6 }, () => prng.int(0, 255).toString(16).padStart(2, "0")).join(":");
}

export function httpMethod(prng: Prng): string {
  return prng.pick(HTTP_METHODS);
}

export function httpStatusCode(prng: Prng): number {
  return prng.pick(HTTP_STATUS_CODES);
}

export function jwtAlgorithm(prng: Prng): string {
  return prng.pick(JWT_ALGORITHMS);
}

export function jwt(prng: Prng): string {
  // Just return random alphanumeric segments to simulate a JWT structure
  const segment = (len: number) =>
    Array.from({ length: len }, () => prng.int(0, 15).toString(16)).join("");
  return `${segment(36)}.${segment(64)}.${segment(42)}`;
}
