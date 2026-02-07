export function formatDateBR(yyyyMmDd) {
  if (!yyyyMmDd) return "—";
  const [y, m, d] = String(yyyyMmDd).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`; // dd-mm-yyyy
}

export function formatMonthBR(yyyyMm) {
  if (!yyyyMm) return "—";
  const [y, m] = String(yyyyMm).split("-");
  if (!y || !m) return "—";
  return `${m}/${y}`; // mm-yyyy
}
