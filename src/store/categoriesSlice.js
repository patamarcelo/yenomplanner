// src/store/categoriesSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from "../api/categoriesApi";

// -------------------------
// Helpers
// -------------------------
function slugifyBR(input) {
    // slug simples e robusto: "Café & Pão" -> "cafe-pao"
    const s = String(input || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);

    return s || "categoria";
}

function tryGetDetail(err) {
    // tenta extrair mensagens do DRF
    const data = err?.response?.data;
    if (!data) return err?.message || "Erro.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    // field errors: { slug: ["..."] }
    const firstKey = Object.keys(data)[0];
    if (firstKey && Array.isArray(data[firstKey]) && data[firstKey][0]) return data[firstKey][0];
    return "Erro.";
}

function isSlugConflict(err) {
    const data = err?.response?.data;
    const msg = JSON.stringify(data || "").toLowerCase();
    // cobre unique constraint / duplicate key / already exists
    return msg.includes("slug") && (msg.includes("unique") || msg.includes("already") || msg.includes("duplicate"));
}

// cria com retries: slug, slug-2, slug-3...
async function createWithSlugRetry(payload, maxTries = 6) {
    const base = slugifyBR(payload?.name);
    for (let i = 0; i < maxTries; i++) {
        const slug = i === 0 ? base : `${base}-${i + 1}`;
        try {
            return await createCategory({ ...payload, slug });
        } catch (e) {
            if (isSlugConflict(e)) continue;
            throw e;
        }
    }
    // último tiro: timestamp curto
    const fallback = `${base}-${Date.now().toString().slice(-4)}`.slice(0, 50);
    return await createCategory({ ...payload, slug: fallback });
}

// -------------------------
// Thunks
// -------------------------
export const fetchCategoriesThunk = createAsyncThunk(
    "categories/fetchAll",
    async (_, { rejectWithValue }) => {
        try {
            return await listCategories(); // já vem mapeado (mapCategoryFromApi)
        } catch (e) {
            return rejectWithValue({ detail: tryGetDetail(e) });
        }
    }
);

export const createCategoryThunk = createAsyncThunk(
    "categories/create",
    async (payload, { rejectWithValue }) => {
        try {
            // payload esperado: { name, color, icon, active }
            // backend exige slug -> geramos aqui
            const data = await createWithSlugRetry(
                {
                    name: String(payload?.name || "").trim(),
                    color: payload?.color ?? null,
                    icon: payload?.icon ?? null,
                    active: payload?.active !== false,
                },
                6
            );

            // seu categoriesApi retorna data cru; vamos mapear no padrão do store:
            return {
                id: data.id,
                name: data.name || "",
                slug: data.slug || "",
                color: data.color || null,
                icon: data.icon || null,
                active: data.active !== false,
                createdAt: data.created_at || null,
            };
        } catch (e) {
            return rejectWithValue({ detail: tryGetDetail(e) });
        }
    }
);

export const updateCategoryThunk = createAsyncThunk(
    "categories/update",
    async ({ id, patch }, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const cur =
                (state.categories?.categories || []).find((c) => String(c.id) === String(id)) || null;

            // ⚠️ não alterar slug automaticamente (Bills usam slug como categoryId)
            // só manda campos editáveis
            const body = {
                name: patch?.name != null ? String(patch.name).trim() : cur?.name || "",
                color: patch?.color !== undefined ? patch.color : cur?.color ?? null,
                icon: patch?.icon !== undefined ? patch.icon : cur?.icon ?? null,
                active: patch?.active !== undefined ? patch.active : cur?.active !== false,
            };

            const data = await updateCategory(id, body);

            return {
                id: data.id,
                name: data.name || "",
                slug: data.slug || cur?.slug || "", // mantém
                color: data.color || null,
                icon: data.icon || null,
                active: data.active !== false,
                createdAt: data.created_at || cur?.createdAt || null,
            };
        } catch (e) {
            return rejectWithValue({ detail: tryGetDetail(e) });
        }
    }
);

export const deleteCategoryThunk = createAsyncThunk(
    "categories/delete",
    async (id, { rejectWithValue }) => {
        try {
            await deleteCategory(id);
            return id;
        } catch (e) {
            return rejectWithValue({ detail: tryGetDetail(e) });
        }
    }
);

// -------------------------
// Slice
// -------------------------
const initialState = {
    categories: [],
    status: "idle",
    error: "",

    creating: false,
    updating: false,
    deleting: false,
};

const categoriesSlice = createSlice({
    name: "categories",
    initialState,
    reducers: {
        resetCategories(state) {
            state.categories = [];
            state.status = "idle";
            state.error = "";
            state.creating = false;
            state.updating = false;
            state.deleting = false;
        },
        setCategoriesFromBootstrap(state, action) {
            state.categories = action.payload || [];
            state.status = "succeeded";
            state.error = "";
        },
    },
    extraReducers: (builder) => {
        builder
            // fetch
            .addCase(fetchCategoriesThunk.pending, (state) => {
                state.status = "loading";
                state.error = "";
            })
            .addCase(fetchCategoriesThunk.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.categories = action.payload || [];
            })
            .addCase(fetchCategoriesThunk.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.payload?.detail || action.error?.message || "Erro ao carregar categorias.";
            })

            // create
            .addCase(createCategoryThunk.pending, (state) => {
                state.creating = true;
                state.error = "";
            })
            .addCase(createCategoryThunk.fulfilled, (state, action) => {
                state.creating = false;
                const next = action.payload;
                if (!next) return;

                const exists = (state.categories || []).some((c) => String(c.id) === String(next.id));
                if (!exists) state.categories.push(next);

                state.categories.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
            })
            .addCase(createCategoryThunk.rejected, (state, action) => {
                state.creating = false;
                state.error = action.payload?.detail || action.error?.message || "Erro ao criar categoria.";
            })

            // update
            .addCase(updateCategoryThunk.pending, (state) => {
                state.updating = true;
                state.error = "";
            })
            .addCase(updateCategoryThunk.fulfilled, (state, action) => {
                state.updating = false;
                const next = action.payload;
                if (!next) return;

                const idx = (state.categories || []).findIndex((c) => String(c.id) === String(next.id));
                if (idx !== -1) state.categories[idx] = next;

                state.categories.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
            })
            .addCase(updateCategoryThunk.rejected, (state, action) => {
                state.updating = false;
                state.error = action.payload?.detail || action.error?.message || "Erro ao atualizar categoria.";
            })

            // delete
            .addCase(deleteCategoryThunk.pending, (state) => {
                state.deleting = true;
                state.error = "";
            })
            .addCase(deleteCategoryThunk.fulfilled, (state, action) => {
                state.deleting = false;
                const id = action.payload;
                state.categories = (state.categories || []).filter((c) => String(c.id) !== String(id));
            })
            .addCase(deleteCategoryThunk.rejected, (state, action) => {
                state.deleting = false;
                state.error = action.payload?.detail || action.error?.message || "Erro ao remover categoria.";
            });
    },
});

export const { resetCategories, setCategoriesFromBootstrap } = categoriesSlice.actions;

// selectors
export const selectCategoriesStatus = (s) => s.categories.status;
export const selectCategoriesError = (s) => s.categories.error;

export const selectCategoriesCreating = (s) => !!s.categories.creating;
export const selectCategoriesUpdating = (s) => !!s.categories.updating;
export const selectCategoriesDeleting = (s) => !!s.categories.deleting;

export const selectCategories = (state) => state.categories?.categories || [];

export const selectActiveCategories = (state) =>
    (state.categories?.categories || []).filter((c) => c.active !== false);

export const selectCategoryById = (id) => (s) =>
    (s.categories.categories || []).find((c) => String(c.id) === String(id)) || null;

export default categoriesSlice.reducer;
