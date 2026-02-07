import React from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Dashboard from "../pages/Dashboard";
import Transactions from "../pages/Transactions";
import Invoices from "../pages/Invoices";
import Installments from "../pages/Installments";
import AccountsPage from "../pages/AccountsPage";

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
    ],
  },
]);
