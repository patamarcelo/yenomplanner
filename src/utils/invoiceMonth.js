// src/utils/invoiceMonth.js
export function normalizeYM(v) {
    const s0 = String(v || "").trim();
    if (!s0) return "";

    const iso = s0.match(/^(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;

    const br = s0.match(/^(\d{2})\/(\d{4})/);
    if (br) return `${br[2]}-${br[1]}`;

    const slash = s0.match(/^(\d{4})\/(\d{2})/);
    if (slash) return `${slash[1]}-${slash[2]}`;

    return s0.slice(0, 7);
}

export function resolveInvoiceYM(row, accountsById) {
    const r = row?.instance ? row.instance : (row || {});
    const acc = r.accountId ? accountsById?.[r.accountId] : null;
    const isCC = acc?.type === "credit_card";

    if (isCC) {
        const inv = r.invoiceMonth || r.invoice_month;
        return inv ? normalizeYM(inv) : "";
    }

    const p = r.purchaseDate || r.purchase_date;
    return p ? normalizeYM(p) : "";
}
