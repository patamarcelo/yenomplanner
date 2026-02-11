// src/routes/router.jsx (ou onde você define o createBrowserRouter)
import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

import Dashboard from "../pages/Dashboard";
import Transactions from "../pages/Transactions";
import Invoices from "../pages/Invoices";
import Installments from "../pages/Installments";
import AccountsPage from "../pages/AccountsPage";
import BillsPage from "../pages/BillsPage"; // ✅ NOVO

// ✅ public
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "lancamentos", element: <Transactions /> },
      { path: "faturas", element: <Invoices /> },
      { path: "parcelamentos", element: <Installments /> },
      { path: "contas", element: <AccountsPage /> },

      // ✅ NOVO
      { path: "despesas", element: <BillsPage /> },

      // ✅ public
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },

      // ✅ fallback
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
