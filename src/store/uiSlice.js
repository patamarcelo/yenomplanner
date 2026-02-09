// src/store/uiSlice.js
import { createSlice } from "@reduxjs/toolkit";

function loadHideValues() {
    try {
        return localStorage.getItem("yenom_hide_values") === "1";
    } catch {
        return false;
    }
}

const initialState = {
    hideValues: loadHideValues(),
};

const uiSlice = createSlice({
    name: "ui",
    initialState,
    reducers: {
        setHideValues(state, action) {
            state.hideValues = !!action.payload;
            try {
                localStorage.setItem("yenom_hide_values", state.hideValues ? "1" : "0");
            } catch { }
        },
        toggleHideValues(state) {
            state.hideValues = !state.hideValues;
            try {
                localStorage.setItem("yenom_hide_values", state.hideValues ? "1" : "0");
            } catch { }
        },
    },
});

export const { setHideValues, toggleHideValues } = uiSlice.actions;
export default uiSlice.reducer;

// selectors
export const selectHideValues = (s) => !!s.ui?.hideValues;
