export type AmbulanteModalidade = "delivery" | "local_fixo" | "both";

export interface AmbulanteSession {
  sessionId: string;
  prestadorId: string;
  nome: string;
  modalidade: AmbulanteModalidade;
  location: { lat: number; lng: number; address?: string };
  isOnline: boolean;
  produtos: string[] | Record<string, any>; // produto ids or firebase object
  rating: number;
  totalPedidos: number;
}

export const MOCK_SESSIONS: AmbulanteSession[] = [];

export const MOCK_FALLBACK_SESSIONS: AmbulanteSession[] = [
  {
    sessionId: "mock1", prestadorId: "mock1", nome: "Zé do Coco", modalidade: "delivery", isOnline: true,
    location: { lat: -23.435, lng: -45.080 },
    rating: 5, totalPedidos: 12,
    produtos: {
      "prod1": { nome: "Água de Coco", emoji: "🥥", preco: 8, disponivel: true, categoriaHint: "Bebida" },
      "prod2": { nome: "Refrigerante", emoji: "🥤", preco: 6, disponivel: true, categoriaHint: "Bebida" },
    }
  },
  {
    sessionId: "mock2", prestadorId: "mock2", nome: "Maria do Milho", modalidade: "local_fixo", isOnline: true,
    location: { lat: -23.430, lng: -45.088 },
    rating: 5, totalPedidos: 8,
    produtos: {
      "prod3": { nome: "Milho Cozido", emoji: "🌽", preco: 7, disponivel: true, categoriaHint: "Comida" },
      "prod4": { nome: "Pamonha", emoji: "🌽", preco: 10, disponivel: true, categoriaHint: "Comida" },
    }
  }
];

export const getCategoriaIcon = (produtos: string[] | Record<string, any>): { emoji: string; color: string } => {
  const prodKeys = Array.isArray(produtos) ? produtos : Object.keys(produtos || {});
  if (prodKeys.some((p) => ["caiaque", "sup", "bananboat"].includes(p))) return { emoji: "🏄", color: "#F5A623" };
  if (prodKeys.some((p) => ["oculos", "chapeu", "artesanato"].includes(p))) return { emoji: "🕶️", color: "#9B59B6" };
  if (prodKeys.some((p) => ["coco", "acai", "sorvete"].includes(p))) return { emoji: "🥥", color: "#2B6EE8" };
  return { emoji: "🍢", color: "#0DB87E" };
};
