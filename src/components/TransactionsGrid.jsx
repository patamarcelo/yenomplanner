import React from "react";
import { useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import TransactionsGridDesktop from "./TransactionsGridDesktop";
import TransactionsGridMobile from "./TransactionsGridMobile";

export default function TransactionsGrid(props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  if (isMobile) {
    return <TransactionsGridMobile {...props} />;
  }

  return <TransactionsGridDesktop {...props} />;
}