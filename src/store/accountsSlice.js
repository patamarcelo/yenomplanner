// src/store/accountsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { listAccounts, createAccount, updateAccount, deleteAccount } from "../api/accountsApi";

export const fetchAccountsThunk = createAsyncThunk("accounts/fetchAll", async () => {
  return await listAccounts();
});

export const createAccountThunk = createAsyncThunk("accounts/create", async (payload) => {
  return await createAccount(payload);
});

export const updateAccountThunk = createAsyncThunk("accounts/update", async ({ id, patch }) => {
  return await updateAccount(id, patch);
});

export const deleteAccountThunk = createAsyncThunk("accounts/delete", async (id) => {
  return await deleteAccount(id);
});

const initialState = {
  accounts: [],
  status: "idle",
  error: "",
};

const accountsSlice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    // opcional: limpar no logout
    resetAccounts(state) {
      state.accounts = [];
      state.status = "idle";
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccountsThunk.pending, (s) => {
        s.status = "loading";
        s.error = "";
      })
      .addCase(fetchAccountsThunk.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.accounts = a.payload || [];
      })
      .addCase(fetchAccountsThunk.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error.message || "Erro ao carregar contas";
      })

      .addCase(createAccountThunk.fulfilled, (s, a) => {
        s.accounts.unshift(a.payload);
      })
      .addCase(updateAccountThunk.fulfilled, (s, a) => {
        const idx = s.accounts.findIndex((x) => x.id === a.payload.id);
        if (idx >= 0) s.accounts[idx] = a.payload;
      })
      .addCase(deleteAccountThunk.fulfilled, (s, a) => {
        s.accounts = s.accounts.filter((x) => x.id !== a.payload);
      });
  },
});

export const { resetAccounts } = accountsSlice.actions;
export default accountsSlice.reducer;

export const selectAccounts = (s) => s.accounts.accounts;
export const selectActiveAccounts = (s) => s.accounts.accounts.filter((a) => a.active);
export const selectAccountById = (id) => (s) => s.accounts.accounts.find((a) => a.id === id) || null;
