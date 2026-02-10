// src/api/accountsApi.js
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

// API -> Front shape
export function mapAccountFromApi(a) {
    return {
        id: a.id, // UUID (vamos usar isso como id principal no front)
        externalId: a.external_id,
        type: a.type,
        name: a.name,
        color: a.color,
        active: !!a.active,
        openingBalance: centsToMoney(a.opening_balance_cents) || 0,
        limit: centsToMoney(a.limit_cents),
        statement:
            a.type === "credit_card"
                ? { cutoffDay: a.cutoff_day ?? null, dueDay: a.due_day ?? null }
                : null,
    };
}

// Front -> API payload
export function mapAccountToApiPayload(acc) {
    return {
        external_id: acc.externalId || acc.external_id || acc.id || "",
        type: acc.type || "checking",
        name: acc.name || "",
        color: acc.color || "rgba(0,0,0,0.08)",
        active: acc.active ?? true,
        opening_balance_cents: moneyToCents(acc.openingBalance ?? 0) ?? 0,
        limit_cents: acc.type === "credit_card" ? moneyToCents(acc.limit ?? 0) : null,
        cutoff_day: acc.type === "credit_card" ? acc.statement?.cutoffDay ?? null : null,
        due_day: acc.type === "credit_card" ? acc.statement?.dueDay ?? null : null,
    };
}

export async function listAccounts() {
    const { data } = await http.get("/yenomplanner/accounts/");
    return (data || []).map(mapAccountFromApi);
}

export async function createAccount(account) {
    const payload = mapAccountToApiPayload(account);
    const { data } = await http.post("/yenomplanner/accounts/", payload);
    return mapAccountFromApi(data);
}

export async function updateAccount(id, patch) {
    const payload = mapAccountToApiPayload(patch);
    const { data } = await http.patch(`/yenomplanner/accounts/${id}/`, payload);
    return mapAccountFromApi(data);
}

export async function deleteAccount(id) {
    await http.delete(`/yenomplanner/accounts/${id}/`);
    return id;
}
