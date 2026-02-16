// src/routes/router.jsx
import React from "react";
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "./App";

// import Dashboard from "../pages/Dashboard";
// import Transactions from "../pages/Transactions";
// import Invoices from "../pages/Invoices";
// import Installments from "../pages/Installments";
// import AccountsPage from "../pages/AccountsPage";
// import BillsPage from "../pages/BillsPage";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Transactions = lazy(() => import("../pages/Transactions"));
const Invoices = lazy(() => import("../pages/Invoices"));
const Installments = lazy(() => import("../pages/Installments"));
const AccountsPage = lazy(() => import("../pages/AccountsPage"));
const BillsPage = lazy(() => import("../pages/BillsPage"));

const CadastrosPage = lazy(() => import("../pages/CadastrosPage"));
const CategoriasPage = lazy(() => import("../pages/CategoriasPage"));


import AuthShell from "../layouts/AuthShell.jsx";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";

const wrap = (el) => <Suspense fallback={null}>{el}</Suspense>;

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: wrap(<Dashboard />) },
      { path: "lancamentos", element: wrap(<Transactions />) },
      { path: "faturas", element: wrap(<Invoices />) },
      { path: "parcelamentos", element: wrap(<Installments />) },
      { path: "contas", element: wrap(<AccountsPage />) },
      { path: "despesas", element: wrap(<BillsPage />) },
      { path: "*", element: <Navigate to="/" replace /> },
      // ✅ public com transição (shell + outlet animado)
      {
        element: <AuthShell />,
        children: [
          { path: "login", element: <LoginPage /> },
          { path: "register", element: <RegisterPage /> },
        ],
      },
      { path: "cadastros", element: wrap(<CadastrosPage />) },
      { path: "cadastros/categorias", element: wrap(<CategoriasPage />) },


      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

// export const router = createBrowserRouter([
//   {
//     path: "/",
//     element: <App />,
//     children: [
//       { index: true, element: <Dashboard /> },
//       { path: "lancamentos", element: <Transactions /> },
//       { path: "faturas", element: <Invoices /> },
//       { path: "parcelamentos", element: <Installments /> },
//       { path: "contas", element: <AccountsPage /> },
//       { path: "despesas", element: <BillsPage /> },

      
//     ],
//   },
// ]);
