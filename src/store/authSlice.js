import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { signup, login, fetchMe } from "../api/authApi";

export const signupThunk = createAsyncThunk("auth/signup", async (payload) => {
    const data = await signup(payload);
    // se seu serializer já retorna token:
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
            localStorage.removeItem("authToken");
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(signupThunk.pending, (s) => { s.status = "loading"; s.error = ""; })
            .addCase(signupThunk.fulfilled, (s, a) => {
                s.status = "succeeded";
                s.user = a.payload;
                s.token = a.payload?.token || s.token;
            })
            .addCase(signupThunk.rejected, (s, a) => { s.status = "failed"; s.error = a.error.message || "Erro no cadastro"; })

            .addCase(loginThunk.pending, (s) => { s.status = "loading"; s.error = ""; })
            .addCase(loginThunk.fulfilled, (s, a) => {
                s.status = "succeeded";
                s.token = a.payload?.token || "";
            })
            .addCase(loginThunk.rejected, (s, a) => { s.status = "failed"; s.error = a.error.message || "Erro no login"; })
            .addCase(meThunk.rejected, (s, a) => {
                s.user = null;
                s.token = "";
                s.status = "idle";
                s.error = a.payload || "Sessão expirada";
            })
            .addCase(meThunk.fulfilled, (s, a) => {
                s.user = a.payload;
                if (a.payload?.token) s.token = a.payload.token;
            });
    },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;

export const selectAuthUser = (s) => s.user.user;
export const selectAuthToken = (s) => s.user.token;
export const selectAuthStatus = (s) => s.user.status;
export const selectAuthError = (s) => s.user.error;
export const selectIsAuthed = (s) => !!(s.user.token || localStorage.getItem("authToken"));

