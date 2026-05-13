import type { Prng, GeneratorContext } from "../../types.js";
import { firstName, lastName } from "./person.js";
import { noun } from "./word.js";
import { siblingString } from "./sibling.js";

/** Strip diacritics and keep only a-z. */
function ascii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export const DOMAINS = ["example.com", "test.org", "demo.nl", "sample.io", "mock.dev", "website.com", "portal.net", "app.io", "service.co", "company.nl", "platform.dev", "startup.ai", "blog.me"] as const;
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DOMAIN_SUFFIXES = ["com", "net", "org", "nl", "io", "dev", "ai", "app", "me", "co", "info", "biz", "eu", "be", "de", "uk"] as const;
const PROTOCOLS = ["http", "https", "ftp", "ssh", "ws", "wss", "tcp", "udp"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT"] as const;
export const EMOJIS = ["😀", "😂", "🚀", "🔥", "🌈", "💻", "✨", "🍕", "🍔", "🍦", "🎉", "❤️", "👍", "💡", "🤔", "🙌", "😎", "💯", "✅", "🌟", "🐱", "🐶", "🌺", "🌍", "🚗", "📱", "🎧", "⚽", "🏖️", "🍷"] as const;

const EXAMPLE_SUFFIXES = ["com", "net", "org", "nl", "io", "eu"] as const;

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

export function username(prng: Prng, ctx?: GeneratorContext): string {
  const nick  = siblingString(ctx, "nickname", "nick", "bijnaam");
  const first = siblingString(ctx, "firstName", "first_name", "voornaam", "forename");
  const last  = siblingString(ctx, "lastName", "last_name", "achternaam", "surname");

  if (nick) {
    const base = ascii(nick);
    if (base.length >= 2) return prng.random() < 0.4 ? `${base}${prng.int(10, 99)}` : base;
  }
  if (first ?? last) {
    const f = ascii(first ?? "");
    const l = ascii((last ?? "").split(" ").at(-1) ?? "");
    const base = f + l || ascii(first ?? last ?? "");
    if (base.length >= 2) return prng.random() < 0.5 ? `${base}${prng.int(10, 99)}` : base;
  }
  const fn = ascii(firstName(prng));
  const ln = ascii(lastName(prng).split(" ").at(-1) ?? "");
  return prng.random() < 0.5 ? `${fn}${ln}` : `${fn}${prng.int(10, 99)}`;
}

export function displayName(prng: Prng, ctx?: GeneratorContext): string {
  const first = siblingString(ctx, "firstName", "voornaam", "forename");
  const last  = siblingString(ctx, "lastName", "achternaam", "surname");
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return `${firstName(prng)} ${lastName(prng)}`;
}

export function email(prng: Prng, ctx?: GeneratorContext): string {
  const domain = () => DOMAINS[prng.int(0, DOMAINS.length - 1)]!;

  const nick    = siblingString(ctx, "nickname", "nick", "bijnaam");
  const first   = siblingString(ctx, "firstName", "first_name", "voornaam");
  const last    = siblingString(ctx, "lastName", "last_name", "achternaam");
  const company = siblingString(ctx, "company", "companyName", "company_name", "bedrijf");

  if (nick) {
    const local = ascii(nick);
    if (local.length >= 2) return `${local}@${domain()}`;
  }
  if (first ?? last) {
    const f = ascii(first ?? "");
    const l = ascii((last ?? "").split(" ").at(-1) ?? "");
    const local = [f, l].filter(Boolean).join(".");
    if (local.length >= 2) return `${local}@${domain()}`;
  }
  if (company) {
    const prefix = prng.pick(["info", "contact", "hello", "support"] as const);
    const slug = ascii(company.split(" ")[0]!);
    const d = slug.length >= 3 ? `${slug}.nl` : domain();
    return `${prefix}@${d}`;
  }
  return `${username(prng)}@${domainName(prng)}`;
}

export function exampleEmail(prng: Prng, ctx?: GeneratorContext): string {
  return `${username(prng, ctx)}@voorbeeld.${prng.pick(EXAMPLE_SUFFIXES)}`;
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
  const os = prng.pick([
    `Windows NT ${prng.pick(["10.0", "11.0", "6.3", "6.2", "6.1"])}`,
    `Macintosh; Intel Mac OS X 10_${prng.int(10, 15)}_${prng.int(0, 9)}`,
    `Macintosh; ARM Mac OS X 13_${prng.int(0, 5)}_${prng.int(0, 2)}`,
    `X11; Linux x86_64`,
    `X11; Ubuntu; Linux x86_64`,
    `iPhone; CPU iPhone OS ${prng.int(14, 18)}_${prng.int(0, 5)} like Mac OS X`,
    `iPad; CPU OS ${prng.int(14, 18)}_${prng.int(0, 5)} like Mac OS X`,
    `Linux; Android ${prng.int(10, 14)}; SM-G${prng.int(900, 999)}B`
  ]);
  const webkitVersion = `${prng.int(537, 605)}.${prng.int(1, 36)}`;
  const chromeVersion = `${prng.int(90, 130)}.0.${prng.int(4000, 6000)}.${prng.int(100, 200)}`;
  const firefoxVersion = `${prng.int(90, 120)}.0`;
  const safariVersion = `${prng.int(14, 17)}.${prng.int(0, 5)}`;
  
  const browsers: [string, ...string[]] = [
    `AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`,
    `AppleWebKit/${webkitVersion} (KHTML, like Gecko) Version/${safariVersion} Safari/${webkitVersion}`,
    `Gecko/20100101 Firefox/${firefoxVersion}`,
    `AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/${webkitVersion}`,
    `AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion} Edg/${chromeVersion}`,
  ];
  return `Mozilla/5.0 (${os}) ${prng.pick(browsers)}`;
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
  const segment = (len: number) =>
    Array.from({ length: len }, () => B64URL[prng.int(0, 63)]!).join("");
  return `${segment(36)}.${segment(64)}.${segment(42)}`;
}
