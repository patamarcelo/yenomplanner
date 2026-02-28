import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { signup, login, fetchMe } from "../api/authApi";

const TOKEN_KEY = "authToken";

export const signupThunk = createAsyncThunk("auth/signup", async (payload) => {
    const data = await signup(payload);

    if (data?.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
    }

    return data;
});

export const loginThunk = createAsyncThunk("auth/login", async (payload) => {
    const data = await login(payload);

    if (data?.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
    }

    return data;
});

export const meThunk = createAsyncThunk(
    "auth/me",
    async (_, { rejectWithValue }) => {
        try {
            const data = await fetchMe();
            return data;
        } catch (err) {
            localStorage.removeItem(TOKEN_KEY);
            return rejectWithValue("Sessão expirada");
        }
    }
);

const initialState = {
    user: null,
    token: localStorage.getItem(TOKEN_KEY) || "",
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
            localStorage.removeItem(TOKEN_KEY);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(signupThunk.fulfilled, (s, a) => {
                s.status = "succeeded";
                s.user = a.payload;
                s.token = a.payload?.token || s.token;
            })

            .addCase(loginThunk.fulfilled, (s, a) => {
                s.status = "succeeded";
                s.token = a.payload?.token || "";
            })

            .addCase(meThunk.fulfilled, (s, a) => {
                s.user = a.payload;
            })

            .addCase(meThunk.rejected, (s, a) => {
                s.user = null;
                s.token = "";
                s.status = "idle";
                s.error = a.payload || "Sessão expirada";
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