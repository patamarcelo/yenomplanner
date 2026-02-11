// src/api/billsApi.js
import http from "./http";

function moneyToCents(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
}

function centsToMoney(c) {
    if (c === null || c === undefined) return null;
    return Number(c) / 100;
}

function monthToISODate(ym) {
    if (!ym) return null;
    if (String(ym).length === 7) return `${ym}-01`;
    return ym;
}

// API -> UI
export function mapBillFromApi(b) {
    if (!b) return null;

    return {
        id: b.id,
        name: b.name,
        payee: b.payee || "",
        categoryId: b.category_id || "outros",
        notes: b.notes || "",
        kind: b.kind, // recurring | installment | one_off
        defaultAmount: centsToMoney(b.default_amount_cents),
        dayOfMonth: b.day_of_month ?? 10,
        startMonth: b.start_month ? String(b.start_month).slice(0, 7) : "",
        endMonth: b.end_month ? String(b.end_month).slice(0, 7) : "",
        active: b.active !== false,

        // opcionais (se você expor no serializer)
        lastPaidTransactionId: b.last_paid_transaction || null,
        lastPaidAt: b.last_paid_at || null,
        installmentGroupId: b.installment_group_id || null,
        installmentCurrent: b.installment_current ?? null,
        installmentTotal: b.installment_total ?? null,
    };
}

// UI -> API (POST create)
export function mapBillToApiPayload(b) {
    return {
        name: b.name ?? "",
        payee: b.payee ?? "",
        category_id: b.categoryId ?? "outros",
        notes: b.notes ?? "",
        kind: b.kind ?? "recurring",
        default_amount_cents: moneyToCents(b.defaultAmount),
        currency: "BRL",
        day_of_month: Number(b.dayOfMonth ?? 10),
        start_month: monthToISODate(b.startMonth),
        end_month: monthToISODate(b.endMonth),
        active: b.active ?? true,
    };
}

// PATCH parcial (não pode “zerar” campos que não vieram)
function mapBillPatchToApiPayload(patch) {
    const out = {};
    if (!patch) return out;

    if ("name" in patch) out.name = patch.name ?? "";
    if ("payee" in patch) out.payee = patch.payee ?? "";
    if ("categoryId" in patch) out.category_id = patch.categoryId ?? "outros";
    if ("notes" in patch) out.notes = patch.notes ?? "";
    if ("kind" in patch) out.kind = patch.kind ?? "recurring";
    if ("defaultAmount" in patch) out.default_amount_cents = moneyToCents(patch.defaultAmount);
    if ("dayOfMonth" in patch) out.day_of_month = Number(patch.dayOfMonth ?? 10);
    if ("startMonth" in patch) out.start_month = monthToISODate(patch.startMonth);
    if ("endMonth" in patch) out.end_month = monthToISODate(patch.endMonth);
    if ("active" in patch) out.active = patch.active ?? true;

    // currency sempre BRL no teu caso
    return out;
}

export async function listBills() {
    const { data } = await http.get("/yenomplanner/bills/");
    console.log('data', data)
    return (data || []).map(mapBillFromApi);
}

export async function createBill(bill) {
    const payload = mapBillToApiPayload(bill);
    const { data } = await http.post("/yenomplanner/bills/", payload);
    return mapBillFromApi(data);
}

export async function updateBill(id, patch) {
    const payload = mapBillPatchToApiPayload(patch);
    const { data } = await http.patch(`/yenomplanner/bills/${id}/`, payload);
    return mapBillFromApi(data);
}

export async function deleteBill(id) {
    await http.delete(`/yenomplanner/bills/${id}/`);
    return id;
}

export async function generateBillTransactions(id, body) {
    const { data } = await http.post(`/yenomplanner/bills/${id}/generate/`, body);
    return data;
}

// ✅ Pagar (backend cria Transaction paid e pode retornar bill atualizada)
export async function payBill(id, body) {
    const { data } = await http.post(`/yenomplanner/bills/${id}/pay/`, body);

    // aceita dois formatos: { bill, transaction } OU direto bill
    const billObj = data?.bill || data;
    return {
        bill: mapBillFromApi(billObj),
        transaction: data?.transaction || null,
    };
}

// ✅ Reabrir (backend apaga a Transaction e limpa last_paid_*)
export async function reopenBill(id) {
    const { data } = await http.post(`/yenomplanner/bills/${id}/reopen/`);
    const billObj = data?.bill || data;
    return {
        bill: mapBillFromApi(billObj),
        deleted_transaction_id: data?.deleted_transaction_id || null,
    };
}


// billsApi.js
export async function deleteBillSeries(installmentGroupId) {
    await http.delete(`/yenomplanner/bills/series/`, {
        data: { installment_group_id: installmentGroupId },
    });
    return installmentGroupId;
}