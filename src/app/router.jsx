// src/routes/router.jsx
import React, { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

import AuthShell from "../layouts/AuthShell.jsx";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Transactions = lazy(() => import("../pages/Transactions"));
const Invoices = lazy(() => import("../pages/Invoices"));
const Installments = lazy(() => import("../pages/Installments"));
const AccountsPage = lazy(() => import("../pages/AccountsPage"));
const BillsPage = lazy(() => import("../pages/BillsPage"));

const CadastrosPage = lazy(() => import("../pages/CadastrosPage"));
const CategoriasPage = lazy(() => import("../pages/CategoriasPage"));

// ✅ NOVO: reset password page
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));

const wrap = (el) => <Suspense fallback={null}>{el}</Suspense>;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // -------------------------
      // Private / App routes
      // -------------------------
      { index: true, element: wrap(<Dashboard />) },
      { path: "lancamentos", element: wrap(<Transactions />) },
      { path: "faturas", element: wrap(<Invoices />) },
      { path: "parcelamentos", element: wrap(<Installments />) },
      { path: "contas", element: wrap(<AccountsPage />) },
      { path: "despesas", element: wrap(<BillsPage />) },

      { path: "cadastros", element: wrap(<CadastrosPage />) },
      { path: "cadastros/categorias", element: wrap(<CategoriasPage />) },

      // -------------------------
      // Public routes (AuthShell)
      // -------------------------
      {
        element: <AuthShell />,
        children: [
          { path: "login", element: <LoginPage /> },
          { path: "register", element: <RegisterPage /> },

          // ✅ link do e-mail: /reset-password?uid=...&token=...
          { path: "reset-password", element: wrap(<ResetPasswordPage />) },
        ],
      },

      // -------------------------
      // Fallback
      // -------------------------
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);