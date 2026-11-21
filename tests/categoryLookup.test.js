import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCategoryLookup } from '../src/utils/categoryLookup.js';

const ads = { id: 7, slug: 'anuncios', name: 'Anúncios', color: '#3b82f6' };

test('modal slugs and inline edit IDs resolve to the same category', () => {
  const lookup = buildCategoryLookup([ads]);
  assert.equal(lookup.get('anuncios'), ads);
  assert.equal(lookup.get('7'), ads);
});

test('mixed historical representations aggregate into one category without editing records', () => {
  const lookup = buildCategoryLookup([ads]);
  const amounts = [{ category_id: 'anuncios', amount: 150 }, { category_id: '7', amount: 100 }];
  const totals = new Map();
  for (const t of amounts) {
    const key = String(lookup.get(t.category_id)?.id ?? t.category_id);
    totals.set(key, (totals.get(key) || 0) + t.amount);
  }
  assert.deepEqual([...totals], [['7', 250]]);
});

test('numeric category IDs take priority over conflicting legacy numeric slugs', () => {
  const other = { id: 8, slug: '7', name: 'Other' };
  assert.equal(buildCategoryLookup([other, ads]).get('7'), ads);
});
