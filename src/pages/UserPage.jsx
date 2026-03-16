import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Stack,
    Typography,
    Container
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import PhoneRoundedIcon from "@mui/icons-material/PhoneRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import HeadsetMicRoundedIcon from "@mui/icons-material/HeadsetMicRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";

import { fetchMe } from "../api/authApi";
import { trackEvent } from "../utils/analytics";
import { logout, selectAuthToken } from "../store/authSlice";

import IconButton from "@mui/material/IconButton";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";

const TOKEN_KEY = "authToken";

function getStoredToken(fallbackToken = "") {
    return fallbackToken || localStorage.getItem(TOKEN_KEY) || "";
}

function formatDateBR(value) {
    if (!value) return "-";

    const d = new Date(value);

    return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function buildDisplayName(user) {
    if (!user) return "-";

    const firstLast = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    if (firstLast) return firstLast;
    if (user.nome) return user.nome;
    if (user.name) return user.name;
    if (user.username) return user.username;
    if (user.email) return user.email;

    return "-";
}

function formatPhoneBR(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "-";

    if (digits.length === 13 && digits.startsWith("55")) {
        const ddd = digits.slice(2, 4);
        const first = digits.slice(4, 9);
        const last = digits.slice(9, 13);
        return `+55 (${ddd}) ${first}-${last}`;
    }

    if (digits.length === 12 && digits.startsWith("55")) {
        const ddd = digits.slice(2, 4);
        const first = digits.slice(4, 8);
        const last = digits.slice(8, 12);
        return `+55 (${ddd}) ${first}-${last}`;
    }

    if (digits.length === 11) {
        const ddd = digits.slice(0, 2);
        const first = digits.slice(2, 7);
        const last = digits.slice(7, 11);
        return `(${ddd}) ${first}-${last}`;
    }

    if (digits.length === 10) {
        const ddd = digits.slice(0, 2);
        const first = digits.slice(2, 6);
        const last = digits.slice(6, 10);
        return `(${ddd}) ${first}-${last}`;
    }

    return value;
}

export default function UserPage() {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const authToken = useSelector(selectAuthToken);

    const [user, setUser] = useState(null);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");

    const token = useMemo(() => getStoredToken(authToken), [authToken]);

    const loadMe = useCallback(async () => {
        if (!token) {
            setUser(null);
            setStatus("idle");
            setError("");
            return;
        }

        try {
            setStatus("loading");
            setError("");

            const data = await fetchMe();
            setUser(data || null);
            setStatus("succeeded");
        } catch (err) {
            console.error("[USER PAGE] erro ao carregar /me:", err);
            setUser(null);
            setStatus("failed");
            setError("Não foi possível carregar os dados do usuário.");
        }
    }, [token]);

    useEffect(() => {
        loadMe();
    }, [loadMe]);

    const handleLogout = () => {
        trackEvent("logout_click", { location: "user_page" });
        dispatch(logout());
        navigate("/login", { replace: true });
    };

    const handleGoSupport = () => {
        trackEvent("open_support_page", { location: "user_page" });
        navigate("/cadastros/suporte");
    };

    const handleManageSubscription = () => {
        trackEvent("open_subscription_section", { location: "user_page" });

        // aqui depois você pode trocar para a rota real:
        // navigate("/cadastros/assinatura");
    };

    const displayName = buildDisplayName(user);
    const formattedPhone = formatPhoneBR(user?.fone);

    return (
<Container maxWidth="md" sx={{ py: 3 }}>
            <Stack spacing={2.2}>
                <Box>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent={"space-between"}>

                        <Typography variant="h5" fontWeight={800}>
                            Minha conta
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<ArrowBackRoundedIcon />}
                                onClick={() => navigate(-1)}
                        >
                            Voltar
                        </Button>
                    </Stack>

                    <Typography variant="body2" sx={{ opacity: 0.72, mt: 0.5 }}>
                        Dados do usuário, sessão e conta.
                    </Typography>
                </Box>

                {!token && (
                    <Alert severity="info">
                        Nenhuma sessão ativa encontrada.
                    </Alert>
                )}

                {status === "loading" && (
                    <Card sx={{ borderRadius: 1 }}>
                        <CardContent>
                            <Stack direction="row" spacing={1.2} alignItems="center">
                                <CircularProgress size={18} />
                                <Typography>Carregando dados do usuário...</Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                )}

                {status === "failed" && (
                    <Alert
                        severity="error"
                        action={
                            <Button color="inherit" size="small" onClick={loadMe}>
                                Tentar novamente
                            </Button>
                        }
                    >
                        {error}
                    </Alert>
                )}

                {status === "succeeded" && (
                    <>
                        <Card sx={{ borderRadius: 1 }}>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <AccountCircleRoundedIcon />
                                        <Typography fontWeight={800}>Usuário</Typography>
                                    </Stack>

                                    <Divider />

                                    <Stack spacing={1.3}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <AccountCircleRoundedIcon fontSize="small" />
                                            <Typography variant="body2" sx={{ minWidth:122, opacity: 0.7 }}>
                                                Nome
                                            </Typography>
                                            <Typography fontWeight={700}>{displayName}</Typography>
                                        </Stack>

                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <AlternateEmailRoundedIcon fontSize="small" />
                                            <Typography variant="body2" sx={{ minWidth:122, opacity: 0.7 }}>
                                                E-mail
                                            </Typography>
                                            <Typography fontWeight={700}>{user?.email || "-"}</Typography>
                                        </Stack>

                                        {!!user?.fone && (
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <PhoneRoundedIcon fontSize="small" />
                                                <Typography variant="body2" sx={{ minWidth:122, opacity: 0.7 }}>
                                                    Telefone
                                                </Typography>
                                                <Typography fontWeight={700}>{formattedPhone}</Typography>
                                            </Stack>
                                        )}
                                        {!!user?.date_joined && (
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <BadgeRoundedIcon fontSize="small" />
                                                <Typography variant="body2" sx={{ minWidth:122, opacity: 0.7 }}>
                                                    Usuário desde
                                                </Typography>
                                                <Typography fontWeight={700}>
                                                    {formatDateBR(user.date_joined)}
                                                </Typography>
                                            </Stack>
                                        )}

                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Card sx={{ borderRadius: 1 }}>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <WorkspacePremiumRoundedIcon />
                                        <Typography fontWeight={800}>Assinatura</Typography>
                                    </Stack>

                                    <Divider />

                                    <Stack
                                        direction={{ xs: "column", sm: "row" }}
                                        spacing={1.2}
                                        alignItems={{ xs: "flex-start", sm: "center" }}
                                        justifyContent="space-between"
                                    >
                                        <Stack spacing={0.8}>
                                            <Typography fontWeight={700}>
                                                Área de plano e cobrança
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.72 }}>
                                                Aqui você poderá gerenciar plano, status da assinatura, cobrança e histórico.
                                            </Typography>

                                            <Chip
                                                label="Preparado para integração"
                                                color="warning"
                                                size="small"
                                                sx={{ width: "fit-content" }}
                                            />
                                        </Stack>

                                        <Button
                                            variant="outlined"
                                            endIcon={<ChevronRightRoundedIcon />}
                                            onClick={handleManageSubscription}
                                        >
                                            Gerenciar assinatura
                                        </Button>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Card sx={{ borderRadius: 1 }}>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <VpnKeyRoundedIcon />
                                        <Typography fontWeight={800}>Sessão</Typography>
                                    </Stack>

                                    <Divider />

                                    <Stack
                                        direction={{ xs: "column", sm: "row" }}
                                        spacing={1.2}
                                        alignItems={{ xs: "flex-start", sm: "center" }}
                                        justifyContent="space-between"
                                    >
                                        <Stack spacing={0.8}>
                                            <Typography variant="body2" sx={{ opacity: 0.72 }}>
                                                Status da autenticação
                                            </Typography>

                                            <Chip
                                                label={token ? "Sessão ativa" : "Sem token"}
                                                color={token ? "success" : "default"}
                                                size="small"
                                            />
                                        </Stack>

                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                variant="outlined"
                                                startIcon={<HeadsetMicRoundedIcon />}
                                                onClick={handleGoSupport}
                                            >
                                                Suporte
                                            </Button>

                                            <Button
                                                color="error"
                                                variant="contained"
                                                startIcon={<LogoutRoundedIcon />}
                                                onClick={handleLogout}
                                            >
                                                Sair
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </CardContent>
                        </Card>
                    </>
                )}
            </Stack>
        </Container>
    );
}