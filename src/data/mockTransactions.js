// invoiceMonth: "YYYY-MM" (no MVP já vem pronto, como seu Excel com Data Cobrança -> Mês Ref)
export const mockTransactions = [];

export function nextTxnId() {
  return `txn_${Math.random().toString(16).slice(2, 10)}`;
}
