import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAccountBalanceDebug } from '../src/utils/accountBalanceDebug.js';
import { txnApiToUi } from '../src/store/transactionsAdapter.js';

test('diagnostic explains the displayed balance, raw signs and excluded bills without personal fields', () => {
  const account = { id: 'bank', type: 'checking', openingBalance: 130000, bankDetails: 'PRIVATE' };
  const raw = [
    { id: 'paid', account_id: 'bank', bill_id: 'bill', amount_cents: -300000, direction: 'expense', status: 'paid', description: 'PRIVATE', token: 'PRIVATE' },
    { id: 'planned', account_id: 'bank', bill_id: 'bill-2', amount_cents: 50000, direction: 'expense', status: 'planned' },
    { id: 'income', account_id: 'bank', amount_cents: 100000, direction: 'income', status: 'paid' },
  ];
  const report = buildAccountBalanceDebug([account], raw.map(txnApiToUi), raw);
  const bank = report.accounts[0];
  assert.equal(bank.displayedBalance, 128000);
  assert.equal(bank.paidExpenses, 3000);
  assert.equal(bank.paidIncome, 1000);
  assert.equal(bank.transactions[0].apiAmountCents, -300000);
  assert.equal(bank.transactions[0].uiAmount, -3000);
  assert.equal(bank.transactions[1].included, false);
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
});
