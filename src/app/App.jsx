import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Layout from "./Layout";
import { installViewportDiagnostics } from "../utils/viewportDiagnostics.js";

export default function App() {
  useEffect(installViewportDiagnostics, []);
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
