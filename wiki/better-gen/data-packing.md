# Optimized Data Packing

## The Technique

V8 parses array literals like `["Alice", "Bob", "Charlie", ...]` by tokenizing each string individually as AST nodes. A large array of 500 strings creates 500 string tokens during module parse.

Storing the same data as a single delimited string avoids this:

```typescript
const names = "Alice|Bob|Charlie|David|...".split("|");
```

V8 skips string tokenization and calls `.split()` natively in optimized C++ code. For large lists this can meaningfully reduce cold-start module parse time.

## When to Apply It

**Apply only to large static lists that will never be individually tree-shaken.** This is the key constraint.

| Situation | Use packing? |
|-----------|:---:|
| A 500-name corpus in a built-in locale file | ✅ |
| A 50-entry list inside a locale module users import whole | ✅ |
| Individual exported `const` arrays users may import selectively | ❌ |
| Any list under ~50 entries (parse overhead is trivial) | ❌ |

## The Tree-Shaking Conflict

A packed string cannot be tree-shaken:

```typescript
// This entire string is either included or excluded as a unit
const names = "Alice|Bob|Charlie|...".split("|");
```

Individual exports *can* be tree-shaken:

```typescript
export const maleNames   = ["James", "John", "Robert", ...];
export const femaleNames = ["Mary", "Patricia", "Linda", ...];
```

If a user only needs `femaleNames`, the bundler can drop `maleNames`. Packing them into one string defeats this.

**Conclusion:** Apply data packing inside locale modules (which users import as a whole), never to individually-exported constants. After the Markov refactor, most large name lists will be replaced by compact model tables anyway — reducing the scope where packing is even relevant.

## Alternative: Base-N Encoding for Short-Code Lists

For datasets made of short codes (ISO currency codes, country codes, language tags), a space-separated string is cleaner than a pipe-delimited one and equally fast:

```typescript
const currencies = "USD EUR GBP JPY CAD AUD CHF".split(" ");
```

This is both compact and readable. Reserve `|` delimiters for data that may contain spaces (city names, full names, product descriptions).

---

See also: [Back to Index](index.md)
