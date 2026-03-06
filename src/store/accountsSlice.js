import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "../api/accountsApi";

export const fetchAccountsThunk = createAsyncThunk("accounts/fetchAll", async () => {
  return await listAccounts();
});

export const createAccountThunk = createAsyncThunk("accounts/create", async (payload) => {
  return await createAccount(payload);
});

export const updateAccountThunk = createAsyncThunk(
  "accounts/update",
  async ({ id, patch }) => {
    return await updateAccount(id, patch);
  }
);

export const deleteAccountThunk = createAsyncThunk("accounts/delete", async (id) => {
  return await deleteAccount(id);
});

const initialState = {
  accounts: [],
  status: "idle",
  saveStatus: "idle",
  deleteStatus: "idle",
  error: "",
};

const accountsSlice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    resetAccounts(state) {
      state.accounts = [];
      state.status = "idle";
      state.saveStatus = "idle";
      state.deleteStatus = "idle";
      state.error = "";
    },

    setAccountsFromBootstrap(state, action) {
      state.accounts = action.payload || [];
      state.status = "succeeded";
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

      .addCase(createAccountThunk.pending, (s) => {
        s.saveStatus = "loading";
        s.error = "";
      })
      .addCase(createAccountThunk.fulfilled, (s, a) => {
        s.saveStatus = "succeeded";
        s.accounts.unshift(a.payload);
      })
      .addCase(createAccountThunk.rejected, (s, a) => {
        s.saveStatus = "failed";
        s.error = a.error.message || "Erro ao criar conta";
      })

      .addCase(updateAccountThunk.pending, (s) => {
        s.saveStatus = "loading";
        s.error = "";
      })
      .addCase(updateAccountThunk.fulfilled, (s, a) => {
        s.saveStatus = "succeeded";
        const idx = s.accounts.findIndex((x) => x.id === a.payload.id);
        if (idx >= 0) s.accounts[idx] = a.payload;
      })
      .addCase(updateAccountThunk.rejected, (s, a) => {
        s.saveStatus = "failed";
        s.error = a.error.message || "Erro ao atualizar conta";
      })

      .addCase(deleteAccountThunk.pending, (s) => {
        s.deleteStatus = "loading";
        s.error = "";
      })
      .addCase(deleteAccountThunk.fulfilled, (s, a) => {
        s.deleteStatus = "succeeded";
        s.accounts = s.accounts.filter((x) => x.id !== a.payload);
      })
      .addCase(deleteAccountThunk.rejected, (s, a) => {
        s.deleteStatus = "failed";
        s.error = a.error.message || "Erro ao excluir conta";
      });
  },
});

export const { resetAccounts, setAccountsFromBootstrap } = accountsSlice.actions;
export default accountsSlice.reducer;

export const selectAccounts = (s) => s.accounts.accounts;
export const selectAccountsStatus = (s) => s.accounts.status;
export const selectAccountsSaveStatus = (s) => s.accounts.saveStatus;
export const selectAccountsDeleteStatus = (s) => s.accounts.deleteStatus;
export const selectAccountsError = (s) => s.accounts.error;

export const selectActiveAccounts = (s) =>
  s.accounts.accounts.filter((a) => a.active);

export const selectCheckingAccounts = (s) =>
  s.accounts.accounts.filter((a) => a.type === "checking");

export const selectCreditCardAccounts = (s) =>
  s.accounts.accounts.filter((a) => a.type === "credit_card");

export const selectAccountById = (id) => (s) =>
  s.accounts.accounts.find((a) => a.id === id) || null;