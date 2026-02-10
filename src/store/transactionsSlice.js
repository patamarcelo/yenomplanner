// src/store/transactionsSlice.js
import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import { listTransactions, patchTransaction, deleteTransactionApi, createTransactionApi } from "../api/transactionsApi";
import { txnApiToUi, uiStatusToApi } from "./transactionsAdapter";

function ensureClientId(v) {
    const s = String(v || "").trim();
    if (s) return s;
    // crypto.randomUUID() é ótimo, mas nem sempre disponível em todos ambientes
    const rand = Math.random().toString(16).slice(2);
    return `manual:${Date.now()}:${rand}`;
}

function ymToInvoiceMonthDate(ym) {
    const s = String(ym || "").trim();
    if (!s) return null;
    // se já veio YYYY-MM-DD, mantém
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // se veio YYYY-MM, vira YYYY-MM-01
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
    return s; // fallback
}

function toAmountString(amount) {
    if (amount === null || amount === undefined) return "";
    if (typeof amount === "number" && Number.isFinite(amount)) {
        // serializer aceita "1234,56" ou "1234.56"
        return amount.toFixed(2).replace(".", ",");
    }
    // se vier string, normaliza espaços
    return String(amount).trim();
}

function mapUiToApiPayload(payload) {
    const p = payload || {};

    const apiPayload = {
        client_id: ensureClientId(p.client_id || p.clientId),
        purchase_date: p.purchase_date || p.purchaseDate || null,
        charge_date: p.charge_date || p.chargeDate || null,
        invoice_month: ymToInvoiceMonthDate(p.invoice_month || p.invoiceMonth),

        account_id: p.account_id ?? p.accountId ?? null,
        bill_id: p.bill_id ?? p.billId ?? null,

        merchant: (p.merchant || "").trim(),
        description: (p.description || "").trim(),
        category_id: p.category_id || p.categoryId || "outros",

        amount: toAmountString(p.amount), // ✅ isso vira amount_cents no serializer
        currency: p.currency || "BRL",

        status: p.status ? uiStatusToApi(p.status) : "planned",
        direction: p.direction || "expense",
        kind: p.kind || "one_off",

        // parcelas / recorrência (opcional)
        installment_group_id: p.installment_group_id || p.installmentGroupId || null,
        installment_current: p.installment_current ?? p.installmentCurrent ?? null,
        installment_total: p.installment_total ?? p.installmentTotal ?? null,
        recurring_rule: p.recurring_rule || p.recurringRule || null,

        notes: p.notes || "",
    };

    // limpa vazios que podem irritar validação
    if (!apiPayload.invoice_month) delete apiPayload.invoice_month;

    return apiPayload;
}

export const createTransactionThunk = createAsyncThunk(
    "transactions/create",
    async (payload, { rejectWithValue }) => {
        try {
            const out = mapUiToApiPayload(payload);

            // validações mínimas antes do POST
            if (!out.client_id) throw { response: { data: { detail: "client_id ausente" } } };
            if (!out.amount) throw { response: { data: { detail: "amount ausente" } } };

            const created = await createTransactionApi(out);
            return created;
        } catch (e) {
            return rejectWithValue(e?.response?.data || { detail: "Erro ao criar transação" });
        }
    }
);

export const fetchAllTransactionsThunk = createAsyncThunk("transactions/fetchAll", async () => {
    const data = await listTransactions();
    return Array.isArray(data) ? data : [];
});

export const patchTransactionThunk = createAsyncThunk(
    "transactions/patch",
    async ({ id, patch }, { rejectWithValue }) => {
        try {
            const out = mapUiToApiPayload(patch);
            // PATCH parcial: não precisa de tudo
            // mas não queremos sobrescrever client_id com vazio
            if (patch?.client_id == null && patch?.clientId == null) delete out.client_id;
            const data = await patchTransaction(id, out);
            return data;
        } catch (e) {
            return rejectWithValue(e?.response?.data || { detail: "Erro ao atualizar" });
        }
    }
);

export const deleteTransactionThunk = createAsyncThunk(
    "transactions/delete",
    async (id, { rejectWithValue }) => {
        try {
            return await deleteTransactionApi(id);
        } catch (e) {
            return rejectWithValue(e?.response?.data || { detail: "Erro ao excluir" });
        }
    }
);

const transactionsSlice = createSlice({
    name: "transactions",
    initialState: {
        items: [],
        status: "idle",
        error: "",
    },
    reducers: {
        resetTransactions(state) {
            state.items = [];
            state.status = "idle";
            state.error = "";
        },
    },
    extraReducers: (b) => {
        b.addCase(fetchAllTransactionsThunk.pending, (s) => {
            s.status = "loading";
            s.error = "";
        });
        b.addCase(fetchAllTransactionsThunk.fulfilled, (s, a) => {
            s.status = "succeeded";
            s.items = a.payload || [];
        });
        b.addCase(fetchAllTransactionsThunk.rejected, (s, a) => {
            s.status = "failed";
            s.error = a.error?.message || "Erro ao carregar transações";
        });

        b.addCase(createTransactionThunk.pending, (s) => {
            s.error = "";
        });
        b.addCase(createTransactionThunk.fulfilled, (s, a) => {
            s.items.unshift(a.payload);
        });
        b.addCase(createTransactionThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao criar transação";
        });

        b.addCase(patchTransactionThunk.fulfilled, (s, a) => {
            const updated = a.payload;
            const idx = s.items.findIndex((t) => t.id === updated.id);
            if (idx >= 0) s.items[idx] = updated;
        });
        b.addCase(patchTransactionThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao atualizar transação";
        });

        b.addCase(deleteTransactionThunk.fulfilled, (s, a) => {
            const id = a.payload;
            s.items = s.items.filter((t) => t.id !== id);
        });
        b.addCase(deleteTransactionThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao excluir transação";
        });
    },
});

export const { resetTransactions } = transactionsSlice.actions;
export default transactionsSlice.reducer;

export const selectTransactionsStatus = (s) => s.transactions.status;
export const selectTransactionsError = (s) => s.transactions.error;

export const selectTransactionsApi = (s) => s.transactions.items || [];

export const selectTransactionsUi = createSelector(
    [selectTransactionsApi],
    (items) => (items || []).map(txnApiToUi)
);

export const selectTransactionsFiltered = createSelector(
    [(s) => s.finance?.month || "", selectTransactionsUi],
    (month, items) => {
        if (!month || month === "__ALL__") return items;
        return items.filter((t) => String(t?.invoiceMonth || "") === String(month));
    }
);

