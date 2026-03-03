// src/api/invoicesApi.js
import http from "./http";

export async function listInvoices() {
    const { data } = await http.get("/yenomplanner/invoices/");
    if (data && Array.isArray(data.results)) return data.results;
    if (Array.isArray(data)) return data;
    return [];
}

export async function closeInvoice(payload) {
    // ✅ envia TUDO: account_id, statement_month, tx_ids, due_date, total_cents...
    const { data } = await http.post("/yenomplanner/invoices/close/", payload);
    return data;
}

export async function payInvoice(id, { paid_date, payment_account_id, amount_cents }) {
    const { data } = await http.post(`/yenomplanner/invoices/${id}/pay/`, {
        paid_date,
        payment_account_id,
        ...(amount_cents ? { amount_cents } : {}),
    });
    return data;
}

export async function previewCloseInvoice(payload) {
    const { data } = await http.post("/yenomplanner/invoices/preview_close/", payload);
    return data;
}

export async function reopenInvoice(id) {
    const { data } = await http.post(`/yenomplanner/invoices/${id}/reopen/`, {});
    return data;
}