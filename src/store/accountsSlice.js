// src/store/accountsSlice.js
import { createSlice, nanoid } from "@reduxjs/toolkit";

const seedAccounts = [
  {
    id: "acc_checking_main",
    type: "checking",
    name: "Conta Corrente",
    color: "rgba(0,0,0,0.08)",
    active: true,
    openingBalance: 0
  },
  {
    id: "acc_cc_nubank",
    type: "credit_card",
    name: "Nubank",
    color: "rgba(126, 33, 214, 0.18)",
    active: true,
    limit: 8000,
    statement: { cutoffDay: 1, dueDay: 10 },
  },
  {
    id: "acc_cc_xp",
    type: "credit_card",
    name: "XP",
    color: "rgba(120,120,120,0.18)",
    active: true,
    limit: 12000,
    statement: { cutoffDay: 5, dueDay: 15 },
  },
  {
    id: "acc_cc_porto",
    type: "credit_card",
    name: "Porto",
    color: "rgba(40, 95, 255, 0.16)",
    active: true,
    limit: 9000,
    statement: { cutoffDay: 4, dueDay: 11 },
  },
];

const initialState = {
  accounts: seedAccounts,
};

const accountsSlice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    addAccount: {
      reducer(state, action) {
        state.accounts.unshift(action.payload);
      },
      prepare(payload) {
        return {
          payload: {
            id: payload?.id || nanoid(),
            type: payload?.type || "checking",
            name: payload?.name || "Nova conta",
            color: payload?.color || "rgba(0,0,0,0.08)",
            active: payload?.active ?? true,
            openingBalance: Number(payload?.openingBalance ?? 0),
            limit: payload?.limit ?? null,
            statement: payload?.statement ?? null,
          },
        };
      },
    },
    updateAccount(state, action) {
      const { id, patch } = action.payload || {};
      const idx = state.accounts.findIndex((a) => a.id === id);
      if (idx >= 0) state.accounts[idx] = { ...state.accounts[idx], ...(patch || {}) };
    },
    removeAccount(state, action) {
      const id = action.payload;
      state.accounts = state.accounts.filter((a) => a.id !== id);
    },
    setAccountActive(state, action) {
      const { id, active } = action.payload || {};
      const acc = state.accounts.find((a) => a.id === id);
      if (acc) acc.active = !!active;
    },
  },
});

export const { addAccount, updateAccount, removeAccount, setAccountActive } = accountsSlice.actions;
export default accountsSlice.reducer;

// selectors simples
export const selectAccounts = (s) => s.accounts.accounts;
export const selectActiveAccounts = (s) => s.accounts.accounts.filter((a) => a.active);
export const selectAccountById = (id) => (s) => s.accounts.accounts.find((a) => a.id === id) || null;
