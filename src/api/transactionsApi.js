// src/api/transactionsApi.js
import http from "./http";

// helpers
function ymToInvoiceDate(ym) {
    // "YYYY-MM" -> "YYYY-MM-01"
    if (!ym) return null;
    const s = String(ym);
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
    return s; // se já vier "YYYY-MM-DD"
}

function mapTransactionToApiPayload(t = {}) {
    // aceita tanto camelCase (UI) quanto snake_case (API)
    const purchaseDate = t.purchaseDate ?? t.purchase_date ?? null;
    const chargeDate = t.chargeDate ?? t.charge_date ?? null;
    const invoiceMonth = t.invoiceMonth ?? t.invoice_month ?? null;

    return {
        client_id: t.clientId ?? t.client_id ?? null,

        purchase_date: purchaseDate,
        charge_date: chargeDate,

        // ✅ DRF espera DATE ("YYYY-MM-DD"), e você usa "YYYY-MM" no UI
        invoice_month: ymToInvoiceDate(invoiceMonth),

        // ✅ serializer usa "account_id" (PrimaryKeyRelatedField source="account")
        account_id: t.accountId ?? t.account_id ?? null,

        bill_id: t.billId ?? t.bill_id ?? null,

        merchant: t.merchant ?? "",
        description: t.description ?? "",
        category_id: t.categoryId ?? t.category_id ?? "outros",

        // ✅ seu serializer converte "amount" -> amount_cents no validate()
        // então mande string, ex "1234,56" ou "1234.56"
        amount: t.amount ?? undefined,

        currency: t.currency ?? "BRL",
        status: t.status ?? "planned",
        direction: t.direction ?? "expense",
        kind: t.kind ?? "one_off",

        notes: t.notes ?? "",
    };
}

export async function listTransactions() {
    const { data } = await http.get("/yenomplanner/transactions/");
    return data;
}

export async function createTransactionApi(payload) {
    const body = mapTransactionToApiPayload(payload);
    const { data } = await http.post("/yenomplanner/transactions/", body);
    return data;
}

export async function patchTransaction(id, patch) {
    const body = mapTransactionToApiPayload(patch);

    // PATCH: não mande campos undefined (DRF às vezes reclama)
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    const { data } = await http.patch(`/yenomplanner/transactions/${id}/`, body);
    return data;
}

export async function deleteTransactionApi(id) {
    await http.delete(`/yenomplanner/transactions/${id}/`);
    return id;
}
