import type { Prng, GeneratorContext } from "../../types.js";
import { firstName, lastName } from "./person.js";
import { noun, TECH_WORDS } from "./word.js";
import { defaultLocale } from "../../default-locale.js";
import { siblingString } from "./sibling.js";

function ascii(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export const DOMAINS = [
  "example.com",
  "test.org",
  "demo.nl",
  "sample.io",
  "mock.dev",
  "website.com",
  "portal.net",
  "app.io",
  "service.co",
  "company.nl",
  "platform.dev",
  "startup.ai",
  "blog.me",
] as const;
const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const DOMAIN_SUFFIXES = [
  "com",
  "net",
  "org",
  "nl",
  "io",
  "dev",
  "ai",
  "app",
  "me",
  "co",
  "info",
  "biz",
  "eu",
  "be",
  "de",
  "uk",
] as const;
const PROTOCOLS = ["http", "https", "ftp", "ssh", "ws", "wss", "tcp", "udp"] as const;
const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "CONNECT",
] as const;
export const EMOJIS = [
  "😀",
  "😂",
  "🚀",
  "🔥",
  "🌈",
  "💻",
  "✨",
  "🍕",
  "🍔",
  "🍦",
  "🎉",
  "❤️",
  "👍",
  "💡",
  "🤔",
  "🙌",
  "😎",
  "💯",
  "✅",
  "🌟",
  "🐱",
  "🐶",
  "🌺",
  "🌍",
  "🚗",
  "📱",
  "🎧",
  "⚽",
  "🏖️",
  "🍷",
] as const;

const EXAMPLE_SUFFIXES = ["com", "net", "org", "nl", "io", "eu"] as const;

const HTTP_STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 500, 502, 503] as const;

const JWT_ALGORITHMS = ["HS256", "HS384", "HS512", "RS256"] as const;

const PASSWORD_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()".split("") as [
    string,
    ...string[],
  ];

export function domainSuffix(prng: Prng): string {
  return prng.pick(DOMAIN_SUFFIXES);
}

const URL_PATHS = [
  "products",
  "dashboard",
  "profile",
  "settings",
  "articles",
  "docs",
  "api",
  "blog",
  "about",
  "contact",
  "search",
  "help",
  "orders",
  "invoices",
  "reports",
  "users",
  "admin",
  "status",
] as const;

export function domainWord(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? defaultLocale;
  const strategy = prng.int(0, 2);
  if (strategy === 0) return prng.pick(TECH_WORDS);
  if (strategy === 1) {
    const prefixes = locale.company.prefixes;
    return prefixes[prng.int(0, prefixes.length - 1)]!.toLowerCase();
  }
  return noun(prng, ctx)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function urlPath(prng: Prng): string {
  return prng.pick(URL_PATHS);
}

export function domainName(prng: Prng): string {
  return `${domainWord(prng)}.${domainSuffix(prng)}`;
}

export function username(prng: Prng, ctx?: GeneratorContext): string {
  const nick = siblingString(ctx, "nickname", "nick", "bijnaam");
  const first = siblingString(ctx, "firstName", "first_name", "voornaam", "forename");
  const last = siblingString(ctx, "lastName", "last_name", "achternaam", "surname");

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
  const last = siblingString(ctx, "lastName", "achternaam", "surname");
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return `${firstName(prng)} ${lastName(prng)}`;
}

// Each strategy declares the siblings it `needs` and how to `build` a local-part
// + domain. email() filters by needs, picks one, and runs build — values are only
// drawn for the winning strategy (no closures over per-call state).
interface EmailCtx {
  prng: Prng;
  /** All ascii-normalised at gather time; "" when the sibling is absent. */
  nick: string;
  first: string;
  last: string;
  companySlug: string;
  /** `<slug>.com` when companySlug is long enough; otherwise "". */
  companyDomain: string;
  companyPrefixes: readonly string[];
  /** Pools used by the composed-handle fallback. */
  adjPool: readonly string[];
  nounPool: readonly string[];
}

interface EmailStrategy {
  needs: (c: EmailCtx) => boolean;
  build: (c: EmailCtx) => { local: string; domain: string };
}

const JOINERS = [".", "", "_"] as const;
const LAST_INITIAL_JOINERS = [".", "_"] as const;

function randomDomain(prng: Prng): string {
  return DOMAINS[prng.int(0, DOMAINS.length - 1)]!;
}

function composeHandle(c: EmailCtx): string {
  // Pattern is picked first so only the draws that pattern uses happen.
  const pickAdj = (): string => ascii(c.adjPool[c.prng.int(0, c.adjPool.length - 1)]!);
  const pickNoun = (): string => ascii(c.nounPool[c.prng.int(0, c.nounPool.length - 1)]!);
  switch (c.prng.int(0, 4)) {
    case 0:
      return `${pickAdj()}_${pickNoun()}`;
    case 1:
      return `${pickAdj()}${pickNoun()}`;
    case 2:
      return `the_${pickNoun()}`;
    case 3:
      return `${pickNoun()}_${pickNoun()}`;
    default:
      return `${pickNoun()}_${c.prng.int(10, 999)}`;
  }
}

const hasNick = (c: EmailCtx): boolean => c.nick.length >= 2;
const hasFirst = (c: EmailCtx): boolean => c.first.length > 0;
const hasLast = (c: EmailCtx): boolean => c.last.length > 0;
const hasFirstAndLast = (c: EmailCtx): boolean => hasFirst(c) && hasLast(c);
const hasCompany = (c: EmailCtx): boolean => c.companySlug.length >= 3;
const hasOnlyFirst = (c: EmailCtx): boolean => hasFirst(c) && !hasLast(c);
const hasOnlyLast = (c: EmailCtx): boolean => !hasFirst(c) && hasLast(c);
const hasNoPersonalOrCompany = (c: EmailCtx): boolean =>
  !hasNick(c) && !hasFirst(c) && !hasLast(c) && !hasCompany(c);

const EMAIL_STRATEGIES: readonly EmailStrategy[] = [
  { needs: hasNick, build: (c) => ({ local: c.nick, domain: "" }) },
  {
    needs: hasNick,
    build: (c) => ({ local: `${c.nick}${c.prng.int(10, 99)}`, domain: "" }),
  },
  {
    needs: hasFirstAndLast,
    build: (c) => ({
      local: `${c.first}${c.prng.pick(JOINERS)}${c.last}`,
      domain: "",
    }),
  },
  {
    needs: hasFirstAndLast,
    build: (c) => ({
      local: `${c.first[0]}${c.prng.pick(JOINERS)}${c.last}`,
      domain: "",
    }),
  },
  {
    needs: hasFirstAndLast,
    build: (c) => ({
      local: `${c.first}${c.prng.pick(JOINERS)}${c.last[0]}`,
      domain: "",
    }),
  },
  { needs: hasFirstAndLast, build: (c) => ({ local: c.last, domain: "" }) },
  { needs: hasFirstAndLast, build: (c) => ({ local: c.first, domain: "" }) },
  { needs: hasOnlyFirst, build: (c) => ({ local: c.first, domain: "" }) },
  {
    needs: hasOnlyFirst,
    build: (c) => ({ local: `${c.first}${c.prng.int(10, 99)}`, domain: "" }),
  },
  { needs: hasOnlyLast, build: (c) => ({ local: c.last, domain: "" }) },
  {
    needs: hasOnlyLast,
    build: (c) => ({
      local: `${c.last[0]}${c.prng.pick(LAST_INITIAL_JOINERS)}${c.last}`,
      domain: "",
    }),
  },
  {
    needs: (c) => hasCompany(c) && c.companyPrefixes.length > 0,
    build: (c) => ({
      local: c.companyPrefixes[c.prng.int(0, c.companyPrefixes.length - 1)]!,
      domain: c.companyDomain,
    }),
  },
  {
    needs: (c) => hasCompany(c) && hasFirstAndLast(c),
    build: (c) => ({ local: `${c.first}.${c.last}`, domain: c.companyDomain }),
  },
  {
    needs: (c) => hasCompany(c) && hasFirst(c),
    build: (c) => ({ local: c.first, domain: c.companyDomain }),
  },
  {
    needs: (c) => hasCompany(c) && hasNick(c),
    build: (c) => ({ local: c.nick, domain: c.companyDomain }),
  },
  {
    needs: (c) => hasCompany(c) && hasFirst(c),
    build: (c) => ({ local: `${c.first}.${c.companySlug}`, domain: "" }),
  },
  {
    needs: (c) => hasNoPersonalOrCompany(c) && c.adjPool.length > 0 && c.nounPool.length > 0,
    build: (c) => ({ local: composeHandle(c), domain: "" }),
  },
];

export function email(prng: Prng, ctx?: GeneratorContext): string {
  const loc = ctx?.locale ?? defaultLocale;

  const nick = siblingString(ctx, "nickname", "nick", "bijnaam");
  let first = siblingString(ctx, "firstName", "first_name", "voornaam");
  let last = siblingString(ctx, "lastName", "last_name", "achternaam");
  // Fall back to splitting a fullname-style sibling (first token → first, last → last).
  if (!first && !last) {
    const full = siblingString(ctx, "fullName", "full_name", "volledigeNaam");
    if (full) {
      const tokens = full.trim().split(/\s+/);
      if (tokens.length >= 2) {
        first = tokens[0];
        last = tokens.at(-1);
      } else if (tokens.length === 1 && tokens[0]) {
        first = tokens[0];
      }
    }
  }
  const company = siblingString(ctx, "company", "companyName", "company_name", "bedrijf");

  // All company-name tokens contribute to the slug, joined with one separator
  // picked per call (e.g. "Karp Associates" → karp.associates / karp_associates).
  const companyTokens = company
    ? company
        .split(/\s+/)
        .map(ascii)
        .filter((t) => t.length >= 2)
    : [];
  const companyJoiner = companyTokens.length > 1 ? ([".", "_", ""] as const)[prng.int(0, 2)]! : "";
  const companySlug = companyTokens.join(companyJoiner);

  const c: EmailCtx = {
    prng,
    nick: nick ? ascii(nick) : "",
    first: first ? ascii(first) : "",
    last: last ? ascii(last.split(" ").at(-1) ?? "") : "",
    companySlug,
    companyDomain: companySlug.length >= 3 ? `${companySlug}.${domainSuffix(prng)}` : "",
    companyPrefixes: loc.internet?.emailCompanyPrefixes ?? [],
    adjPool: loc.word.adjectives ?? [],
    nounPool: loc.word.nouns ?? [],
  };

  const eligible = EMAIL_STRATEGIES.filter((s) => s.needs(c));
  if (eligible.length === 0) return `${username(prng)}@${domainName(prng)}`;
  const { local, domain } = eligible[prng.int(0, eligible.length - 1)]!.build(c);
  const dom = domain || randomDomain(prng);
  return local.length >= 2 ? `${local}@${dom}` : `${username(prng)}@${dom}`;
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
  return `https://${domainName(prng)}/${urlPath(prng)}`;
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
    `Linux; Android ${prng.int(10, 14)}; SM-G${prng.int(900, 999)}B`,
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
  // B64URL has 64 chars — mask with 0x3F for zero-bias byte→index mapping
  const seg = (b: Uint8Array) => Array.from(b, (v) => B64URL[v! & 0x3f]!).join("");
  return `${seg(prng.bytes(36))}.${seg(prng.bytes(64))}.${seg(prng.bytes(42))}`;
}
