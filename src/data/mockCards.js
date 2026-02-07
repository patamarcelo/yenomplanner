export const cards = [
  { id: "nubank", name: "Nubank", tint: "rgba(128,0,128,0.16)" },
  { id: "xp", name: "XP", tint: "rgba(120,120,120,0.16)" },
  { id: "porto", name: "Porto", tint: "rgba(0,122,255,0.14)" },
];

export function getCardById(id) {
  return cards.find((c) => c.id === id) || null;
}
