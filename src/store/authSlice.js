// src/store/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { signup, login, fetchMe } from "../api/authApi";

// ✅ se você tem persist do store inteiro, crie isso no storage.js:
import { clearState } from "./storage"; // <-- vou te mostrar abaixo como fica
import { resetApp } from "./appActions";

export const signupThunk = createAsyncThunk("auth/signup", async (payload) => {
    const data = await signup(payload);
    if (data?.token) localStorage.setItem("authToken", data.token);
    return data;
});

export const loginThunk = createAsyncThunk("auth/login", async (payload) => {
    const data = await login(payload);
    if (data?.token) localStorage.setItem("authToken", data.token);
    return data;
});

export const meThunk = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
    try {
        const data = await fetchMe();
        return data;
    } catch (err) {
        localStorage.removeItem("authToken");
        return rejectWithValue("Sessão expirada");
    }
});

/**
 * ✅ Logout "hard": limpa tudo (persist + redux + token)
 * Use este thunk no Layout / botões de sair.
 */
export const logoutAndResetThunk = createAsyncThunk(
    "auth/logoutAndReset",
    async (_, { dispatch }) => {
        try {
            // limpa token
            localStorage.removeItem("authToken");

            // limpa persist do redux (seu saveState/loadState)
            clearState();

            // se você guarda algo em sessionStorage também:
            // sessionStorage.clear();
        } catch { }

        // limpa slice auth
        dispatch(logout());

        // ✅ reseta TODOS os slices (root reducer precisa tratar app/reset)
        dispatch(resetApp());

        return true;
    }
);

const initialState = {
    user: null,
    token: localStorage.getItem("authToken") || "",
    status: "idle",
    error: "",
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        logout(state) {
            state.user = null;
            state.token = "";
            state.status = "idle";
            state.error = "";
            // (ok manter isso aqui também)
            localStorage.removeItem("authToken");
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(signupThunk.pending, (s) => {
                s.status = "loading";
                s.error = "";
            })
            .addCase(signupThunk.fulfilled, (s, a) => {
                s.status = "succeeded";
                s.user = a.payload; // se seu signup retorna user
                s.token = a.payload?.token || s.token;
            })
            .addCase(signupThunk.rejected, (s, a) => {
                s.status = "failed";
                s.error = a.error.message || "Erro no cadastro";
            })

            .addCase(loginThunk.pending, (s) => {
                s.status = "loading";
                s.error = "";
            })
            .addCase(loginThunk.fulfilled, (s, a) => {
                s.status = "succeeded";
                s.token = a.payload?.token || "";
                // opcional: se login retorna user, set aqui:
                if (a.payload?.user) s.user = a.payload.user;
            })
            .addCase(loginThunk.rejected, (s, a) => {
                s.status = "failed";
                s.error = a.error.message || "Erro no login";
            })

            .addCase(meThunk.fulfilled, (s, a) => {
                s.status = "succeeded";
                s.user = a.payload;
                // normalmente /me NÃO retorna token; mantenha só se existir
                if (a.payload?.token) s.token = a.payload.token;
            })
            .addCase(meThunk.rejected, (s, a) => {
                s.user = null;
                s.token = "";
                s.status = "idle";
                s.error = a.payload || "Sessão expirada";
            })

            // só pra marcar status se quiser (opcional)
            .addCase(logoutAndResetThunk.pending, (s) => {
                s.status = "loading";
            })
            .addCase(logoutAndResetThunk.fulfilled, (s) => {
                s.status = "idle";
            })
            .addCase(logoutAndResetThunk.rejected, (s) => {
                s.status = "idle";
            });
    },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;

export const selectAuthUser = (s) => s.user.user;
export const selectAuthToken = (s) => s.user.token;
export const selectAuthStatus = (s) => s.user.status;
export const selectAuthError = (s) => s.user.error;

// ✅ evita depender de localStorage no selector (fica fonte dupla)
// deixe a “verdade” no redux; token inicial já vem do localStorage via initialState
export const selectIsAuthed = (s) => !!s.user.token;