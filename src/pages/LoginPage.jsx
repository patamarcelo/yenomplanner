import React, { useMemo, useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Stack,
    Alert,
    Divider,
    InputAdornment,
    IconButton,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";

import {
    loginThunk,
    meThunk,
    selectAuthStatus,
    selectAuthError,
} from "../store/authSlice";

export default function LoginPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const status = useSelector(selectAuthStatus);
    const apiError = useSelector(selectAuthError);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [showPass, setShowPass] = useState(false);
    const [localError, setLocalError] = useState("");

    const loading = status === "loading";

    const canSubmit = useMemo(() => {
        const e = email.trim();
        const p = password.trim();
        return e.includes("@") && p.length >= 1;
    }, [email, password]);

    function validate() {
        const e = email.trim();
        const p = password.trim();
        if (!e || !e.includes("@")) return "Informe um e-mail válido.";
        if (!p) return "Informe sua senha.";
        return "";
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLocalError("");

        const msg = validate();
        if (msg) {
            setLocalError(msg);
            return;
        }

        // IMPORTANTE:
        // Seu CustomAuthToken pode esperar "username" OU "email".
        // Como seu USERNAME_FIELD é email, muitos setups aceitam { username: email, password }.
        // Vamos mandar os dois para garantir compatibilidade.
        const payload = {
            username: email.trim().toLowerCase(),
            email: email.trim().toLowerCase(),
            password: password.trim(),
        };

        try {
            await dispatch(loginThunk(payload)).unwrap();
            await dispatch(meThunk()).unwrap();
            navigate("/"); // ajuste se necessário
        } catch (err) {
            setLocalError("Não foi possível entrar. Verifique e-mail e senha.");
        }
    }

    return (
        <Box
            sx={{
                minHeight: "calc(100vh - 0px)",
                display: "grid",
                placeItems: "center",
                p: 2,
            }}
        >
            <Card sx={{ width: "100%", maxWidth: 520, borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                    <Stack spacing={1.2} sx={{ mb: 2 }}>
                        <Typography variant="h5" sx={{ fontWeight: 900 }}>
                            Entrar
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Acesse sua conta para continuar.
                        </Typography>
                    </Stack>

                    {localError ? <Alert severity="error" sx={{ mb: 1.5 }}>{localError}</Alert> : null}
                    {apiError ? <Alert severity="error" sx={{ mb: 1.5 }}>{apiError}</Alert> : null}

                    <Box component="form" onSubmit={handleSubmit}>
                        <Stack spacing={1.3}>
                            <TextField
                                label="E-mail"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                fullWidth
                                disabled={loading}
                                inputMode="email"
                                autoComplete="email"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <MailRoundedIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <TextField
                                label="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                fullWidth
                                disabled={loading}
                                type={showPass ? "text" : "password"}
                                autoComplete="current-password"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockRoundedIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={() => setShowPass((v) => !v)}
                                                edge="end"
                                                aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                                            >
                                                {showPass ? (
                                                    <VisibilityOffRoundedIcon fontSize="small" />
                                                ) : (
                                                    <VisibilityRoundedIcon fontSize="small" />
                                                )}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!canSubmit || loading}
                                sx={{ fontWeight: 900, py: 1.2, borderRadius: 2 }}
                            >
                                {loading ? "Entrando..." : "Entrar"}
                            </Button>

                            <Divider />

                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Não tem conta?{" "}
                                <Typography
                                    component={RouterLink}
                                    to="/register"
                                    variant="body2"
                                    sx={{ fontWeight: 800, textDecoration: "none" }}
                                >
                                    Criar conta
                                </Typography>
                            </Typography>
                        </Stack>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
