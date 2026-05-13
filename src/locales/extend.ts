import type { LocaleData } from "./types.js";

type LocaleOverrides = {
  [K in keyof LocaleData]?: Partial<LocaleData[K]>;
} & { id?: string };

/** Shallow-per-section merge: creates a new locale by overriding individual sections. */
export function extend(base: LocaleData, overrides: LocaleOverrides): LocaleData {
  return {
    ...base,
    ...overrides,
    person:   { ...base.person,   ...overrides.person },
    address:  { ...base.address,  ...overrides.address },
    commerce: { ...base.commerce, ...overrides.commerce },
    company:  { ...base.company,  ...overrides.company },
    word:     { ...base.word,     ...overrides.word },
    finance:  { ...base.finance,  ...overrides.finance },
  };
}
