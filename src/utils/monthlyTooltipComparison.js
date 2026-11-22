export function buildMonthlyTooltipComparison(payload = []) {
  const rows = payload
    .filter((item) => item.value != null && Number.isFinite(Number(item.value)))
    .map((item) => ({ key: String(item.dataKey), name: item.name, value: Number(item.value), color: item.color }))
    .sort((a, b) => {
      // comp_1 is last month, comp_2 is two months ago; current comes last.
      const offset = (row) => row.key === 'atual' ? -1 : Number(row.key.match(/^comp_(\d+)$/)?.[1] || 0);
      return offset(b) - offset(a);
    });
  const historical = rows.filter((row) => row.key !== 'atual');
  const average = historical.length > 1
    ? historical.reduce((sum, row) => sum + row.value, 0) / historical.length : null;
  return { rows, average, maximum: Math.max(1, ...rows.map((row) => row.value)) };
}

export function isTooltipToday(month, day, today = new Date()) {
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return month === currentMonth && Number(day) === today.getDate();
}
