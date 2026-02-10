// src/store/transactionsAdapter.js

const STATUS_API_TO_UI = {
    planned: "previsto",
    confirmed: "confirmado",
    paid: "pago",
    overdue: "atraso",
};

const STATUS_UI_TO_API = {
    previsto: "planned",
    confirmado: "confirmed",
    pago: "paid",
    atraso: "overdue",
};

export function apiStatusToUi(v) {
    const s = String(v || "").toLowerCase();
    return STATUS_API_TO_UI[s] || s || "previsto";
}

export function uiStatusToApi(v) {
    const s = String(v || "").toLowerCase();
    return STATUS_UI_TO_API[s] || s || "planned";
}

export function invoiceYmFromApiInvoiceMonth(invoice_month) {
    // api: "YYYY-MM-01" -> ui: "YYYY-MM"
    return typeof invoice_month === "string" ? invoice_month.slice(0, 7) : "";
}

export function txnApiToUi(t) {
    if (!t) return t;

    const cents = Number(t.amount_cents || 0);
    const abs = cents / 100;

    const dir = String(t.direction || "expense").toLowerCase();
    const signed = dir === "income" ? abs : -abs;

    return {
        id: t.id,
        clientId: t.client_id,

        purchaseDate: t.purchase_date, // "YYYY-MM-DD"
        chargeDate: t.charge_date,     // "YYYY-MM-DD"

        // ✅ seu UI usa invoiceMonth = "YYYY-MM"
        invoiceMonth: invoiceYmFromApiInvoiceMonth(t.invoice_month),

        accountId: t.account_id || null,
        billId: t.bill_id || null,

        merchant: t.merchant,
        description: t.description,
        categoryId: t.category_id,

        // ✅ seu UI usa amount number (signed)
        amount: signed,

        currency: t.currency,
        direction: dir, // "expense" | "income"
        kind: t.kind,   // ok
        status: apiStatusToUi(t.status),

        // ✅ seu Grid espera installment {current,total} (opcional)
        installment: t.kind === "installment" ? {
            current: t.installment_current ?? null,
            total: t.installment_total ?? null,
            groupId: t.installment_group_id ?? null,
        } : null,

        notes: t.notes,
    };
}
