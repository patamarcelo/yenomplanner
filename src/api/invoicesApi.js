import http from "./http";

export async function listInvoices() {
  const { data } = await http.get("/yenomplanner/invoices/");

  // ✅ DRF paginado: { count, results: [...] }
  if (data && Array.isArray(data.results)) return data.results;

  // ✅ DRF não paginado: [...]
  if (Array.isArray(data)) return data;

  return [];
}


export async function closeInvoice({ account_id, statement_month }) {
    const { data } = await http.post("/yenomplanner/invoices/close/", {
        account_id,
        statement_month, // "YYYY-MM-01"
    });
    return data;
}

export async function payInvoice(id, { paid_date, payment_account_id, amount_cents }) {
    const { data } = await http.post(`/yenomplanner/invoices/${id}/pay/`, {
        paid_date, // "YYYY-MM-DD"
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