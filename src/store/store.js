import { configureStore } from "@reduxjs/toolkit";
import financeReducer from "./financeSlice.js";
import { loadState, saveState } from "./storage.js";
import accountsReducer from './accountsSlice.js'
import uiReducer from './uiSlice.js'
import authReducer from './authSlice.js'
import transactionsReducer from './transactionsSlice.js'

const preloadedState = loadState();

export const store = configureStore({
  reducer: {
    finance: financeReducer,
    accounts: accountsReducer,
    ui: uiReducer,
    user: authReducer,
    transactions: transactionsReducer
  },
  preloadedState, // <-- traz do localStorage se existir
});

// persist simples (state inteiro)
store.subscribe(() => {
  saveState(store.getState());
});
