export interface MaterialCoco {
  id: string;
  nome: string;
  emoji: string;
  cor: string;
}

export const MATERIAIS_COCO: MaterialCoco[] = [
  { id: "plastico", nome: "Plástico", emoji: "♻️", cor: "#2B6EE8" },
  { id: "vidro", nome: "Vidro", emoji: "🫙", cor: "#9B59B6" },
  { id: "organico", nome: "Orgânico", emoji: "🌱", cor: "#0DB87E" },
  { id: "metal", nome: "Metal/Lata", emoji: "🥫", cor: "#9399AD" },
  { id: "papel", nome: "Papel/Papelão", emoji: "📦", cor: "#F5A623" },
  { id: "misto", nome: "Misto", emoji: "🗑️", cor: "#5B6178" },
  { id: "eletronico", nome: "Eletrônico", emoji: "📱", cor: "#E84040" },
];

export const getMaterial = (id: string): MaterialCoco =>
  MATERIAIS_COCO.find((m) => m.id === id) ?? MATERIAIS_COCO[5];
