// Regra: distribui centavos "para cima" nas primeiras parcelas.
// Ex: 123,23 / 4 = 30,81 + 30,81 + 30,81 + 30,80
export function splitInstallments(total, n) {
  const totalCents = Math.round(Number(total) * 100);
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;

  return Array.from({ length: n }, (_, i) => ((i < rest ? base + 1 : base) / 100));
}
