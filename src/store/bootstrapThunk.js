// src/store/bootstrapThunk.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchBootstrap } from "../api/bootstrapApi";

// ações dos seus slices (vamos criar se não existirem)
import { setAccountsFromBootstrap } from "./accountsSlice";
import { setTransactionsFromBootstrap } from "./transactionsSlice";
import { setBillsFromBootstrap } from "./billsSlice";
import { setCategoriesFromBootstrap } from "./categoriesSlice";

export const bootstrapThunk = createAsyncThunk("bootstrap/load", async (_, { dispatch }) => {
    const data = await fetchBootstrap();

    // distribui pros slices
    if (data?.accounts) dispatch(setAccountsFromBootstrap(data.accounts));
    if (data?.transactions) dispatch(setTransactionsFromBootstrap(data.transactions));
    if (data?.bills) dispatch(setBillsFromBootstrap(data.bills));
    if (data?.categories) dispatch(setCategoriesFromBootstrap(data.categories));

    return { ok: true };
});
