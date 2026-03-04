// src/store/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { signup, login, fetchMe, requestPasswordReset } from "../api/authApi";

const TOKEN_KEY = "authToken";

export const signupThunk = createAsyncThunk("auth/signup", async (payload) => {
  const data = await signup(payload);
  if (data?.token) localStorage.setItem(TOKEN_KEY, data.token);
  return data;
});

export const loginThunk = createAsyncThunk("auth/login", async (payload) => {
  const data = await login(payload);
  if (data?.token) localStorage.setItem(TOKEN_KEY, data.token);
  return data;
});

/**
 * ✅ Evita "Sessão expirada" depois do logout:
 * - Se não tem token, não chama /me e não marca erro.
 * - Só retorna "Sessão expirada" quando realmente havia token e a chamada falhou.
 */
export const meThunk = createAsyncThunk(
  "auth/me",
  async (_, { getState, rejectWithValue }) => {
    const state = getState();
    const token = state?.user?.token || localStorage.getItem(TOKEN_KEY) || "";

    // ✅ sem token = usuário deslogado → não é sessão expirada
    if (!token) return rejectWithValue(null);

    try {
      const data = await fetchMe();
      return data;
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      return rejectWithValue("Sessão expirada");
    }
  }
);

/**
 * ✅ Reset de senha (request)
 * Backend: POST /auth/password/reset/
 * (resposta deve ser genérica, 200, mesmo se e-mail não existir)
 */
export const requestPasswordResetThunk = createAsyncThunk(
  "auth/requestPasswordReset",
  async ({ email }, { rejectWithValue }) => {
    const e = String(email || "").trim().toLowerCase();
    if (!e || !e.includes("@")) return rejectWithValue("Informe um e-mail válido.");

    try {
      const data = await requestPasswordReset({ email: e });
      return data;
    } catch (err) {
      return rejectWithValue("Não foi possível enviar o link. Tente novamente.");
    }
  }
);

const initialState = {
  user: null,
  token: localStorage.getItem(TOKEN_KEY) || "",
  status: "idle",
  error: "",

  resetStatus: "idle",
  resetError: "",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = "";
      state.status = "idle";
      state.error = ""; // ✅ evita aparecer "Sessão expirada" no login após sair

      state.resetStatus = "idle";
      state.resetError = "";

      localStorage.removeItem(TOKEN_KEY);
    },

    clearAuthError(state) {
      state.error = "";
    },

    clearResetState(state) {
      state.resetStatus = "idle";
      state.resetError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      // -------------------------
      // signup
      // -------------------------
      .addCase(signupThunk.pending, (s) => {
        s.status = "loading";
        s.error = "";
      })
      .addCase(signupThunk.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.user = a.payload;
        s.token = a.payload?.token || s.token;
        s.error = "";
      })
      .addCase(signupThunk.rejected, (s) => {
        s.status = "idle";
        s.error = "Não foi possível criar a conta.";
      })

      // -------------------------
      // login
      // -------------------------
      .addCase(loginThunk.pending, (s) => {
        s.status = "loading";
        s.error = "";
      })
      .addCase(loginThunk.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.token = a.payload?.token || "";
        s.error = "";
      })
      .addCase(loginThunk.rejected, (s) => {
        s.status = "idle";
        s.error = "Não foi possível entrar.";
      })

      // -------------------------
      // me
      // -------------------------
      .addCase(meThunk.fulfilled, (s, a) => {
        s.user = a.payload;
        s.error = "";
      })
      .addCase(meThunk.rejected, (s, a) => {
        // ✅ payload null => sem token/logout/rota pública → não mostrar erro
        if (a.payload == null) {
          s.user = null;
          s.token = "";
          s.status = "idle";
          return;
        }

        s.user = null;
        s.token = "";
        s.status = "idle";
        s.error = a.payload || "Sessão expirada";
      })

      // -------------------------
      // password reset (request)
      // -------------------------
      .addCase(requestPasswordResetThunk.pending, (s) => {
        s.resetStatus = "loading";
        s.resetError = "";
      })
      .addCase(requestPasswordResetThunk.fulfilled, (s) => {
        s.resetStatus = "succeeded";
        s.resetError = "";
      })
      .addCase(requestPasswordResetThunk.rejected, (s, a) => {
        s.resetStatus = "idle";
        s.resetError = a.payload || "Não foi possível enviar o link.";
      });
  },
});

export const { logout, clearAuthError, clearResetState } = authSlice.actions;
export default authSlice.reducer;

export const selectAuthUser = (s) => s.user.user;
export const selectAuthToken = (s) => s.user.token;
export const selectAuthStatus = (s) => s.user.status;
export const selectAuthError = (s) => s.user.error;

export const selectResetStatus = (s) => s.user.resetStatus;
export const selectResetError = (s) => s.user.resetError;

export const selectIsAuthed = (s) => !!(s.user.token || localStorage.getItem(TOKEN_KEY));