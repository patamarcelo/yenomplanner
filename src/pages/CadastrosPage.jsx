import React from "react";
import {
    Box,
    Stack,
    Typography,
    Card,
    CardActionArea,
    Paper,
    useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import HeadsetMicRoundedIcon from "@mui/icons-material/HeadsetMicRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";

import { trackEvent } from "../utils/analytics";

export default function CadastrosPage() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));

    const cardSx = {
        width: { xs: "100%", sm: 240 },
        borderRadius: 1,
        overflow: "hidden",
        flexShrink: 0,
    };

    const actionSx = {
        height: "100%",
        "&:hover .cad-icon-wrap": {
            transform: isSmDown ? "none" : "translateY(-1px)",
        },
    };

    const contentSx = {
        p: { xs: 2, sm: 2.2 },
        spacing: 1,
        alignItems: "center",
        minHeight: { xs: 112, sm: 132 },
        textAlign: "center",
    };

    const iconWrapSx = {
        width: { xs: 46, sm: 52 },
        height: { xs: 46, sm: 52 },
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        bgcolor: (t) =>
            t.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
        border: (t) => `1px solid ${t.palette.divider}`,
        transition: "transform 0.18s ease",
        mb: 0.25,
    };

    const iconSx = {
        fontSize: { xs: 24, sm: 26 },
    };

    return (
        <Box>
            <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                flexWrap="wrap"
            >
                <Card sx={cardSx} elevation={isSmDown ? 2 : 8} component={Paper}>
                    <CardActionArea
                        sx={actionSx}
                        onClick={() => {
                            trackEvent("open_user_page", { location: "cadastros" });
                            navigate("/cadastros/usuario");
                        }}
                    >
                        <Stack sx={contentSx}>
                            <Box className="cad-icon-wrap" sx={iconWrapSx}>
                                <AccountCircleRoundedIcon sx={iconSx} />
                            </Box>

                            <Typography fontWeight={800}>Usuário</Typography>

                            <Typography
                                variant="body2"
                                sx={{ opacity: 0.75, px: 1, lineHeight: 1.35 }}
                            >
                                Conta e sessão
                            </Typography>
                        </Stack>
                    </CardActionArea>
                </Card>

                <Card sx={cardSx} elevation={isSmDown ? 2 : 8} component={Paper}>
                    <CardActionArea
                        sx={actionSx}
                        onClick={() => navigate("/cadastros/categorias")}
                    >
                        <Stack sx={contentSx}>
                            <Box className="cad-icon-wrap" sx={iconWrapSx}>
                                <CategoryRoundedIcon sx={iconSx} />
                            </Box>

                            <Typography fontWeight={800}>Categorias</Typography>

                            <Typography
                                variant="body2"
                                sx={{ opacity: 0.75, px: 1, lineHeight: 1.35 }}
                            >
                                Gerencie cores e ícones
                            </Typography>
                        </Stack>
                    </CardActionArea>
                </Card>

                <Card sx={cardSx} elevation={isSmDown ? 2 : 8} component={Paper}>
                    <CardActionArea
                        sx={actionSx}
                        onClick={() => {
                            trackEvent("open_support_page", { location: "cadastros" });
                            navigate("/cadastros/suporte");
                        }}
                    >
                        <Stack sx={contentSx}>
                            <Box className="cad-icon-wrap" sx={iconWrapSx}>
                                <HeadsetMicRoundedIcon sx={iconSx} />
                            </Box>

                            <Typography fontWeight={800}>Suporte</Typography>

                            <Typography
                                variant="body2"
                                sx={{ opacity: 0.75, px: 1, lineHeight: 1.35 }}
                            >
                                Atendimento e contato
                            </Typography>
                        </Stack>
                    </CardActionArea>
                </Card>
            </Stack>
        </Box>
    );
}