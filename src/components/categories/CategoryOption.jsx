// src/components/categories/CategoryOption.jsx
import React from "react";
import { Box, Stack, Typography, Icon } from "@mui/material";

function pickLabel(c) {
    return c?.name ?? c?.label ?? c?.title ?? c?.slug ?? "Sem categoria";
}

function pickIcon(c) {
    return String(c?.icon ?? c?.emoji ?? c?.iconEmoji ?? c?.icon_emoji ?? "").trim();
}

function isUrl(v) {
    const s = String(v || "");
    return /^https?:\/\//i.test(s) || s.startsWith("data:");
}

function isEmojiLike(s) {
    // bem simples: se tem espaços é ligature, se é curto e não tem underscore pode ser emoji/texto
    // mas o teu caso (fitness_center) é ligature mesmo.
    return /[\u{1F300}-\u{1FAFF}]/u.test(s);
}

export default function CategoryOption({ category, dense = false }) {
    const c = category || {};
    const label = pickLabel(c);
    const icon = pickIcon(c);

    return (
        <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0, py: dense ? 0 : 0.2 }}
        >
            <Box
                sx={{
                    width: 26,
                    height: 22,
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                }}
            >
                {icon ? (
                    isUrl(icon) ? (
                        <Box
                            component="img"
                            src={icon}
                            alt=""
                            sx={{ width: 18, height: 18, borderRadius: 0.5, objectFit: "contain" }}
                        />
                    ) : isEmojiLike(icon) ? (
                        <Box component="span" sx={{ fontSize: 18, lineHeight: 1 }}>
                            {icon}
                        </Box>
                    ) : (
                        // ✅ Material Icons / Material Symbols (ligature)
                        <Icon
                            sx={{
                                fontSize: 20,
                                lineHeight: 1,
                                color: c?.color || "rgba(15,23,42,0.75)",
                            }}
                        >
                            {icon}
                        </Icon>
                    )
                ) : null}
            </Box>

            <Typography noWrap sx={{ fontWeight: 800, minWidth: 0 }}>
                {label}
            </Typography>
        </Stack>
    );
}