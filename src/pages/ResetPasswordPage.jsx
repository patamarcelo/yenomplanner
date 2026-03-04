// src/pages/ResetPasswordPage.jsx
import React, { useMemo, useState } from "react";
import {
    Box,
    Typography,
    TextField,
    Button,
    Stack,
    Alert,
    InputAdornment,
    IconButton,
    CircularProgress,
} from "@mui/material";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";

import LockRoundedIcon from "@mui/icons-material/LockRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

import { confirmPasswordReset } from "../api/authApi";
import { trackEvent } from "../utils/analytics";

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPasswordPage() {
    const q = useQuery();
    const navigate = useNavigate();

    const uid = String(q.get("uid") || "").trim();
    const token = String(q.get("token") || "").trim();

    const [pass1, setPass1] = useState("");
    const [pass2, setPass2] = useState("");

    const [show1, setShow1] = useState(false);
    const [show2, setShow2] = useState(false);

    const [busy, setBusy] = useState(false);
    const [ok, setOk] = useState(false);
    const [error, setError] = useState("");

    const hasParams = !!(uid && token);

    const canSubmit = useMemo(() => {
        if (!hasParams) return false;
        if (!pass1 || pass1.length < 6) return false;
        if (pass1 !== pass2) return false;
        return true;
    }, [hasParams, pass1, pass2]);

    function validate() {
        if (!hasParams) return "Link inválido ou incompleto. Peça um novo e-mail de redefinição.";
        if (!pass1 || pass1.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
        if (pass1 !== pass2) return "As senhas não conferem.";
        return "";
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        const msg = validate();
        if (msg) {
            setError(msg);
            return;
        }

        setBusy(true);
        try {
            await confirmPasswordReset({
                uid,
                token,
                new_password: pass1,
            });

            setOk(true);
            trackEvent("password_reset_confirmed", { method: "email_link" });

            // opcional: redireciona automaticamente após sucesso
            setTimeout(() => navigate("/login", { replace: true }), 900);
        } catch (err) {
            // backend idealmente devolve 400 com detalhe, mas aqui mantemos mensagem simples
            setError("Não foi possível redefinir. O link pode ter expirado. Solicite um novo e-mail.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Box sx={{ width: "100%", maxWidth: 480, mx: "auto", mt: "110px", px: 1.2 }}>
            <Stack spacing={1.2} sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                    Redefinir senha
                </Typography>

                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Crie uma nova senha para acessar sua conta.
                </Typography>
            </Stack>

            {!hasParams ? (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                    Link inválido ou incompleto. Volte e solicite um novo e-mail em “Esqueci minha senha”.
                </Alert>
            ) : null}

            {ok ? (
                <Alert icon={<CheckCircleRoundedIcon />} severity="success" sx={{ mb: 1.5 }}>
                    Senha alterada com sucesso! Redirecionando para o login…
                </Alert>
            ) : null}

            {error ? (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                    {error}
                </Alert>
            ) : null}

            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={1.3}>
                    <TextField
                        label="Nova senha"
                        value={pass1}
                        onChange={(e) => setPass1(e.target.value)}
                        fullWidth
                        disabled={busy || ok || !hasParams}
                        type={show1 ? "text" : "password"}
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
                                        onClick={() => setShow1((v) => !v)}
                                        edge="end"
                                        aria-label={show1 ? "Ocultar senha" : "Mostrar senha"}
                                        disabled={busy || ok || !hasParams}
                                    >
                                        {show1 ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                        helperText="Mínimo de 6 caracteres."
                    />

                    <TextField
                        label="Confirmar nova senha"
                        value={pass2}
                        onChange={(e) => setPass2(e.target.value)}
                        fullWidth
                        disabled={busy || ok || !hasParams}
                        type={show2 ? "text" : "password"}
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
                                        onClick={() => setShow2((v) => !v)}
                                        edge="end"
                                        aria-label={show2 ? "Ocultar senha" : "Mostrar senha"}
                                        disabled={busy || ok || !hasParams}
                                    >
                                        {show2 ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={!canSubmit || busy || ok}
                        sx={{
                            fontWeight: 950,
                            py: 1.25,
                            borderRadius: 2.4,
                            textTransform: "none",
                        }}
                        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : null}
                    >
                        {busy ? "Salvando..." : "Salvar nova senha"}
                    </Button>

                    <Button
                        component={RouterLink}
                        to="/login"
                        variant="text"
                        sx={{ textTransform: "none", fontWeight: 900 }}
                    >
                        Voltar para o login
                    </Button>
                </Stack>
            </Box>
        </Box>
    );
}