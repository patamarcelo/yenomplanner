import { createSlice } from "@reduxjs/toolkit";
import { bootstrapThunk } from "./bootstrapThunk";

const bootstrapSlice = createSlice({
    name: "bootstrap",
    initialState: {
        status: "idle", // idle | loading | succeeded | failed
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(bootstrapThunk.pending, (state) => {
                state.status = "loading";
                state.error = null;
            })
            .addCase(bootstrapThunk.fulfilled, (state) => {
                state.status = "succeeded";
            })
            .addCase(bootstrapThunk.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.error?.message || "Erro no bootstrap";
            });
    },
});

export default bootstrapSlice.reducer;