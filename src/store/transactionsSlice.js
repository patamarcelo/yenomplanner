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
    const inst = p.installment || {};

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

        amount: toAmountString(p.amount), // ✅ vira amount_cents no serializer
        currency: p.currency || "BRL",

        status: p.status ? uiStatusToApi(p.status) : "planned",
        direction: p.direction || "expense",
        kind: p.kind || "one_off",

        // ✅ parcelas (suporta tanto fields flat quanto objeto aninhado)
        installment_group_id:
            p.installment_group_id ||
            p.installmentGroupId ||
            inst.groupId ||
            inst.group_id ||
            null,

        installment_current:
            (p.installment_current ??
                p.installmentCurrent ??
                inst.current ??
                inst.installment_current ??
                null),

        installment_total:
            (p.installment_total ??
                p.installmentTotal ??
                inst.total ??
                inst.installment_total ??
                null),

        // recorrência (opcional)
        recurring_rule: p.recurring_rule || p.recurringRule || null,

        notes: p.notes || "",
    };

    // limpa vazios que podem irritar validação
    if (!apiPayload.invoice_month) delete apiPayload.invoice_month;

    return apiPayload;
}

function mapUiPatchToApiPayload(patch) {
    const p = patch || {};
    const out = {};

    // só manda o que realmente veio no patch
    if ("client_id" in p || "clientId" in p) {
        const v = p.client_id ?? p.clientId;
        if (v !== undefined) out.client_id = v;
    }

    if ("purchase_date" in p || "purchaseDate" in p) {
        out.purchase_date = p.purchase_date ?? p.purchaseDate ?? null;
    }

    if ("charge_date" in p || "chargeDate" in p) {
        out.charge_date = p.charge_date ?? p.chargeDate ?? null;
    }

    if ("invoice_month" in p || "invoiceMonth" in p) {
        const raw = p.invoice_month ?? p.invoiceMonth;
        out.invoice_month = ymToInvoiceMonthDate(raw);
    }

    if ("account_id" in p || "accountId" in p) {
        out.account_id = p.account_id ?? p.accountId ?? null;
    }

    if ("bill_id" in p || "billId" in p) {
        out.bill_id = p.bill_id ?? p.billId ?? null;
    }

    if ("invoice_id" in p || "invoiceId" in p) {
        out.invoice_id = p.invoice_id ?? p.invoiceId ?? null;
    }

    if ("merchant" in p) {
        out.merchant = String(p.merchant ?? "").trim();
    }

    if ("description" in p) {
        out.description = String(p.description ?? "").trim();
    }

    if ("category_id" in p || "categoryId" in p) {
        out.category_id = p.category_id ?? p.categoryId ?? null;
    }

    if ("amount" in p) {
        out.amount = toAmountString(p.amount);
    }

    if ("currency" in p) {
        out.currency = p.currency || "BRL";
    }

    if ("status" in p) {
        out.status = uiStatusToApi(p.status);
    }

    if ("direction" in p) {
        out.direction = p.direction;
    }

    if ("kind" in p) {
        out.kind = p.kind;
    }

    if ("installment_group_id" in p || "installmentGroupId" in p) {
        out.installment_group_id = p.installment_group_id ?? p.installmentGroupId ?? null;
    }

    if ("installment_current" in p || "installmentCurrent" in p) {
        out.installment_current = p.installment_current ?? p.installmentCurrent ?? null;
    }

    if ("installment_total" in p || "installmentTotal" in p) {
        out.installment_total = p.installment_total ?? p.installmentTotal ?? null;
    }

    if ("recurring_rule" in p || "recurringRule" in p) {
        out.recurring_rule = p.recurring_rule ?? p.recurringRule ?? null;
    }

    if ("notes" in p) {
        out.notes = p.notes ?? "";
    }

    return out;
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
            const out = mapUiPatchToApiPayload(patch);
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

        // ✅ (PASSO 3) usado pelo /bootstrap
        setTransactionsFromBootstrap(state, action) {
            state.items = action.payload || [];
            state.status = "succeeded";
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

export const { resetTransactions, setTransactionsFromBootstrap } = transactionsSlice.actions;
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

