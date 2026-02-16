import React, { useMemo, useState } from "react";
import { Box, Typography, Button, Stack, Chip, Card, CardContent, Alert } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { alpha } from "@mui/material/styles";

import {
    fetchCategoriesThunk,
    selectCategories,
    createCategoryThunk, // ✅ use o thunk
} from "../../store/categoriesSlice";

import { CATEGORY_SUGGESTIONS } from "../../data/categorySuggestions";

export default function CategorySuggestions() {
    const dispatch = useDispatch();
    const existing = useSelector(selectCategories);

    const [selected, setSelected] = useState([]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    const existingNames = useMemo(() => {
        return new Set((existing || []).map((c) => String(c?.name || "").toLowerCase()));
    }, [existing]);

    const suggestions = useMemo(() => {
        return (CATEGORY_SUGGESTIONS || []).filter(
            (s) => !existingNames.has(String(s?.name || "").toLowerCase())
        );
    }, [existingNames]);

    const toggle = (name) => {
        setSelected((prev) =>
            prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
        );
    };

    async function handleAdd() {
        setErr("");
        setSaving(true);

        try {
            const toCreate = suggestions.filter((s) => selected.includes(s.name));

            // ✅ cria uma por vez (mantém lógica de slug/retry do thunk)
            for (const cat of toCreate) {
                await dispatch(
                    createCategoryThunk({
                        name: cat.name,
                        icon: cat.icon || null,
                        color: cat.color || null,
                        active: true,
                    })
                ).unwrap();
            }

            setSelected([]);
            dispatch(fetchCategoriesThunk());
        } catch (e) {
            setErr(e?.detail || e?.message || "Não foi possível adicionar as categorias.");
        } finally {
            setSaving(false);
        }
    }

    if (!suggestions.length) return null;

    return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Stack spacing={2}>
                    <Typography sx={{ fontWeight: 950 }}>Sugestões de Categorias</Typography>

                    {err ? <Alert severity="error">{err}</Alert> : null}

                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {suggestions.map((s) => {
                            const isOn = selected.includes(s.name);
                            const c = s.color || "rgba(2,6,23,0.22)";

                            return (
                                <Chip
                                    key={s.name}
                                    label={s.name}
                                    onClick={() => toggle(s.name)}
                                    variant={isOn ? "filled" : "outlined"}
                                    sx={{
                                        fontWeight: 800,
                                        borderColor: c,
                                        backgroundColor: isOn ? c : alpha(c, 0.10),
                                        color: isOn ? "#fff" : "inherit",
                                    }}
                                />
                            );
                        })}
                    </Box>

                    <Button
                        variant="contained"
                        disabled={!selected.length || saving}
                        onClick={handleAdd}
                        sx={{ fontWeight: 900, alignSelf: "flex-start" }}
                    >
                        {saving ? "Adicionando..." : "Adicionar ao meu portfólio"}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
