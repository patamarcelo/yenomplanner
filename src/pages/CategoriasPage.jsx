// src/pages/CategoriasPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  useTheme,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { DataGrid } from "@mui/x-data-grid";
import { alpha } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";

import SpinnerPage from "../components/ui/Spinner";
import {
  fetchCategoriesThunk,
  createCategoryThunk,
  updateCategoryThunk,
  deleteCategoryThunk,
  selectCategories,
  selectCategoriesStatus,
  selectCategoriesError,
  selectCategoriesCreating,
  selectCategoriesUpdating,
  selectCategoriesDeleting,
} from "../store/categoriesSlice";
import CategorySuggestions from "../components/categories/CategorySuggestions";

// ✅ catálogo compatível com Google Fonts (Material Symbols Rounded)
import ICONS from "../data/materialSymbols.font.ptBR.json";

function MsIcon({ name, size = 18, color = "inherit" }) {
  if (!name) return null;

  const isEmojiLike = /[^\w_]/.test(String(name));
  if (isEmojiLike) {
    return <span style={{ fontSize: size, lineHeight: 1, color }}>{name}</span>;
  }

  return (
    <span
      className="material-symbols-rounded"
      style={{
        fontFamily: '"Material Symbols Rounded"',
        fontSize: size,
        lineHeight: 1,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontVariationSettings: '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24',
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

// ranking: começa-com (name/tags) > contém (name/tags) > tokens
function scoreOpt(q, opt) {
  const query = String(q || "").trim().toLowerCase();
  if (!query) return 0;

  const name = String(opt?.name || "").toLowerCase();
  const tags = (opt?.tags || []).map((t) => String(t).toLowerCase());

  if (name === query) return 1000;
  if (name.startsWith(query)) return 900;
  if (name.includes(query)) return 780;

  let pts = 0;
  for (const t of tags) {
    if (t === query) pts = Math.max(pts, 860);
    else if (t.startsWith(query)) pts = Math.max(pts, 740);
    else if (t.includes(query)) pts = Math.max(pts, 620);
  }

  const tokens = query.split(/\s+/).filter(Boolean);
  for (const tk of tokens) {
    if (name.startsWith(tk)) pts += 85;
    else if (name.includes(tk)) pts += 45;

    for (const t of tags) {
      if (t.startsWith(tk)) pts += 65;
      else if (t.includes(tk)) pts += 35;
    }
  }

  return pts;
}

function pickOptions(query, limit = 40) {
  const q = String(query || "").trim();
  const base = Array.isArray(ICONS) ? ICONS : [];

  if (!q) return base.slice(0, limit);

  return base
    .map((opt) => ({ opt, s: scoreOpt(q, opt) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.opt);
}

function CategoryDialog({ open, onClose, initial }) {
  const dispatch = useDispatch();
  const creating = useSelector(selectCategoriesCreating);
  const updating = useSelector(selectCategoriesUpdating);
  const theme = useTheme();

  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name || "");
  const [icon, setIcon] = useState(initial?.icon || "");
  const [color, setColor] = useState(initial?.color || "");
  const [active, setActive] = useState(initial?.active !== false);
  const [err, setErr] = useState("");

  const [iconQuery, setIconQuery] = useState("");
  const [iconOptions, setIconOptions] = useState(() => pickOptions("", 40));

  function normalizeColorForSave(input) {
    const s = String(input || "").trim();
    if (!s) return null;

    if (s.startsWith("#") || /^rgba?\(/i.test(s) || /^hsla?\(/i.test(s)) return s;

    const key = s.toLowerCase();
    const pal = theme?.palette?.[key];
    if (pal?.main) return pal.main;

    const NAMED = {
      blue: "#0000ff",
      red: "#ff0000",
      green: "#00ff00",
      yellow: "#ffff00",
      orange: "#ffa500",
      purple: "#800080",
      pink: "#ffc0cb",
      black: "#000000",
      white: "#ffffff",
      gray: "#808080",
      grey: "#808080",
      cyan: "#00ffff",
      magenta: "#ff00ff",
      teal: "#008080",
      lime: "#00ff00",
    };
    if (NAMED[key]) return NAMED[key];

    return null;
  }

  useEffect(() => {
    const x = initial || {};
    setName(x.name || "");
    setIcon(x.icon || "");
    setColor(x.color || "");
    setActive(x.active !== false);
    setErr("");

    const v = String(x.icon || "");
    setIconQuery(v);
    setIconOptions(pickOptions(v, 40));
  }, [open, initial]);

  useEffect(() => {
    const t = setTimeout(() => {
      setIconOptions(pickOptions(iconQuery, 40));
    }, 160);
    return () => clearTimeout(t);
  }, [iconQuery]);

  function validate() {
    if (!String(name || "").trim()) return "Informe o nome da categoria.";
    const c = String(color || "").trim();
    if (c && !normalizeColorForSave(c)) {
      return 'Cor inválida. Use "#rrggbb", "rgba(...)", ou nomes como "blue"/"primary".';
    }
    return "";
  }

  async function handleSave() {
    setErr("");
    const e = validate();
    if (e) return setErr(e);

    const colorNorm = normalizeColorForSave(color);

    const payload = {
      name: String(name).trim(),
      icon: String(icon || "").trim() || null,
      color: colorNorm,
      active: !!active,
    };

    try {
      if (isEdit) {
        await dispatch(updateCategoryThunk({ id: initial.id, patch: payload })).unwrap();
      } else {
        await dispatch(createCategoryThunk(payload)).unwrap();
      }
      onClose();
    } catch (x) {
      setErr(x?.detail || "Erro ao salvar.");
    }
  }

  const borderColor = "rgba(25,118,210,0.28)";
  const gradientAccent = "rgba(25,118,210,0.16)";
  const tintBg = "rgba(255,255,255,0.92)";

  const fieldSx = {
    "& .MuiInputLabel-root": { color: "rgba(15,23,42,0.82)" },
    "& .MuiInputLabel-root.Mui-focused": { color: "rgba(15,23,42,0.92)" },
    "& .MuiOutlinedInput-root": { backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 2 },
    "& .MuiFormHelperText-root": { color: "rgba(15,23,42,0.62)" },
  };

  const saving = creating || updating;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          color: "rgba(15,23,42,0.98)",
          borderRadius: 2,
          border: `1.5px solid ${borderColor}`,
          background: `linear-gradient(-180deg, ${gradientAccent} 10%, ${tintBg} 36px, rgba(255,255,255,0.98) 84%)`,
          boxShadow: "0 14px 40px rgba(2,6,23,0.10)",
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 950,
          color: "whitesmoke",
          p: 2,
          // bgcolor: "blue",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          "& .MuiTypography-root": { fontWeight: 950, lineHeight: 1.15, p:2 },
        }}

      >{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>

      <DialogContent>
        <Stack spacing={1.2} sx={{ mt: 2 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          <TextField sx={fieldSx} label="Nome *" value={name} onChange={(e) => setName(e.target.value)} fullWidth />

          <Autocomplete
            freeSolo
            options={iconOptions}
            value={icon || ""}
            inputValue={iconQuery}
            onInputChange={(e, v) => {
              setIconQuery(v);
              setIcon(v);
            }}
            onChange={(e, val) => {
              const v = typeof val === "string" ? val : val?.name || "";
              setIcon(v);
              setIconQuery(v);
            }}
            getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt?.name || "")}
            filterOptions={(x) => x} // já filtramos (top 40)
            ListboxProps={{ style: { maxHeight: 420 } }}
            renderOption={(props, opt) => {
              const o = typeof opt === "string" ? { name: opt, tags: [] } : opt;
              return (
                <Box component="li" {...props} sx={{ display: "flex", alignItems: "center", gap: 1.1, py: 0.9 }}>
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                      flexShrink: 0,
                    }}
                  >
                    <MsIcon name={o.name} size={18} />
                  </Box>

                  <Stack spacing={0.15} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
                      {o.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1 }} noWrap>
                      {(o.tags || []).slice(0, 6).join(" • ")}
                    </Typography>
                  </Stack>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                sx={fieldSx}
                label="Ícone (Material Symbols)"
                placeholder='Ex: "casa", "mercado", "carro", "cartão"...'
                helperText='Busca por nome e sinônimos PT/EN. Também aceita emoji (🏠).'
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <Box sx={{ display: "inline-flex", alignItems: "center", mr: 1 }}>
                        {String(icon || "").trim() ? <MsIcon name={String(icon).trim()} size={18} /> : null}
                      </Box>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <TextField
            sx={fieldSx}
            label="Cor (opcional)"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            fullWidth
            placeholder="ex: #22c55e ou rgba(...)"
          />

          <TextField sx={fieldSx} select label="Ativa" value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")} fullWidth>
            <option value="1">Sim</option>
            <option value="0">Não</option>
          </TextField>

          {isEdit ? (
            <Alert severity="info">
              O <b>slug</b> não será alterado (Bills usam slug como categoryId).
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving} sx={{ fontWeight: 950, minWidth: 140 }}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CategoriasPage() {
  const dispatch = useDispatch();
  const rows = useSelector(selectCategories);
  const status = useSelector(selectCategoriesStatus);
  const error = useSelector(selectCategoriesError);
  const deleting = useSelector(selectCategoriesDeleting);

  const [openNew, setOpenNew] = useState(false);
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    dispatch(fetchCategoriesThunk());
  }, [dispatch]);

  const pageSx = {
    maxWidth: 1120,
    mx: "auto",
    px: { xs: 2, md: 3 },
    py: 2,
  };

  const DEFAULT_CATEGORIES = [
    { name: "Casa", icon: "home", color: "#22c55e" },
    { name: "Mercado", icon: "shopping_cart", color: "#f59e0b" },
    { name: "Assinaturas", icon: "subscriptions", color: "#a855f7" },
    { name: "Transporte", icon: "directions_car", color: "#06b6d4" },
    { name: "Saúde", icon: "favorite", color: "#ef4444" },
    { name: "Lazer", icon: "sports_esports", color: "#3b82f6" },
    { name: "Outros", icon: "more_horiz", color: "#64748b" },
  ];

  const existingNames = useMemo(() => {
    return new Set((rows || []).map((c) => normName(c.name)));
  }, [rows]);

  const hasMissingDefaults = useMemo(() => {
    return DEFAULT_CATEGORIES.some((c) => !existingNames.has(normName(c.name)));
  }, [existingNames]);

  function normName(s) {
    return String(s || "").trim().toLowerCase();
  }

  async function handleSeedDefaults() {
    const existing = new Set((rows || []).map((c) => normName(c.name)));
    const missing = DEFAULT_CATEGORIES.filter((c) => !existing.has(normName(c.name)));

    if (missing.length === 0) {
      Swal.fire({ title: "Já existe", text: "As categorias padrão já estão cadastradas.", icon: "info" });
      return;
    }

    const res = await Swal.fire({
      title: "Popular categorias padrão?",
      html: `Serão criadas <b>${missing.length}</b> categorias (as que ainda não existem).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Criar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });

    if (!res.isConfirmed) return;

    try {
      for (const c of missing) {
        await dispatch(createCategoryThunk({ ...c, active: true })).unwrap();
      }
      Swal.fire({ title: "Pronto!", text: "Categorias padrão criadas.", icon: "success", timer: 1200, showConfirmButton: false });
      dispatch(fetchCategoriesThunk());
    } catch (e) {
      Swal.fire({ title: "Erro", text: e?.detail || "Falha ao criar categorias.", icon: "error" });
    }
  }

  const columns = useMemo(() => {
    return [
      {
        field: "name",
        headerName: "Categoria",
        flex: 1,
        minWidth: 220,
        renderCell: (params) => {
          const c = params.row;
          const dot = c.color || "rgba(2,6,23,0.22)";
          const iconTxt = String(c.icon || "").trim();

          return (
            <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, width: "100%" }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  border: `1px solid ${alpha(dot, 0.45)}`,
                  bgcolor: alpha(dot, 0.1),
                  flexShrink: 0,
                }}
              >
                {iconTxt ? <MsIcon name={iconTxt} size={18} /> : <Box sx={{ width: 10, height: 10, borderRadius: 6, bgcolor: dot }} />}
              </Box>

              <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.1 }}>
                <Typography noWrap sx={{ fontWeight: 950, lineHeight: 1.1 }}>
                  {c.name}
                </Typography>
                <Typography noWrap sx={{ fontSize: 11, color: "text.secondary", opacity: 0.75, lineHeight: 1 }}>
                  slug: {c.slug}
                </Typography>
              </Box>
            </Stack>
          );
        },
      },
      {
        field: "active",
        headerName: "Status",
        width: 130,
        renderCell: (params) => {
          const on = params.value !== false;
          return <Chip size="small" label={on ? "Ativa" : "Inativa"} variant={on ? "filled" : "outlined"} color={on ? "success" : "default"} sx={{ fontWeight: 900 }} />;
        },
      },
      {
        field: "actions",
        headerName: "",
        width: 150,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: (params) => {
          const c = params.row;

          return (
            <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="center" sx={{ width: "100%" }}>
              <Tooltip title="Editar">
                <IconButton size="small" onClick={() => setEdit(c)} sx={{ width: 36, height: 36, "& .MuiSvgIcon-root": { fontSize: 20 } }}>
                  <EditRoundedIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Remover">
                <span>
                  <IconButton
                    size="small"
                    disabled={deleting}
                    onClick={async () => {
                      const res = await Swal.fire({
                        title: "Excluir categoria?",
                        html: `<b>${c.name}</b><br/>Isso remove do cadastro.`,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Excluir",
                        cancelButtonText: "Cancelar",
                        confirmButtonColor: "#d33",
                        reverseButtons: true,
                      });
                      if (!res.isConfirmed) return;

                      try {
                        await dispatch(deleteCategoryThunk(c.id)).unwrap();
                        Swal.fire({ title: "Pronto!", icon: "success", timer: 1100, showConfirmButton: false });
                      } catch (e) {
                        Swal.fire({ title: "Erro", text: e?.detail || "Não foi possível excluir.", icon: "error" });
                      }
                    }}
                    sx={{ width: 36, height: 36, "& .MuiSvgIcon-root": { fontSize: 20 } }}
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ];
  }, [dispatch, deleting]);

  // ✅ altura de página (sem “grid baixinho”)
  const gridHeight = "calc(100vh - 220px)";

  return (
    <Box sx={pageSx}>
      <Stack spacing={1.2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 950 }}>
              Categorias
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Total: <b>{(rows || []).length}</b>
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            {hasMissingDefaults ? (
              <Button variant="outlined" sx={{ fontWeight: 950 }} onClick={handleSeedDefaults}>
                Popular padrões
              </Button>
            ) : null}

            <Button variant="contained" startIcon={<AddRoundedIcon />} sx={{ fontWeight: 950 }} onClick={() => setOpenNew(true)}>
              Nova categoria
            </Button>
          </Stack>
        </Stack>

        {status === "loading" ? (
          <SpinnerPage status={status} />
        ) : (
          <>
            {error ? <Alert severity="error">{String(error)}</Alert> : null}

            <Box sx={{ height: gridHeight, minHeight: 560 }}>
              <DataGrid
                rows={rows || []}
                columns={columns}
                getRowId={(r) => r.id}
                disableRowSelectionOnClick
                density="standard"
                rowHeight={64}
                columnHeaderHeight={54}
                pageSizeOptions={[10, 20, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
                sx={{
                  height: "100%",
                  borderRadius: 1,
                  "& .MuiDataGrid-columnHeaders": { fontWeight: 950 },
                  "& .MuiDataGrid-cell": { display: "flex", alignItems: "center" },
                }}
              />
            </Box>
          </>
        )}

        <CategorySuggestions />

        <CategoryDialog open={openNew} onClose={() => setOpenNew(false)} initial={null} />
        <CategoryDialog open={!!edit} onClose={() => setEdit(null)} initial={edit} />
      </Stack>
    </Box>
  );
}