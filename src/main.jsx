import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { AppThemeProvider } from "./theme/index.jsx";
import { router } from "./app/router";
import "./styles/globals.css";
import { Provider } from 'react-redux'
import { store } from "./store/store.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppThemeProvider>
      <CssBaseline />
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </AppThemeProvider>
  </React.StrictMode >
);
