import React from "react";
import { Box, Stack, Typography, Card, CardActionArea } from "@mui/material";
import { useNavigate } from "react-router-dom";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";

export default function CadastrosPage() {
    const navigate = useNavigate();

    return (
        <Box>
        
            <Stack direction="row" spacing={2} flexWrap="wrap">
                <Card sx={{ width: 240, borderRadius: 3 }}>
                    <CardActionArea onClick={() => navigate("/cadastros/categorias")}>
                        <Stack p={2.2} spacing={1} alignItems="center">
                            <CategoryRoundedIcon />
                            <Typography fontWeight={800}>Categorias</Typography>
                            <Typography variant="body2" sx={{ opacity: 0.75 }}>
                                Gerencie cores e ícones
                            </Typography>
                        </Stack>
                    </CardActionArea>
                </Card>
            </Stack>
        </Box>
    );
}
