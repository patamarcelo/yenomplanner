// Transactions can carry a category slug (modal) or a numeric ID (inline edits).
// Both keys must resolve to the same category and canonical chart key.
export function buildCategoryLookup(categories = []) {
  const lookup = new Map();
  for (const category of categories) {
    if (category?.id != null) lookup.set(String(category.id).trim(), category);
  }
  for (const category of categories) {
    const slug = String(category?.slug ?? '').trim();
    if (slug && !lookup.has(slug)) lookup.set(slug, category);
  }
  return lookup;
}
