// src/store/financeSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { mockTransactions } from "../data/mockTransactions";


function currentYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
const initialState = {
  month: currentYM(),
  txns: mockTransactions,
};

const financeSlice = createSlice({
  name: "finance",
  initialState,
  reducers: {
    setMonth(state, action) {
      state.month = action.payload;
    },

    addTransactions(state, action) {
      const payload = action.payload;
      if (Array.isArray(payload)) {
        state.txns = [...payload, ...state.txns];
      } else {
        state.txns = [payload, ...state.txns];
      }
    },

    setTransactions(state, action) {
      state.txns = action.payload || [];
    },

    /** ✅ EDITAR lançamento */
    // financeSlice.js
    updateTransaction(state, action) {
      const { id, patch } = action.payload || {};
      const idx = state.txns.findIndex((t) => t.id === id);
      if (idx >= 0) state.txns[idx] = { ...state.txns[idx], ...patch };
    },


    /** ✅ EXCLUIR lançamento */
    removeTransaction(state, action) {
      const id = action.payload;
      state.txns = state.txns.filter((t) => t.id !== id);
    },
  },
});

export const {
  setMonth,
  addTransactions,
  setTransactions,
  updateTransaction,
  removeTransaction,
} = financeSlice.actions;

export default financeSlice.reducer;
