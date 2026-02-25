export function formatBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBRLNegativeValues(value) {
  const n = Number(value || 0) * -1;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
