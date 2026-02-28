// src/store/store.js
import { configureStore } from "@reduxjs/toolkit";

import financeReducer from "./financeSlice.js";
import accountsReducer from "./accountsSlice.js";
import uiReducer from "./uiSlice.js";
import authReducer from "./authSlice.js";
import transactionsReducer from "./transactionsSlice.js";
import billsReducer from "./billsSlice.js";
import categoriesReducer from "./categoriesSlice.js";
import invoiceReducer from "./invoicesSlice.js";
import bootstrapReducer from "./bootstrapSlice.js";

import { loadState, saveState, clearState } from "./storage.js";

import { combineReducers } from "redux";
import { resetApp } from "./appActions.js";

// ============================
// 1) reducers combinados
// ============================
const appReducer = combineReducers({
  finance: financeReducer,
  accounts: accountsReducer,
  ui: uiReducer,
  user: authReducer,
  transactions: transactionsReducer,
  bills: billsReducer,
  categories: categoriesReducer,
  invoices: invoiceReducer,
  bootstrap: bootstrapReducer,
});


// ============================
// 3) rootReducer com reset
// ============================
function rootReducer(state, action) {
  if (action.type === "app/reset") {
    state = undefined; // volta pro initialState de cada slice
  }
  return appReducer(state, action);
}

// ============================
// 4) preloadedState (persist)
// ============================
const preloadedState = loadState();

// ============================
// 5) store
// ============================
export const store = configureStore({
  reducer: rootReducer,
  preloadedState,
});

// ============================
// 6) persist simples (state inteiro)
// ============================
store.subscribe(() => {
  saveState(store.getState());
});

// ============================
// 7) helper de logout (limpa tudo)
// ============================
export function hardLogout(dispatch) {
  // limpa storages do browser
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch { }

  // se você prefere limpar só o que é do app:
  // clearState();

  // reseta redux
  dispatch(resetApp());
}