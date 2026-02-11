// src/store/billsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
    listBills,
    createBill,
    updateBill,
    deleteBill,
    generateBillTransactions,
    payBill,
    reopenBill,
    deleteBillSeries
} from "../api/billsApi";

export const fetchBillsThunk = createAsyncThunk("bills/fetchAll", async (_, { rejectWithValue }) => {
    try {
        return await listBills();
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao carregar despesas" });
    }
});

export const createBillThunk = createAsyncThunk("bills/create", async (payload, { rejectWithValue }) => {
    try {
        return await createBill(payload);
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao criar despesa" });
    }
});

export const updateBillThunk = createAsyncThunk("bills/update", async ({ id, patch }, { rejectWithValue }) => {
    try {
        return await updateBill(id, patch);
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao atualizar despesa" });
    }
});

export const deleteBillThunk = createAsyncThunk("bills/delete", async (id, { rejectWithValue }) => {
    try {
        return await deleteBill(id);
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao excluir despesa" });
    }
});

export const generateBillThunk = createAsyncThunk("bills/generate", async ({ id, body }, { rejectWithValue }) => {
    try {
        return await generateBillTransactions(id, body);
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao gerar lançamentos" });
    }
});

export const payBillThunk = createAsyncThunk("bills/pay", async ({ id, body }, { rejectWithValue }) => {
    try {
        return await payBill(id, body); // { bill, transaction }
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao pagar despesa" });
    }
});

export const reopenBillThunk = createAsyncThunk("bills/reopen", async ({ id }, { rejectWithValue }) => {
    try {
        return await reopenBill(id); // { bill, deleted_transaction_id }
    } catch (e) {
        return rejectWithValue(e?.response?.data || { detail: "Erro ao reabrir despesa" });
    }
});

// billsSlice.js
export const deleteBillSeriesThunk = createAsyncThunk(
    "bills/deleteSeries",
    async ({ installmentGroupId }, { rejectWithValue }) => {
        try {
            return await deleteBillSeries(installmentGroupId);
        } catch (e) {
            return rejectWithValue(e?.response?.data || { detail: "Erro ao excluir série" });
        }
    }
);
const billsSlice = createSlice({
    name: "bills",
    initialState: {
        items: [],
        status: "idle",
        error: "",
        generating: false,
        lastGenerateResult: null,
        paying: false,
        reopening: false,
    },
    reducers: {
        resetBills(state) {
            state.items = [];
            state.status = "idle";
            state.error = "";
            state.generating = false;
            state.lastGenerateResult = null;
            state.paying = false;
            state.reopening = false;
        },
        clearGenerateResult(state) {
            state.lastGenerateResult = null;
        },
        // ✅ (PASSO 3) usado pelo /bootstrap
        setBillsFromBootstrap(state, action) {
            state.items = action.payload || [];
            state.status = "succeeded";
            state.error = "";
        },
    },
    extraReducers: (b) => {
        b.addCase(fetchBillsThunk.pending, (s) => {
            s.status = "loading";
            s.error = "";
        });
        b.addCase(fetchBillsThunk.fulfilled, (s, a) => {
            s.status = "succeeded";
            s.items = a.payload || [];
        });
        b.addCase(fetchBillsThunk.rejected, (s, a) => {
            s.status = "failed";
            s.error = a.payload?.detail || "Erro ao carregar despesas";
        });

        b.addCase(createBillThunk.fulfilled, (s, a) => {
            s.items.unshift(a.payload);
        });
        b.addCase(createBillThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao criar despesa";
        });

        b.addCase(updateBillThunk.fulfilled, (s, a) => {
            const updated = a.payload;
            const idx = s.items.findIndex((x) => x.id === updated.id);
            if (idx >= 0) s.items[idx] = updated;
        });
        b.addCase(updateBillThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao atualizar despesa";
        });

        b.addCase(deleteBillThunk.fulfilled, (s, a) => {
            const id = a.payload;
            s.items = s.items.filter((x) => x.id !== id);
        });
        b.addCase(deleteBillThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao excluir despesa";
        });

        b.addCase(generateBillThunk.pending, (s) => {
            s.generating = true;
            s.error = "";
            s.lastGenerateResult = null;
        });
        b.addCase(generateBillThunk.fulfilled, (s, a) => {
            s.generating = false;
            s.lastGenerateResult = a.payload || null;
        });
        b.addCase(generateBillThunk.rejected, (s, a) => {
            s.generating = false;
            s.error = a.payload?.detail || "Erro ao gerar lançamentos";
        });

        // ✅ pagar
        b.addCase(payBillThunk.pending, (s) => {
            s.paying = true;
            s.error = "";
        });
        b.addCase(payBillThunk.fulfilled, (s, a) => {
            s.paying = false;
            const updatedBill = a.payload?.bill;
            if (!updatedBill?.id) return;
            const idx = s.items.findIndex((x) => x.id === updatedBill.id);
            if (idx >= 0) s.items[idx] = updatedBill;
        });
        b.addCase(payBillThunk.rejected, (s, a) => {
            s.paying = false;
            s.error = a.payload?.detail || "Erro ao pagar despesa";
        });

        // ✅ reabrir
        b.addCase(reopenBillThunk.pending, (s) => {
            s.reopening = true;
            s.error = "";
        });
        b.addCase(reopenBillThunk.fulfilled, (s, a) => {
            s.reopening = false;
            const updatedBill = a.payload?.bill;
            if (!updatedBill?.id) return;
            const idx = s.items.findIndex((x) => x.id === updatedBill.id);
            if (idx >= 0) s.items[idx] = updatedBill;
        });
        b.addCase(reopenBillThunk.rejected, (s, a) => {
            s.reopening = false;
            s.error = a.payload?.detail || "Erro ao reabrir despesa";
        });
        b.addCase(deleteBillSeriesThunk.fulfilled, (s, a) => {
            const gid = a.payload;
            s.items = (s.items || []).filter((x) => x.installmentGroupId !== gid);
        });

        b.addCase(deleteBillSeriesThunk.rejected, (s, a) => {
            s.error = a.payload?.detail || "Erro ao excluir série";
        });
    },
});

export const { resetBills, clearGenerateResult, setBillsFromBootstrap } = billsSlice.actions;

export const selectBills = (s) => s.bills.items || [];
export const selectBillsStatus = (s) => s.bills.status;
export const selectBillsError = (s) => s.bills.error;
export const selectBillsGenerating = (s) => s.bills.generating;
export const selectBillsLastGenerateResult = (s) => s.bills.lastGenerateResult;
export const selectBillsPaying = (s) => s.bills.paying;
export const selectBillsReopening = (s) => s.bills.reopening;

export default billsSlice.reducer;