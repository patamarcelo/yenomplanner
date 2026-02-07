import { createSlice } from "@reduxjs/toolkit";
import { mockTransactions } from "../data/mockTransactions";

const initialState = {
  month: "2026-02",     // mantém YYYY-MM como "chave"
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
      // aceita array ou 1 txn
      const payload = action.payload;
      if (Array.isArray(payload)) state.txns = [...payload, ...state.txns];
      else state.txns = [payload, ...state.txns];
    },
    setTransactions(state, action) {
      state.txns = action.payload || [];
    },
  },
});

export const { setMonth, addTransactions, setTransactions } = financeSlice.actions;
export default financeSlice.reducer;
