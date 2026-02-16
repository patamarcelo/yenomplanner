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
} from "@mui/material";
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

// igual ao que você já usa na BillsPage (pode mover p/ utils depois)
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
        fontSize: size,
        lineHeight: 1,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

function CategoryDialog({ open, onClose, initial }) {
  const dispatch = useDispatch();
  const creating = useSelector(selectCategoriesCreating);
  const updating = useSelector(selectCategoriesUpdating);

  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name || "");
  const [icon, setIcon] = useState(initial?.icon || "");
  const [color, setColor] = useState(initial?.color || "");
  const [active, setActive] = useState(initial?.active !== false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const x = initial || {};
    setName(x.name || "");
    setIcon(x.icon || "");
    setColor(x.color || "");
    setActive(x.active !== false);
    setErr("");
  }, [open, initial]);

  function validate() {
    if (!String(name || "").trim()) return "Informe o nome da categoria.";
    if (String(color || "").length > 0 && String(color || "").length < 3) return "Cor inválida.";
    return "";
  }

  async function handleSave() {
    setErr("");
    const e = validate();
    if (e) return setErr(e);

    const payload = {
      name: String(name).trim(),
      icon: String(icon || "").trim() || null,
      color: String(color || "").trim() || null,
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
      <DialogTitle sx={{ fontWeight: 950 }}>
        {isEdit ? "Editar categoria" : "Nova categoria"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={1.2} sx={{ mt: 2 }}>
          {err ? <Alert severity="error">{err}</Alert> : null}

          <TextField sx={fieldSx} label="Nome *" value={name} onChange={(e) => setName(e.target.value)} fullWidth />

          <TextField
            sx={fieldSx}
            label="Ícone (opcional)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            fullWidth
            helperText='Pode ser "home" (Material Symbols) ou emoji "🏠".'
          />

          <TextField
            sx={fieldSx}
            label="Cor (opcional)"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            fullWidth
            placeholder="ex: #22c55e ou rgba(...)"
          />

          <TextField
            sx={fieldSx}
            select
            label="Ativa"
            value={active ? "1" : "0"}
            onChange={(e) => setActive(e.target.value === "1")}
            fullWidth
          >
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

  const pageSx = { maxWidth: 1120, mx: "auto", px: { xs: 2, md: 3 }, py: 2 };

  const DEFAULT_CATEGORIES = [
    { name: "Casa", icon: "home", color: "#22c55e" },
    { name: "Mercado", icon: "shopping_cart", color: "#f59e0b" },
    { name: "Assinaturas", icon: "subscriptions", color: "#a855f7" },
    { name: "Transporte", icon: "directions_car", color: "#06b6d4" },
    { name: "Saúde", icon: "favorite", color: "#ef4444" },
    { name: "Lazer", icon: "sports_esports", color: "#3b82f6" },
    { name: "Outros", icon: "more_horiz", color: "#64748b" },
  ];

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
      // cria uma por vez (mantém UX e respeita retry do slug no slice)
      for (const c of missing) {
        await dispatch(createCategoryThunk({ ...c, active: true })).unwrap();
      }

      Swal.fire({ title: "Pronto!", text: "Categorias padrão criadas.", icon: "success", timer: 1200, showConfirmButton: false });

      // opcional: recarrega do backend pra garantir sync
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
                  bgcolor: alpha(dot, 0.10),
                  flexShrink: 0,
                }}
              >
                {iconTxt ? <MsIcon name={iconTxt} size={18} /> : <Box sx={{ width: 10, height: 10, borderRadius: 6, bgcolor: dot }} />}
              </Box>

              <Box
                sx={{
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 0.1,           // 👈 praticamente colado
                  lineHeight: 1.05,   // 👈 reduz espaço interno
                }}
              >
                <Typography
                  noWrap
                  sx={{
                    fontWeight: 950,
                    lineHeight: 1.1,
                  }}
                >
                  {c.name}
                </Typography>

                <Typography
                  noWrap
                  sx={{
                    fontSize: 11,
                    color: "text.secondary",
                    opacity: 0.75,
                    lineHeight: 1,
                  }}
                >
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
          return (
            <Chip
              size="small"
              label={on ? "Ativa" : "Inativa"}
              variant={on ? "filled" : "outlined"}
              color={on ? "success" : "default"}
              sx={{ fontWeight: 900 }}
            />
          );
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
            <Stack
              direction="row"
              spacing={0.8}
              alignItems="center"
              justifyContent="center"
              sx={{ width: "100%" }}
            >
              <Tooltip title="Editar">
                <IconButton
                  size="small"
                  onClick={() => setEdit(c)}
                  sx={{ width: 36, height: 36, "& .MuiSvgIcon-root": { fontSize: 20 } }}
                >
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
      }

    ];
  }, [dispatch, deleting]);

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
            <Button
              variant="outlined"
              sx={{ fontWeight: 950 }}
              onClick={handleSeedDefaults}
            >
              Popular padrões
            </Button>

            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              sx={{ fontWeight: 950 }}
              onClick={() => setOpenNew(true)}
            >
              Nova categoria
            </Button>
          </Stack>

        </Stack>

        {status === "loading" ? (
          <SpinnerPage status={status} />
        ) : (
          <>
            {error ? <Alert severity="error">{String(error)}</Alert> : null}

            <Box sx={{ height: 560 }}>
              <DataGrid
                rows={rows || []}
                columns={columns}
                getRowId={(r) => r.id}
                disableRowSelectionOnClick
                density="standard"
                rowHeight={64}
                columnHeaderHeight={54}
                pageSizeOptions={[10, 20, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 20, page: 0 } },
                }}
                sx={{
                  borderRadius: 1,
                  "& .MuiDataGrid-columnHeaders": { fontWeight: 950 },
                  "& .MuiDataGrid-cell": { display: "flex", alignItems: "center" }, // ✅ vertical center geral
                }}
              />

            </Box>
          </>
        )}

        < CategorySuggestions />
        <CategoryDialog open={openNew} onClose={() => setOpenNew(false)} initial={null} />
        <CategoryDialog open={!!edit} onClose={() => setEdit(null)} initial={edit} />
      </Stack>
    </Box>
  );
}
