export interface Material {
  id: string;
  nome: string;
  emoji: string;
  custoAdicional: number;
}

export const MATERIAIS_PADRAO: Material[] = [
  { id: "vassoura", nome: "Vassoura/Rodo", emoji: "🧹", custoAdicional: 0 },
  { id: "luvas", nome: "Luvas", emoji: "🧤", custoAdicional: 0 },
  { id: "panos", nome: "Panos", emoji: "🪣", custoAdicional: 0 },
  { id: "produtos", nome: "Produtos de limpeza", emoji: "🧴", custoAdicional: 8.0 },
];

export interface MaterialDetalhado {
  id: string;
  nome: string;
  emoji: string;
  categoria: "quimicos" | "utensilios";
  precoMedio: number;
}

export const MATERIAIS_DETALHADOS: MaterialDetalhado[] = [
  // PRODUTOS QUÍMICOS
  { id: "detergente", nome: "Detergente Neutro (500ml)", emoji: "🧴", categoria: "quimicos", precoMedio: 2.65 },
  { id: "agua_sanitaria", nome: "Água Sanitária (1L)", emoji: "💧", categoria: "quimicos", precoMedio: 3.50 },
  { id: "desinfetante", nome: "Desinfetante (1L)", emoji: "🌸", categoria: "quimicos", precoMedio: 6.00 },
  { id: "multiuso", nome: "Limpador Multiuso (500ml)", emoji: "✨", categoria: "quimicos", precoMedio: 5.75 },
  { id: "desengordurante", nome: "Desengordurante (500ml)", emoji: "🧽", categoria: "quimicos", precoMedio: 10.50 },
  { id: "alcool", nome: "Álcool 70% (1L)", emoji: "⚕️", categoria: "quimicos", precoMedio: 7.50 },
  { id: "sabao_po", nome: "Sabão em Pó (1kg)", emoji: "🫧", categoria: "quimicos", precoMedio: 13.50 },
  { id: "limpa_vidros", nome: "Limpa-vidros (500ml)", emoji: "🪟", categoria: "quimicos", precoMedio: 8.00 },

  // UTENSÍLIOS
  { id: "pano_microfibra", nome: "Kit Pano Microfibra (3un)", emoji: "🧻", categoria: "utensilios", precoMedio: 12.50 },
  { id: "pano_chao", nome: "Pano de Chão Alvejado (1un)", emoji: "🧶", categoria: "utensilios", precoMedio: 4.75 },
  { id: "esponja", nome: "Esponja Dupla Face (Pct 4)", emoji: "🧽", categoria: "utensilios", precoMedio: 4.00 },
  { id: "vassoura", nome: "Vassoura com cabo", emoji: "🧹", categoria: "utensilios", precoMedio: 16.00 },
  { id: "rodo", nome: "Rodo com cabo", emoji: "🧹", categoria: "utensilios", precoMedio: 14.00 },
  { id: "pa_lixo", nome: "Pá de Lixo", emoji: "🗑️", categoria: "utensilios", precoMedio: 6.00 },
  { id: "balde", nome: "Balde Plástico 10L", emoji: "🪣", categoria: "utensilios", precoMedio: 11.00 },
  { id: "luvas", nome: "Luvas de Borracha (1 par)", emoji: "🧤", categoria: "utensilios", precoMedio: 7.00 },
  { id: "escova_sanitaria", nome: "Escova Sanitária", emoji: "🚽", categoria: "utensilios", precoMedio: 11.50 },
];
