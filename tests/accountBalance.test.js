import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcAccountBalance } from '../src/utils/accountBalance.js';
import { txnApiToUi } from '../src/store/transactionsAdapter.js';

const bank = { id: 'bank', type: 'checking', openingBalance: 130000 };
const payment = {
  id: 'payment', account_id: bank.id, bill_id: 'bill',
  amount_cents: 300000, direction: 'expense', status: 'paid',
};
const balance = (transactions) => calcAccountBalance(bank, transactions.map(txnApiToUi), [bank]);

test('paying a bill debits 3000 from 130000', () => {
  assert.equal(balance([payment]), 127000);
});

test('changing an expense to income is respected even when linked to a bill', () => {
  const corrected = { ...payment, direction: 'income' };
  assert.equal(txnApiToUi(corrected).direction, 'income');
  assert.equal(balance([corrected]), 133000);
});

test('a genuine income without a bill increases the balance', () => {
  assert.equal(balance([{ ...payment, bill_id: null, direction: 'income' }]), 133000);
});

test('unpaid expenses and payments from another account do not change the bank balance', () => {
  assert.equal(balance([
    { ...payment, status: 'planned' },
    { ...payment, account_id: 'another-bank' },
    { ...payment, account_id: 'card', status: 'confirmed' },
  ]), 130000);
});

test('removing a payment when reopening a bill restores the balance', () => {
  assert.equal(balance([payment]), 127000);
  assert.equal(balance([]), 130000);
});

test('a negative expense from the API must not become a positive UI amount', () => {
  const api = { ...payment, amount_cents: -300000 };
  assert.equal(txnApiToUi(api).amount, -3000);
  assert.equal(balance([api]), 127000);
});

test('direction controls income even when stored cents are negative', () => {
  const api = { ...payment, amount_cents: -300000, direction: 'income' };
  assert.equal(txnApiToUi(api).amount, 3000);
  assert.equal(balance([api]), 133000);
});

test('bank calculation handles either sign without subtracting an expense twice', () => {
  for (const amount of [3000, -3000]) {
    assert.equal(calcAccountBalance(bank, [
      { accountId: bank.id, amount, direction: 'expense', status: 'pago' },
    ], [bank]), 127000);
  }
});
