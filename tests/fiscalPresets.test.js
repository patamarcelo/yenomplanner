import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFiscalPreset, clearFiscalPreset } from '../src/utils/fiscalPresets.js';
const form = { idempotency_key: 'fixed', issueDate: '2026-11-23', competence: '2026-11-01', dueDate: '2026-12-01', complemento: 'Previous' };
const preset = { cnpj: '12345678000195', name: 'Monthly client', amount: '2500.00', description: 'Monthly service', address: { logradouro: 'Street', numero: '5', cep: '01001000', bairro: 'Centro', codigoMunicipioIbge: '3550308' } };
test('customer preset fills imported values while preserving current dates and request identity', () => {
  const filled = applyFiscalPreset(form, preset);
  assert.equal(filled.amount, '2500.00');
  assert.equal(filled.description, 'Monthly service');
  assert.equal(filled.logradouro, 'Street');
  assert.equal(filled.preset_cnpj, preset.cnpj);
  assert.equal(filled.complemento, '');
  for (const key of ['idempotency_key', 'issueDate', 'competence', 'dueDate']) assert.equal(filled[key], form[key]);
});
test('typing a new CNPJ clears previous customer values and fiscal preset', () => {
  const cleared = clearFiscalPreset(applyFiscalPreset(form, preset), '999');
  assert.equal(cleared.cnpj, '999');
  for (const key of ['preset_cnpj', 'amount', 'description', 'name', 'logradouro', 'complemento']) assert.equal(cleared[key], '');
  assert.equal(cleared.issueDate, form.issueDate);
});
