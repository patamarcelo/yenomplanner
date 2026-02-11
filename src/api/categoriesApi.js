import http from "./http";


export async function createCategory(payload) {
  const { data } = await http.post("/yenomplanner/categories/", payload);
  return data;
}

export async function updateCategory(id, payload) {
  const { data } = await http.patch(`/yenomplanner/categories/${id}/`, payload);
  return data;
}

export async function deleteCategory(id) {
  await http.delete(`/yenomplanner/categories/${id}/`);
  return id;
}

export function mapCategoryFromApi(c) {
  if (!c) return null;
  return {
    id: c.id,                 // number
    name: c.name || "",
    slug: c.slug || "",
    color: c.color || null,
    icon: c.icon || null,
    active: c.active !== false,
    createdAt: c.created_at || null,
  };
}

export async function listCategories() {
  const { data } = await http.get("/yenomplanner/categories/");
  return (data || []).map(mapCategoryFromApi);
}