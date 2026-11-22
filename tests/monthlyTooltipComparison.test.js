import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMonthlyTooltipComparison } from '../src/utils/monthlyTooltipComparison.js';

test('orders months chronologically and computes historical mean without the current month', () => {
  const result = buildMonthlyTooltipComparison([
    { dataKey: 'atual', name: 'Atual', value: 900 },
    { dataKey: 'comp_1', name: 'Outubro', value: 300 },
    { dataKey: 'comp_2', name: 'Setembro', value: 100 },
    { dataKey: 'comp_3', name: 'Agosto', value: 200 },
  ]);
  assert.deepEqual(result.rows.map((r) => r.value), [200, 100, 300, 900]);
  assert.equal(result.average, 200);
});

test('does not show a mean for only one historical month and retains zero spending', () => {
  const result = buildMonthlyTooltipComparison([{ dataKey: 'atual', value: 10 }, { dataKey: 'comp_1', value: 0 }]);
  assert.equal(result.average, null);
  assert.equal(result.rows.length, 2);
});

test('zero months and invalid entries do not produce invalid bar widths', () => {
  const result = buildMonthlyTooltipComparison([{ dataKey: 'comp_1', value: 0 }, { dataKey: 'comp_2', value: 0 }, { dataKey: 'bad', value: NaN }]);
  assert.equal(result.average, 0);
  assert.equal(result.maximum, 1);
  assert.equal(result.rows.length, 2);
});

test('twelve months use numeric month offsets rather than label or value ordering', () => {
  const result = buildMonthlyTooltipComparison([
    { dataKey: 'comp_2', value: 900 }, { dataKey: 'atual', value: 1 },
    { dataKey: 'comp_12', value: 500 }, { dataKey: 'comp_1', value: 20 },
  ]);
  assert.deepEqual(result.rows.map((r) => r.key), ['comp_12', 'comp_2', 'comp_1', 'atual']);
});
