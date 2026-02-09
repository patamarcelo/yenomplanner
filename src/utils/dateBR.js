export function formatDateBR(yyyyMmDd) {
  if (!yyyyMmDd) return "—";
  const [y, m, d] = String(yyyyMmDd).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`; // dd-mm-yyyy
}

export function formatMonthBR(ym) {
  if (!ym) return "Todos"; // ✅ aqui resolve a home inteira quando month==""
  const [y, m] = String(ym).split("-");
  if (!y || !m) return "—";
  const mm = Number(m);
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[mm - 1] || m}/${y}`;
}
