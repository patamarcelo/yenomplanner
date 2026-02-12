// src/layouts/AuthShell.jsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    Box,
    Card,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
    Divider,
} from "@mui/material";

import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";

const HERO_IMG = "/assets/image/banner-1.png";
const MotionBox = motion(Box);

// paleta (pode ajustar depois)
const ICON_COLORS = {
    dashboard: "#3b82f6", // blue
    invoices: "#ef4444",  // red
    transactions: "#a855f7", // purple
    insights: "#06b6d4",  // cyan
    speed: "#f59e0b",     // amber
    security: "#22c55e",  // green
};

function Pill({ icon, label, color }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.7,
                px: 1.2,
                py: 0.75,
                borderRadius: 999,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                fontSize: 12,
                fontWeight: 850,
                lineHeight: 1,
                userSelect: "none",
            }}
        >
            <Box
                sx={{
                    display: "grid",
                    placeItems: "center",
                    opacity: 0.95,
                    color: color,
                    filter: "saturate(1.2)",
                    textShadow:
                        theme.palette.mode === "dark" ? `0 0 10px ${color}55` : "none",
                }}
            >
                {icon}
            </Box>
            {label}
        </Box>
    );
}

function Feature({ icon, title, desc, color }) {
    return (
        <Stack direction="row" spacing={1.2} sx={{ alignItems: "flex-start" }}>
            <Box
                sx={(theme) => ({
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    flex: "0 0 auto",
                })}
            >
                <Box
                    sx={(theme) => ({
                        display: "grid",
                        placeItems: "center",
                        color: color,
                        filter: "saturate(1.25)",
                        transform: "translateY(-0.5px)",
                        textShadow:
                            theme.palette.mode === "dark" ? `0 0 10px ${color}55` : "none",
                    })}
                >
                    {icon}
                </Box>
            </Box>

            <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 13, lineHeight: 1.2 }}>
                    {title}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", fontSize: 12.5, mt: 0.25 }}>
                    {desc}
                </Typography>
            </Box>
        </Stack>
    );
}

export default function AuthShell() {
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
    const location = useLocation();
    const isRegister = location.pathname.includes("/register");

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                p: { xs: 1.5, md: 3 },
                background:
                    theme.palette.mode === "dark"
                        ? "radial-gradient(1200px 500px at 20% 10%, rgba(10,132,255,0.18), transparent 55%), radial-gradient(900px 450px at 80% 20%, rgba(34,197,94,0.16), transparent 55%), #0b0f18"
                        : "radial-gradient(1200px 500px at 20% 10%, rgba(0,122,255,0.10), transparent 55%), radial-gradient(900px 450px at 80% 20%, rgba(34,197,94,0.10), transparent 55%), #f6f7fb",
            }}
        >
            <Card
                elevation={0}
                sx={{
                    width: "100%",
                    maxWidth: 1040,
                    borderRadius: 4,
                    overflow: "hidden",
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: "background.paper",
                }}
            >
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1.05fr 0.95fr" },
                        minHeight: { xs: "auto", md: 600 },
                    }}
                >
                    {/* ===== ESQUERDA ===== */}
                    <Box
                        sx={{
                            p: { xs: 2.2, md: 3.2 },
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            background:
                                theme.palette.mode === "dark"
                                    ? "linear-gradient(135deg, rgba(10,132,255,0.25), rgba(34,197,94,0.12))"
                                    : "linear-gradient(135deg, rgba(0,122,255,0.14), rgba(34,197,94,0.10))",
                            borderRight: { md: `1px solid ${theme.palette.divider}` },
                            gap: 2,
                        }}
                    >
                        {/* Top: branding + copy */}
                        <Stack spacing={1}>
                            <Typography
                                variant={isMdUp ? "h4" : "h5"}
                                sx={{ fontWeight: 980, letterSpacing: -0.8, lineHeight: 1.02 }}
                            >
                                Yenom Planner
                            </Typography>

                            <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 520 }}>
                                {isRegister
                                    ? "Crie sua conta e comece com um painel limpo para controlar despesas, faturas e lançamentos."
                                    : "Acesse sua conta e tenha uma visão clara do mês: despesas, faturas e lançamentos no mesmo lugar."}
                            </Typography>

                            {/* Pills */}
                            <Stack direction="row" spacing={1} sx={{ mt: 1.2, flexWrap: "wrap" }}>
                                <Pill
                                    icon={<DashboardRoundedIcon fontSize="small" />}
                                    label="Dashboard"
                                    color={ICON_COLORS.dashboard}
                                />
                                <Pill
                                    icon={<ReceiptLongRoundedIcon fontSize="small" />}
                                    label="Faturas"
                                    color={ICON_COLORS.invoices}
                                />
                                <Pill
                                    icon={<CreditCardRoundedIcon fontSize="small" />}
                                    label="Lançamentos"
                                    color={ICON_COLORS.transactions}
                                />
                            </Stack>
                        </Stack>

                        {/* Middle: imagem */}
                        <Box sx={{ display: "grid", placeItems: "center" }}>
                            <Box
                                component="img"
                                src={HERO_IMG}
                                alt="Yenom Planner"
                                sx={{
                                    width: "100%",
                                    maxWidth: 560,
                                    height: { xs: 180, md: 320 },
                                    objectFit: "contain",
                                    filter:
                                        theme.palette.mode === "dark"
                                            ? "drop-shadow(0 14px 50px rgba(0,0,0,0.35))"
                                            : "drop-shadow(0 10px 35px rgba(0,0,0,0.12))",
                                }}
                            />
                        </Box>

                        {/* Bottom: features */}
                        <Box>
                            <Divider sx={{ opacity: 0.7, mb: 1.8 }} />

                            <Stack spacing={1.4}>
                                <Feature
                                    icon={<AutoGraphRoundedIcon fontSize="small" />}
                                    title="Visão do mês em 1 clique"
                                    desc="KPIs e filtros rápidos para entender onde seu dinheiro está indo."
                                    color={ICON_COLORS.insights}
                                />

                                <Feature
                                    icon={<BoltRoundedIcon fontSize="small" />}
                                    title="Fluxo rápido de lançamentos"
                                    desc="Crie e organize lançamentos sem fricção, com categorização simples."
                                    color={ICON_COLORS.speed}
                                />

                                <Feature
                                    icon={<ShieldRoundedIcon fontSize="small" />}
                                    title="Sessão e dados protegidos"
                                    desc="Autenticação e navegação consistentes para você focar no que importa."
                                    color={ICON_COLORS.security}
                                />
                            </Stack>
                        </Box>
                    </Box>

                    {/* ===== DIREITA (FORM) ===== */}
                    <Box
                        sx={{
                            p: { xs: 2.2, md: 3.2 },
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                        }}
                    >
                        <AnimatePresence mode="wait">
                            <MotionBox
                                key={location.pathname}
                                sx={{ width: "100%", maxWidth: 460 }}
                                initial={{ x: isRegister ? 56 : -56, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: isRegister ? -56 : 56, opacity: 0 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                            >
                                <Outlet />
                            </MotionBox>
                        </AnimatePresence>
                    </Box>
                </Box>
            </Card>
        </Box>
    );
}
