// src/store/categoriesSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { listCategories } from "../api/categoriesApi";

export const fetchCategoriesThunk = createAsyncThunk("categories/fetchAll", async () => {
    return await listCategories();
});

const initialState = {
    categories: [],
    status: "idle",
    error: "",
};

const categoriesSlice = createSlice({
    name: "categories",
    initialState,
    reducers: {
        resetCategories(state) {
            state.categories = [];
            state.status = "idle";
            state.error = "";
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchCategoriesThunk.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(fetchCategoriesThunk.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.categories = action.payload || [];
            })
            .addCase(fetchCategoriesThunk.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.error?.message || "Erro ao carregar categorias.";
            });
    },
});

export const { resetCategories } = categoriesSlice.actions;

export const selectCategories = (state) => state.categories?.items || [];

export const selectActiveCategories = (state) =>
    (state.categories?.items || []).filter((c) => c.active !== false);


export const selectCategoriesStatus = (s) => s.categories.status;
export const selectCategoriesError = (s) => s.categories.error;

export const selectCategoryById = (id) => (s) =>
    (s.categories.categories || []).find((c) => String(c.id) === String(id)) || null;

export default categoriesSlice.reducer;