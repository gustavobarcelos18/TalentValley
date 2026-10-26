// Navigation helpers shared by the two views of the talent comparison (A | in common | B and the resume table).
// Both views keep the same two `slugs` query values, so switching view never asks to select the talents again.

export const COMPARISON_PATH = "/recrutador/comparar";
export const COMPARISON_TABLE_PATH = "/recrutador/comparar/tabela";

export type ComparisonSlugs = readonly [string, string];

/** Exactly two different, non-blank slugs; anything else is not a valid comparison. */
export function comparisonSlugs(params: Pick<URLSearchParams, "getAll">): ComparisonSlugs | null {
  const values = params.getAll("slugs");
  return values.length === 2 && values[0].trim() && values[1].trim() && values[0] !== values[1]
    ? [values[0], values[1]]
    : null;
}

export function comparisonHref(path: string, slugs: ComparisonSlugs): string {
  return `${path}?slugs=${encodeURIComponent(slugs[0])}&slugs=${encodeURIComponent(slugs[1])}`;
}
