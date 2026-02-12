// src/pages/LoginPage.jsx
import React, { useMemo, useState } from "react";
import {
    Box,
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
import TravelExploreRoundedIcon from "@mui/icons-material/TravelExploreRounded";

import { loginThunk, selectAuthStatus, selectAuthError } from "../store/authSlice";
import CircularProgress from "@mui/material/CircularProgress";

const TOUR_EMAIL = "tour@yenomplanner.com";
const TOUR_PASS = "Tour123456";

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

    function validate(eValue, pValue) {
        const e = (eValue ?? email).trim();
        const p = (pValue ?? password).trim();
        if (!e || !e.includes("@")) return "Informe um e-mail válido.";
        if (!p) return "Informe sua senha.";
        return "";
    }

    async function doLogin(eValue, pValue) {
        setLocalError("");

        const msg = validate(eValue, pValue);
        if (msg) {
            setLocalError(msg);
            return;
        }

        const payload = {
            username: eValue.trim().toLowerCase(),
            email: eValue.trim().toLowerCase(),
            password: pValue.trim(),
        };

        try {
            await dispatch(loginThunk(payload)).unwrap();
            navigate("/");
        } catch (err) {
            console.log("erro de login : ", err);
            setLocalError("Não foi possível entrar. Verifique e-mail e senha.");
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        await doLogin(email, password);
    }

    async function handleTour() {
        // preenche visualmente para o usuário ver o que entrou
        setEmail(TOUR_EMAIL);
        setPassword(TOUR_PASS);
        await doLogin(TOUR_EMAIL, TOUR_PASS);
    }

    return (
        <>
        
        <Box sx={{ width: "100%", marginTop: '110px' }}>
            <Stack spacing={1.2} sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
                    Entrar
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Acesse sua conta para continuar.
                </Typography>
            </Stack>

            {localError ? (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                    {localError}
                </Alert>
            ) : null}
            {apiError ? (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                    {apiError}
                </Alert>
            ) : null}

            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={1.3} sx={{marginBottom: '100px'}}>
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
                        sx={{
                            fontWeight: 950,
                            py: 1.25,
                            borderRadius: 2.4,
                            textTransform: "none",
                        }}
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
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
                            sx={{ fontWeight: 900, textDecoration: "none" }}
                        >
                            Criar conta
                        </Typography>
                    </Typography>
                </Stack>
                
            </Box>
            
        </Box>
        {/* ✅ Demo/Tour */}
            <Box
                sx={{
                    mb: 1.5,
                    p: 1.2,
                    borderRadius: 2.2,
                    border: "1px solid",
                    borderColor: "divider",
                    background: "rgba(0,0,0,0.02)",
                    
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <TravelExploreRoundedIcon fontSize="small" />
                    <Typography sx={{ fontWeight: 950 }}>Quer ver como funciona?</Typography>
                </Stack>

                <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                    Entre no modo Tour com dados fictícios (não afeta sua conta).
                </Typography>

                <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleTour}
                    disabled={loading}
                    sx={{
                        fontWeight: 950,
                        py: 1.1,
                        borderRadius: 2.2,
                        textTransform: "none",
                    }}
                >
                    Acessar tour (demo)
                </Button>
            </Box>
            </>
    );
}
