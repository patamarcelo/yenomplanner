import React from "react";
import { Box, Stack, Typography, Button, Paper } from "@mui/material";
import {
    isDynamicImportError,
    clearChunkReloadFlag,
} from "../utils/chunkErrorHandler";

const ChunkErrorScreen = ({ message }) => {
    const isChunkError = isDynamicImportError({ message });

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                px: 2,
                py: 3,
                backgroundColor: "background.default",
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    width: "100%",
                    maxWidth: 460,
                    p: 3,
                    borderRadius: 1.5,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    backgroundColor: "background.paper",
                }}
            >
                <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={700}>
                        {isChunkError
                            ? "O app foi atualizado"
                            : "Ocorreu um erro ao abrir o app"}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                        {isChunkError
                            ? "Detectamos uma versão antiga em cache. Recarregue a página para continuar."
                            : "Não foi possível carregar esta tela agora. Tente recarregar a página."}
                    </Typography>

                    <Stack direction="row" spacing={1.5}>
                        <Button
                            variant="contained"
                            onClick={() => {
                                clearChunkReloadFlag();
                                window.location.reload();
                            }}
                        >
                            Recarregar
                        </Button>

                        <Button
                            variant="outlined"
                            onClick={() => {
                                clearChunkReloadFlag();
                                window.location.href = "/";
                            }}
                        >
                            Ir para início
                        </Button>
                    </Stack>

                    {!!message && (
                        <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ wordBreak: "break-word", pt: 1 }}
                        >
                            {message}
                        </Typography>
                    )}
                </Stack>
            </Paper>
        </Box>
    );
};

export default ChunkErrorScreen;