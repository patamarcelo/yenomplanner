export const categories = [
  { id: "casa", name: "Casa" },
  { id: "mercado", name: "Mercado" },
  { id: "assinaturas", name: "Assinaturas" },
  { id: "transporte", name: "Transporte" },
  { id: "lazer", name: "Lazer" },
  { id: "saude", name: "Saúde" },
  { id: "outros", name: "Outros" },
];

export function getCategoryById(id) {
  return categories.find((c) => c.id === id) || null;
}
