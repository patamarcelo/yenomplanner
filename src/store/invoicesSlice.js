// src/store/invoicesSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { listInvoices, closeInvoice, payInvoice, previewCloseInvoice, reopenInvoice } from "../api/invoicesApi";

export const fetchInvoicesThunk = createAsyncThunk("invoices/fetchAll", async (_, { rejectWithValue }) => {
    try {
        return await listInvoices();
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao listar faturas" });
    }
});

export const closeInvoiceThunk = createAsyncThunk("invoices/close", async (payload, { rejectWithValue }) => {
    try {
        return await closeInvoice(payload);
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao fechar fatura" });
    }
});

export const payInvoiceThunk = createAsyncThunk("invoices/pay", async ({ id, payload }, { rejectWithValue }) => {
    try {
        return await payInvoice(id, payload);
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao pagar fatura" });
    }
});

export const previewCloseInvoiceThunk = createAsyncThunk(
    "invoices/previewClose",
    async (payload, { rejectWithValue }) => {
        try {
            return await previewCloseInvoice(payload);
        } catch (e) {
            return rejectWithValue(e?.response?.data || { detail: "Erro no preview" });
        }
    }
);

export const reopenInvoiceThunk = createAsyncThunk(
    "invoices/reopen",
    async (id, { rejectWithValue }) => {
        try {
            return await reopenInvoice(id);
        } catch (e) {
            return rejectWithValue(e?.response?.data || { detail: "Erro ao reabrir fatura" });
        }
    }
);

const invoicesSlice = createSlice({
    name: "invoices",
    initialState: {
        items: [],
        status: "idle",
        error: "",

        // ✅ PREVIEW STATE
        preview: null,              // resposta do backend do preview_close
        previewStatus: "idle",       // idle | loading | succeeded | failed
        previewError: "",
    },
    reducers: {
        setInvoicesFromBootstrap(state, action) {
            state.items = action.payload || [];
            state.status = "succeeded";
            state.error = "";
        },
        resetInvoices(state) {
            state.items = [];
            state.status = "idle";
            state.error = "";

            state.preview = null;
            state.previewStatus = "idle";
            state.previewError = "";
        },

        // opcional: limpar preview quando fechar modal
        clearInvoicePreview(state) {
            state.preview = null;
            state.previewStatus = "idle";
            state.previewError = "";
        },
    },
    extraReducers: (b) => {
        const upsert = (s, inv) => {
            const idx = s.items.findIndex((x) => x.id === inv.id);
            if (idx >= 0) s.items[idx] = inv;
            else s.items.unshift(inv);
        };

        b.addCase(fetchInvoicesThunk.pending, (s) => {
            s.status = "loading";
            s.error = "";
        });
        b.addCase(fetchInvoicesThunk.fulfilled, (s, a) => {
            s.status = "succeeded";
            s.items = a.payload || [];
        });
        b.addCase(fetchInvoicesThunk.rejected, (s, a) => {
            s.status = "failed";
            s.error = a.payload?.detail || a.error?.message || "Erro";
        });

        b.addCase(closeInvoiceThunk.fulfilled, (s, a) => upsert(s, a.payload));
        b.addCase(closeInvoiceThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao fechar";
        });

        b.addCase(payInvoiceThunk.fulfilled, (s, a) => upsert(s, a.payload));
        b.addCase(payInvoiceThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao pagar";
        });

        b.addCase(reopenInvoiceThunk.fulfilled, (s, a) => upsert(s, a.payload));
        b.addCase(reopenInvoiceThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao reabrir";
        });

        // ✅ PREVIEW reducers
        b.addCase(previewCloseInvoiceThunk.pending, (s) => {
            s.previewStatus = "loading";
            s.previewError = "";
            s.preview = null;
        });
        b.addCase(previewCloseInvoiceThunk.fulfilled, (s, a) => {
            s.previewStatus = "succeeded";
            s.preview = a.payload || null;
        });
        b.addCase(previewCloseInvoiceThunk.rejected, (s, a) => {
            s.previewStatus = "failed";
            s.previewError = a.payload?.detail || "Erro no preview";
            s.preview = null;
        });
    },
});

export const { setInvoicesFromBootstrap, resetInvoices, clearInvoicePreview } = invoicesSlice.actions;
export default invoicesSlice.reducer;

export const selectInvoices = (s) => s.invoices?.items || [];
export const selectInvoicesStatus = (s) => s.invoices?.status || "idle";
export const selectInvoicesError = (s) => s.invoices?.error || "";

// ✅ selectors preview
export const selectInvoicePreview = (s) => s.invoices?.preview || null;
export const selectInvoicePreviewStatus = (s) => s.invoices?.previewStatus || "idle";
export const selectInvoicePreviewError = (s) => s.invoices?.previewError || "";
