const KEY = "finance_state_v1";

function ymFromDate(dateStr) {
  const s = String(dateStr || "");
  const parts = s.split("-");
  if (parts.length < 2) return "";
  return `${parts[0]}-${parts[1]}`;
}

function toNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  // aceita "123,45" e "123.45"
  const s = String(v).replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function migrateTxn(t) {
  if (!t || typeof t !== "object") return t;

  // tenta várias chaves possíveis (dependendo do que você salvou antes)
  const purchaseDate =
    t.purchaseDate || t.dataCompra || t.data_compra || t.date || t.data || "";

  const chargeDate =
    t.chargeDate || t.dataCobranca || t.data_cobranca || t.charge || "";

  const invoiceMonth =
    t.invoiceMonth || t.mesFatura || t.mes_fatura || ymFromDate(chargeDate);

  const amount =
    t.amount != null
      ? toNumber(t.amount)
      : t.valor != null
      ? toNumber(t.valor)
      : 0;

  const categoryId = t.categoryId || t.categoriaId || t.categoria || "outros";

  return {
    // mantém tudo que já existia
    ...t,
    // normaliza os campos “oficiais” do app
    purchaseDate,
    chargeDate,
    invoiceMonth,
    amount,
    categoryId,
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw);

    // garante shape + defaults
    const finance = parsed?.finance || {};
    const txnsRaw = Array.isArray(finance.txns) ? finance.txns : [];
    const txns = txnsRaw.map(migrateTxn);

    return {
      ...parsed,
      finance: {
        month: finance.month || "2026-02",
        txns,
      },
    };
  } catch {
    return undefined;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}
