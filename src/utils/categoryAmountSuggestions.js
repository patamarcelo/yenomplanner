export function getCategoryAmountSuggestions(category) {
  const labels = [category?.slug, category?.name].map((value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  return labels.some((label) => /(^|[^a-z])combustive(l|is)([^a-z]|$)/.test(label))
    ? [100, 150, 200] : [];
}
