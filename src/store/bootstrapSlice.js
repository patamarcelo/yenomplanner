// src/store/bootstrapSlice.js
import { createSlice } from "@reduxjs/toolkit";
import { bootstrapThunk } from "./bootstrapThunk";

const initialState = {
    status: "idle", // idle | loading | succeeded | failed
    error: null,
    lastLoadedAt: null,
};

const bootstrapSlice = createSlice({
    name: "bootstrap",
    initialState,
    reducers: {
        resetBootstrapState: () => initialState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(bootstrapThunk.pending, (state) => {
                state.status = "loading";
                state.error = null;
            })
            .addCase(bootstrapThunk.fulfilled, (state) => {
                state.status = "succeeded";
                state.error = null;
                state.lastLoadedAt = Date.now();
            })
            .addCase(bootstrapThunk.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload || action.error?.message || "Erro no bootstrap";
            });
    },
});

export const { resetBootstrapState } = bootstrapSlice.actions;

export const selectBootstrapStatus = (state) => state.bootstrap?.status || "idle";
export const selectBootstrapError = (state) => state.bootstrap?.error || null;
export const selectBootstrapLastLoadedAt = (state) => state.bootstrap?.lastLoadedAt || null;

export default bootstrapSlice.reducer;
