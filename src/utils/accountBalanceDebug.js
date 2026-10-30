import { calcAccountBalance, resolveTxnAccountId, signedAmount } from './accountBalance.js';

// Explicit allowlist: never include descriptions, names, tokens or bank details.
export function buildAccountBalanceDebug(accounts, uiTransactions, apiTransactions) {
  const rawById = new Map(apiTransactions.map((t) => [String(t.id), t]));
  const rows = uiTransactions.map((t) => {
    const raw = rawById.get(String(t.id)) || {};
    return {
      transactionId: t.id,
      billId: t.billId,
      accountId: resolveTxnAccountId(t, accounts),
      apiAmountCents: raw.amount_cents,
      apiDirection: raw.direction,
      apiStatus: raw.status,
      uiAmount: t.amount,
      uiDirection: t.direction,
      uiStatus: t.status,
      chargeDate: t.chargeDate,
      signedAmount: signedAmount(t),
    };
  });

  return {
    diagnosticVersion: 1,
    currency: 'BRL',
    formula: 'openingBalance + paidIncome - paidExpenses',
    unassignedTransactions: rows.filter((r) => !r.accountId),
    accounts: accounts.filter((a) => a.type === 'checking').map((account) => {
      const transactions = rows
        .filter((r) => String(r.accountId) === String(account.id))
        .map((r) => ({ ...r, included: String(r.uiStatus || '').toLowerCase() === 'pago' }));
      const included = transactions.filter((r) => r.included);
      return {
        accountId: account.id,
        openingBalance: account.openingBalance,
        paidIncome: included.reduce((sum, r) => sum + Math.max(0, r.signedAmount), 0),
        paidExpenses: included.reduce((sum, r) => sum + Math.max(0, -r.signedAmount), 0),
        displayedBalance: calcAccountBalance(account, uiTransactions, accounts),
        transactions,
      };
    }),
  };
}
