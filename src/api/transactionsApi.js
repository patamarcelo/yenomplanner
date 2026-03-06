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

    // suporta parcelas em flat OU dentro de t.installment
    const inst = t.installment || {};

    const installment_group_id =
        t.installment_group_id ??
        t.installmentGroupId ??
        inst.groupId ??
        inst.group_id ??
        null;

    const installment_current =
        t.installment_current ??
        t.installmentCurrent ??
        inst.current ??
        inst.installment_current ??
        null;

    const installment_total =
        t.installment_total ??
        t.installmentTotal ??
        inst.total ??
        inst.installment_total ??
        null;

    return {
        client_id: t.clientId ?? t.client_id ?? null,
        purchase_date: purchaseDate,
        charge_date: chargeDate,
        invoice_month: ymToInvoiceDate(invoiceMonth),
        account_id: t.accountId ?? t.account_id ?? null,
        bill_id: t.billId ?? t.bill_id ?? null,
        merchant: t.merchant ?? "",
        description: t.description ?? "",
        category_id: t.categoryId ?? t.category_id ?? "outros",
        amount: t.amount ?? undefined,
        currency: t.currency ?? "BRL",
        status: t.status ?? "planned",
        direction: t.direction ?? "expense",
        kind: t.kind ?? "one_off",
        installment_group_id,
        installment_current,
        installment_total,
        recurring_rule: t.recurringRule ?? t.recurring_rule ?? null,
        notes: t.notes ?? "",
    };
}

function mapTransactionPatchToApiPayload(patch = {}) {
    const body = {};

    if ("clientId" in patch || "client_id" in patch) {
        body.client_id = patch.clientId ?? patch.client_id ?? null;
    }

    if ("purchaseDate" in patch || "purchase_date" in patch) {
        body.purchase_date = patch.purchaseDate ?? patch.purchase_date ?? null;
    }

    if ("chargeDate" in patch || "charge_date" in patch) {
        body.charge_date = patch.chargeDate ?? patch.charge_date ?? null;
    }

    if ("invoiceMonth" in patch || "invoice_month" in patch) {
        const raw = patch.invoiceMonth ?? patch.invoice_month ?? null;
        body.invoice_month = ymToInvoiceDate(raw);
    }

    if ("accountId" in patch || "account_id" in patch) {
        body.account_id = patch.accountId ?? patch.account_id ?? null;
    }

    if ("billId" in patch || "bill_id" in patch) {
        body.bill_id = patch.billId ?? patch.bill_id ?? null;
    }

    if ("invoiceId" in patch || "invoice_id" in patch) {
        body.invoice_id = patch.invoiceId ?? patch.invoice_id ?? null;
    }

    if ("merchant" in patch) {
        body.merchant = patch.merchant ?? "";
    }

    if ("description" in patch) {
        body.description = patch.description ?? "";
    }

    if ("categoryId" in patch || "category_id" in patch) {
        body.category_id = patch.categoryId ?? patch.category_id ?? null;
    }

    if ("amount" in patch) {
        body.amount = patch.amount;
    }

    if ("currency" in patch) {
        body.currency = patch.currency ?? "BRL";
    }

    if ("status" in patch) {
        body.status = patch.status;
    }

    if ("direction" in patch) {
        body.direction = patch.direction;
    }

    if ("kind" in patch) {
        body.kind = patch.kind;
    }

    if ("installment_group_id" in patch || "installmentGroupId" in patch) {
        body.installment_group_id =
            patch.installment_group_id ?? patch.installmentGroupId ?? null;
    }

    if ("installment_current" in patch || "installmentCurrent" in patch) {
        body.installment_current =
            patch.installment_current ?? patch.installmentCurrent ?? null;
    }

    if ("installment_total" in patch || "installmentTotal" in patch) {
        body.installment_total =
            patch.installment_total ?? patch.installmentTotal ?? null;
    }

    if ("recurringRule" in patch || "recurring_rule" in patch) {
        body.recurring_rule = patch.recurringRule ?? patch.recurring_rule ?? null;
    }

    if ("notes" in patch) {
        body.notes = patch.notes ?? "";
    }

    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    return body;
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
    const body = mapTransactionPatchToApiPayload(patch);
    const { data } = await http.patch(`/yenomplanner/transactions/${id}/`, body);
    return data;
}

export async function deleteTransactionApi(id) {
    await http.delete(`/yenomplanner/transactions/${id}/`);
    return id;
}