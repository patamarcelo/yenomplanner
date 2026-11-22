export function buildMonthlyTooltipComparison(payload = []) {
  const rows = payload
    .filter((item) => item.value != null && Number.isFinite(Number(item.value)))
    .map((item) => ({ key: String(item.dataKey), name: item.name, value: Number(item.value), color: item.color }))
    .sort((a, b) => b.value - a.value);
  const historical = rows.filter((row) => row.key !== 'atual');
  const average = historical.length > 1
    ? historical.reduce((sum, row) => sum + row.value, 0) / historical.length : null;
  return { rows, average, maximum: Math.max(1, ...rows.map((row) => row.value)) };
}
