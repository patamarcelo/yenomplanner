// src/store/bootstrapThunk.js
import { createAsyncThunk } from "@reduxjs/toolkit";
import { fetchBootstrap } from "../api/bootstrapApi";

import { setAccountsFromBootstrap } from "./accountsSlice";
import { setTransactionsFromBootstrap } from "./transactionsSlice";
import { setBillsFromBootstrap } from "./billsSlice";
import { setCategoriesFromBootstrap } from "./categoriesSlice";
import { setInvoicesFromBootstrap } from "./invoicesSlice";
import { mapAccountFromApi } from "../api/accountsApi";


export const bootstrapThunk = createAsyncThunk(
    "bootstrap/load",
    async (_, { dispatch, rejectWithValue }) => {
        try {
            const data = await fetchBootstrap();

            if (data?.accounts) {
                dispatch(setAccountsFromBootstrap((data.accounts || []).map(mapAccountFromApi)));
            }

            if (data?.transactions) {
                dispatch(setTransactionsFromBootstrap(data.transactions));
            }

            if (data?.bills) {
                dispatch(setBillsFromBootstrap(data.bills));
            }

            if (data?.categories) {
                dispatch(setCategoriesFromBootstrap(data.categories));
            }

            if (data?.invoices) {
                dispatch(setInvoicesFromBootstrap(data.invoices || []));
            }

            return {
                ok: true,
                counts: {
                    accounts: Array.isArray(data?.accounts) ? data.accounts.length : 0,
                    transactions: Array.isArray(data?.transactions) ? data.transactions.length : 0,
                    bills: Array.isArray(data?.bills) ? data.bills.length : 0,
                    categories: Array.isArray(data?.categories) ? data.categories.length : 0,
                    invoices: Array.isArray(data?.invoices) ? data.invoices.length : 0,
                },
            };
        } catch (error) {
            return rejectWithValue(
                error?.response?.data?.detail ||
                error?.response?.data?.message ||
                error?.message ||
                "Erro ao carregar bootstrap"
            );
        }
    }
);
