import React from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    Container,
    Stack,
    Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import HeadsetMicRoundedIcon from "@mui/icons-material/HeadsetMicRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";

import { trackEvent } from "../utils/analytics";

const WHATSAPP_URL =
    "https://wa.me/555197090862?text=Olá! Preciso de ajuda com o YenomPlanner";

export default function SupportPage() {
    const navigate = useNavigate();

    function handleBack() {
        navigate("/cadastros");
    }

    function handleWhatsApp() {
        trackEvent("support_whatsapp_clicked", { location: "support_page" });
        window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
    }

    function handleEmail() {
        trackEvent("support_email_clicked", { location: "support_page" });
        window.location.href = "mailto:suporte@yenomplanner.com?subject=Suporte YenomPlanner";
    }

    return (
        <Container maxWidth="md" sx={{ py: 3 }}>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 950 }}>
                            Suporte
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Fale com a equipe pelos canais abaixo.
                        </Typography>
                    </Box>

                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackRoundedIcon />}
                        onClick={handleBack}
                    >
                        Voltar
                    </Button>
                </Stack>

                <Card sx={{ borderRadius: 2 }}>
                    <CardContent>
                        <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
                            <HeadsetMicRoundedIcon color="primary" />
                            <Typography fontWeight={900}>Atendimento</Typography>
                        </Stack>

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Escolha o melhor canal para dúvidas, problemas ou sugestões.
                        </Typography>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<WhatsAppIcon />}
                                onClick={handleWhatsApp}
                            >
                                Falar no WhatsApp
                            </Button>

                            <Button
                                variant="outlined"
                                startIcon={<MailOutlineRoundedIcon />}
                                onClick={handleEmail}
                            >
                                Enviar e-mail
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Container>
    );
}