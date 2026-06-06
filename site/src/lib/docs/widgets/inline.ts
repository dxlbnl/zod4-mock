// B102 — minimal inline-tag rendering for TSDoc descriptions.
//
// Descriptions extracted from TSDoc carry raw `{@link X}` tags and literal
// backtick `code` spans. This does a small, safe transform (no markdown
// parser): HTML-escape first, then turn `{@link X}` into the symbol name
// (linked to its on-page anchor) and inline `` `code` `` into <code>.

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Render a TSDoc description as safe HTML with minimal inline-tag support.
 * Input is plain text; output is HTML escaped except for the spans we add.
 */
export function renderInline(text: string): string {
  let out = escapeHtml(text);
  // `{@link Symbol}` (optionally `{@link Symbol | label}`) → anchor link.
  out = out.replace(
    /\{@link\s+([^}|\s]+)(?:\s*\|\s*([^}]+))?\}/g,
    (_m, target: string, label?: string) => {
      const text = (label ?? target).trim();
      return `<a href="#${target.trim()}">${text}</a>`;
    },
  );
  // Inline `code` → <code>code</code>.
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}
