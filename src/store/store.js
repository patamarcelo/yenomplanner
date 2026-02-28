// src/store/store.js
import { configureStore } from "@reduxjs/toolkit";
import { combineReducers } from "redux";

import financeReducer from "./financeSlice.js";
import accountsReducer from "./accountsSlice.js";
import uiReducer from "./uiSlice.js";
import authReducer from "./authSlice.js";
import transactionsReducer from "./transactionsSlice.js";
import billsReducer from "./billsSlice.js";
import categoriesReducer from "./categoriesSlice.js";
import invoiceReducer from "./invoicesSlice.js";
import bootstrapReducer from "./bootstrapSlice.js";

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
// 2) rootReducer com reset global
// ============================
function rootReducer(state, action) {
  if (action.type === "app/reset") {
    state = undefined; // volta todos slices para initialState
  }
  return appReducer(state, action);
}

// ============================
// 3) store (SEM persist)
// ============================
export const store = configureStore({
  reducer: rootReducer,
  devTools: process.env.NODE_ENV !== "production",
});

export default store;