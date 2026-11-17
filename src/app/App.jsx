import React from "react";
import { Outlet } from "react-router-dom";
import Layout from "./Layout";
import useAppViewport from "../hooks/useAppViewport.js";

export default function App() {
  useAppViewport();
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
