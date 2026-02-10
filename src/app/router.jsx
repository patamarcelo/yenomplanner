import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

import Dashboard from "../pages/Dashboard";
import Transactions from "../pages/Transactions";
import Invoices from "../pages/Invoices";
import Installments from "../pages/Installments";
import AccountsPage from "../pages/AccountsPage";

// ✅ novas páginas
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

      // ✅ public
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },

      // ✅ fallback (evita 404)
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
