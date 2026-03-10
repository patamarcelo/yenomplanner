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

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function onlyDigits(v) {
    return String(v || "").replace(/\D/g, "");
}

// API -> Front shape
export function mapAccountFromApi(a) {
    return {
        id: a.id,
        externalId: a.external_id,
        type: a.type,
        name: a.name,
        color: a.color,
        active: !!a.active,

        openingBalance: centsToMoney(a.opening_balance_cents) || 0,
        limit: centsToMoney(a.limit_cents),

        // novos campos calculados no backend
        limitCents: a.limit_cents ?? 0,
        usedLimitCents: a.used_limit_cents ?? 0,
        availableLimitCents: a.available_limit_cents ?? 0,
        openTxNotInvoicedCents: a.open_tx_not_invoiced_cents ?? 0,
        closedInvoicesCents: a.closed_invoices_cents ?? 0,

        // opcionais em unidade monetária, caso queira usar em algum lugar
        usedLimit: centsToMoney(a.used_limit_cents) || 0,
        availableLimit: centsToMoney(a.available_limit_cents) || 0,
        openTxNotInvoiced: centsToMoney(a.open_tx_not_invoiced_cents) || 0,
        closedInvoices: centsToMoney(a.closed_invoices_cents) || 0,

        statement:
            a.type === "credit_card"
                ? {
                    cutoffDay: a.cutoff_day ?? null,
                    dueDay: a.due_day ?? null,
                }
                : null,

        bankDetails:
            a.type === "checking"
                ? {
                    bankCode: a.bank_code || "",
                    bankName: a.bank_name || "",
                    branch: a.branch || "",
                    accountNumber: a.account_number || "",
                    accountDigit: a.account_digit || "",
                    accountKind: a.account_kind || "checking",
                    holderName: a.holder_name || "",
                    documentType: a.document_type || "cpf",
                    documentNumber: a.document_number || "",
                    pixKeyType: a.pix_key_type || "",
                    pixKey: a.pix_key || "",
                }
                : null,

        shareText: a.share_text || "",
    };
}

// Front -> API payload (full create/update)
export function mapAccountToApiPayload(acc) {
    const type = acc.type || "checking";
    const bank = acc.bankDetails || {};
    const statement = acc.statement || {};

    return {
        external_id: acc.externalId || acc.external_id || acc.id || "",
        type,
        name: acc.name || "",
        color: acc.color || "rgba(0,0,0,0.08)",
        active: acc.active ?? true,
        opening_balance_cents: moneyToCents(acc.openingBalance ?? 0) ?? 0,

        limit_cents: type === "credit_card" ? moneyToCents(acc.limit ?? 0) : null,
        cutoff_day: type === "credit_card" ? statement.cutoffDay ?? null : null,
        due_day: type === "credit_card" ? statement.dueDay ?? null : null,

        bank_code: type === "checking" ? onlyDigits(bank.bankCode).slice(0, 10) : "",
        bank_name: type === "checking" ? String(bank.bankName || "").trim() : "",
        branch: type === "checking" ? onlyDigits(bank.branch).slice(0, 20) : "",
        account_number: type === "checking" ? onlyDigits(bank.accountNumber).slice(0, 30) : "",
        account_digit: type === "checking" ? onlyDigits(bank.accountDigit).slice(0, 10) : "",
        account_kind: type === "checking" ? bank.accountKind || "checking" : "",
        holder_name: type === "checking" ? String(bank.holderName || "").trim() : "",
        document_type: type === "checking" ? bank.documentType || "cpf" : "",
        document_number: type === "checking" ? onlyDigits(bank.documentNumber).slice(0, 30) : "",
        pix_key_type: type === "checking" ? bank.pixKeyType || "" : "",
        pix_key: type === "checking" ? String(bank.pixKey || "").trim() : "",
    };
}

// PATCH parcial de verdade
export function mapAccountPatchToApiPayload(patch) {
    const payload = {};

    if (hasOwn(patch, "externalId") || hasOwn(patch, "external_id")) {
        payload.external_id = patch.externalId || patch.external_id || "";
    }

    if (hasOwn(patch, "type")) payload.type = patch.type || "checking";
    if (hasOwn(patch, "name")) payload.name = patch.name || "";
    if (hasOwn(patch, "color")) payload.color = patch.color || "rgba(0,0,0,0.08)";
    if (hasOwn(patch, "active")) payload.active = !!patch.active;
    if (hasOwn(patch, "openingBalance")) {
        payload.opening_balance_cents = moneyToCents(patch.openingBalance ?? 0) ?? 0;
    }
    if (hasOwn(patch, "limit")) {
        payload.limit_cents = moneyToCents(patch.limit ?? 0);
    }
    if (hasOwn(patch, "statement")) {
        payload.cutoff_day = patch.statement?.cutoffDay ?? null;
        payload.due_day = patch.statement?.dueDay ?? null;
    }

    if (hasOwn(patch, "bankDetails")) {
        const bank = patch.bankDetails || {};
        if (hasOwn(bank, "bankCode")) payload.bank_code = onlyDigits(bank.bankCode).slice(0, 10);
        if (hasOwn(bank, "bankName")) payload.bank_name = String(bank.bankName || "").trim();
        if (hasOwn(bank, "branch")) payload.branch = onlyDigits(bank.branch).slice(0, 20);
        if (hasOwn(bank, "accountNumber")) payload.account_number = onlyDigits(bank.accountNumber).slice(0, 30);
        if (hasOwn(bank, "accountDigit")) payload.account_digit = onlyDigits(bank.accountDigit).slice(0, 10);
        if (hasOwn(bank, "accountKind")) payload.account_kind = bank.accountKind || "";
        if (hasOwn(bank, "holderName")) payload.holder_name = String(bank.holderName || "").trim();
        if (hasOwn(bank, "documentType")) payload.document_type = bank.documentType || "";
        if (hasOwn(bank, "documentNumber")) payload.document_number = onlyDigits(bank.documentNumber).slice(0, 30);
        if (hasOwn(bank, "pixKeyType")) payload.pix_key_type = bank.pixKeyType || "";
        if (hasOwn(bank, "pixKey")) payload.pix_key = String(bank.pixKey || "").trim();
    }

    return payload;
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
    const payload = mapAccountPatchToApiPayload(patch);
    const { data } = await http.patch(`/yenomplanner/accounts/${id}/`, payload);
    return mapAccountFromApi(data);
}

export async function deleteAccount(id) {
    await http.delete(`/yenomplanner/accounts/${id}/`);
    return id;
}