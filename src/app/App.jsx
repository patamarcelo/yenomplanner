import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Layout from "./Layout";
import useIOSStandaloneHeight from "../hooks/useIOSStandaloneHeight.js";
import { installViewportDiagnostics } from "../utils/viewportDiagnostics.js";

export default function App() {
  useIOSStandaloneHeight();
  useEffect(installViewportDiagnostics, []);
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
