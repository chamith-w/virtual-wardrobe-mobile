/** Small text helpers for user-typed values. Pure — safe to import from tests. */

/** Collapses runs of whitespace and trims; null when nothing is left. */
export function cleanName(raw: string, max = 60): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return name.length > 0 ? name : null;
}

/** "camel wool coat" → "Camel wool coat". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
