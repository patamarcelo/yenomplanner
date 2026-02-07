// invoiceMonth: "YYYY-MM" (no MVP já vem pronto, como seu Excel com Data Cobrança -> Mês Ref)
export const mockTransactions = [
  {
    id: "txn_001",
    purchaseDate: "2026-01-28",
    chargeDate: "2026-02-01",
    invoiceMonth: "2026-02",
    cardId: "nubank",
    merchant: "iFood",
    categoryId: "mercado",
    kind: "one_off", // one_off | recurring | installment
    installment: null,
    amount: 76.9,
    notes: "",
    status: "confirmado", // previsto | confirmado
  },
  {
    id: "txn_002",
    purchaseDate: "2026-01-12",
    chargeDate: "2026-02-01",
    invoiceMonth: "2026-02",
    cardId: "porto",
    merchant: "Spotify",
    categoryId: "assinaturas",
    kind: "recurring",
    installment: null,
    amount: 21.9,
    notes: "Mensal",
    status: "confirmado",
  },
  {
    id: "txn_003",
    purchaseDate: "2026-01-05",
    chargeDate: "2026-02-01",
    invoiceMonth: "2026-02",
    cardId: "xp",
    merchant: "Compra Notebook",
    categoryId: "outros",
    kind: "installment",
    installment: { groupId: "inst_100", current: 3, total: 10 },
    amount: 312.35,
    notes: "",
    status: "confirmado",
  },
  // futuras (projeção)
  {
    id: "txn_004",
    purchaseDate: "2026-01-05",
    chargeDate: "2026-03-01",
    invoiceMonth: "2026-03",
    cardId: "xp",
    merchant: "Compra Notebook",
    categoryId: "outros",
    kind: "installment",
    installment: { groupId: "inst_100", current: 4, total: 10 },
    amount: 312.35,
    notes: "",
    status: "previsto",
  },
  {
    id: "txn_005",
    purchaseDate: "2026-02-02",
    chargeDate: "2026-02-01",
    invoiceMonth: "2026-02",
    cardId: "nubank",
    merchant: "Uber",
    categoryId: "transporte",
    kind: "one_off",
    installment: null,
    amount: 29.8,
    notes: "",
    status: "confirmado",
  },
];

export function nextTxnId() {
  return `txn_${Math.random().toString(16).slice(2, 10)}`;
}
