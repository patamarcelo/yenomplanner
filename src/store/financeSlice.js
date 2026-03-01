// src/store/financeSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { mockTransactions } from "../data/mockTransactions";

const LS_MONTH_KEY = "yenom.finance.month";

function currentYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isValidYM(v) {
  return /^\d{4}-\d{2}$/.test(String(v || ""));
}

function readMonthLS() {
  try {
    const v = localStorage.getItem(LS_MONTH_KEY);
    // aceita "" (todos) ou YYYY-MM
    if (v === "") return "";
    if (isValidYM(v)) return v;
  } catch (e) {
    // ignore
  }
  return null;
}

function writeMonthLS(v) {
  try {
    // aceita "" (todos) ou YYYY-MM
    if (v === "" || isValidYM(v)) localStorage.setItem(LS_MONTH_KEY, String(v));
  } catch (e) {
    // ignore
  }
}

const initialState = {
  // ✅ hidrata do localStorage; se não tiver, usa mês atual
  month: readMonthLS() ?? currentYM(),
  txns: mockTransactions,
  filters: {
    accountIds: [],
    categoryIds: [],
    kinds: [],
    directions: ["expense"], // dashboard começa focado em despesas
  },
};

const financeSlice = createSlice({
  name: "finance",
  initialState,
  reducers: {
    setMonth(state, action) {
      // aceita "" para representar "Todos" (sem filtro)
      const next = action.payload;

      // ✅ valida (só grava estado se for "" ou YYYY-MM)
      if (next !== "" && !isValidYM(next)) return;

      state.month = next;
      // ✅ persiste
      writeMonthLS(next);
    },

    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },

    resetFilters(state) {
      state.filters = {
        accountIds: [],
        categoryIds: [],
        kinds: [],
        directions: ["expense"],
      };
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
  setFilters,
  resetFilters,
} = financeSlice.actions;

export default financeSlice.reducer;