import React, { useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import Layout from "./Layout";

export default function App() {
  useLayoutEffect(() => {
    // navigator.standalone is the iOS Home Screen signal; retain the standard
    // display-mode check for installed apps on other browsers.
    const installed = window.navigator.standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;
    document.documentElement.classList.toggle("app-standalone", installed);
    return () => document.documentElement.classList.remove("app-standalone");
  }, []);
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
