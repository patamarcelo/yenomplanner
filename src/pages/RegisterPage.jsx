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
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import PhoneIphoneRoundedIcon from "@mui/icons-material/PhoneIphoneRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";

import {
    signupThunk,
    meThunk,
    selectAuthStatus,
    selectAuthError,
} from "../store/authSlice";

function normalizePhoneBR(v) {
    return String(v || "").replace(/\D/g, "").slice(0, 11);
}

export default function RegisterPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const status = useSelector(selectAuthStatus);
    const apiError = useSelector(selectAuthError);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [fone, setFone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [showPass, setShowPass] = useState(false);
    const [localError, setLocalError] = useState("");

    const loading = status === "loading";

    const canSubmit = useMemo(() => {
        const e = email.trim();
        const p = password.trim();
        const fn = firstName.trim();
        const ln = lastName.trim();
        const ph = normalizePhoneBR(fone);
        return fn && ln && ph.length >= 10 && e.includes("@") && p.length >= 6;
    }, [firstName, lastName, fone, email, password]);

    function validate() {
        const fn = firstName.trim();
        const ln = lastName.trim();
        const ph = normalizePhoneBR(fone);
        const e = email.trim();
        const p = password.trim();

        if (!fn) return "Preencha o Primeiro nome.";
        if (!ln) return "Preencha o Sobrenome.";
        if (ph.length < 10) return "Informe um telefone válido (com DDD).";
        if (!e || !e.includes("@")) return "Informe um e-mail válido.";
        if (p.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
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

        const payload = {
            email: email.trim().toLowerCase(),
            password: password.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            fone: normalizePhoneBR(fone),
        };

        try {
            await dispatch(signupThunk(payload)).unwrap();
            await dispatch(meThunk()).unwrap();
            navigate("/"); // ajuste se seu "home" for outra rota
        } catch (err) {
            // erro já vem no slice; aqui só garante mensagem fallback
            setLocalError("Não foi possível criar a conta. Verifique os dados e tente novamente.");
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
                            Criar conta
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Cadastre-se para começar a usar o YenomPlanner.
                        </Typography>
                    </Stack>

                    {localError ? <Alert severity="error" sx={{ mb: 1.5 }}>{localError}</Alert> : null}
                    {apiError ? <Alert severity="error" sx={{ mb: 1.5 }}>{apiError}</Alert> : null}

                    <Box component="form" onSubmit={handleSubmit}>
                        <Stack spacing={1.3}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                                <TextField
                                    label="Primeiro nome"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    fullWidth
                                    disabled={loading}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonRoundedIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <TextField
                                    label="Sobrenome"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    fullWidth
                                    disabled={loading}
                                />
                            </Stack>

                            <TextField
                                label="Telefone (DDD)"
                                value={fone}
                                onChange={(e) => setFone(e.target.value)}
                                fullWidth
                                disabled={loading}
                                inputMode="numeric"
                                placeholder="Ex: 11999999999"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <PhoneIphoneRoundedIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }}
                            />

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
                                autoComplete="new-password"
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
                                {loading ? "Criando..." : "Criar conta"}
                            </Button>

                            <Divider />

                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Já tem conta?{" "}
                                <Typography
                                    component={RouterLink}
                                    to="/login"
                                    variant="body2"
                                    sx={{ fontWeight: 800, textDecoration: "none" }}
                                >
                                    Entrar
                                </Typography>
                            </Typography>
                        </Stack>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
}
