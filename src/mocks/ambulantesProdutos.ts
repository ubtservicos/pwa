export type CategoriaHint = "Comida" | "Bebida" | "Esporte" | "Acessório";

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  emoji: string;
  categoriaHint: CategoriaHint;
  precoSugerido: number;
}

export const CATALOGO_PADRAO: Produto[] = [
  { id: "milho",      nome: "Milho",            descricao: "Milho cozido ou assado na brasa",     emoji: "🌽", categoriaHint: "Comida",    precoSugerido: 6 },
  { id: "churrasco",  nome: "Churrasco",        descricao: "Espeto de carne ou frango",           emoji: "🍢", categoriaHint: "Comida",    precoSugerido: 12 },
  { id: "acai",       nome: "Açaí",             descricao: "Copo de açaí com complementos",       emoji: "🫐", categoriaHint: "Comida",    precoSugerido: 15 },
  { id: "sorvete",    nome: "Sorvete",          descricao: "Picolé ou casquinha",                  emoji: "🍦", categoriaHint: "Comida",    precoSugerido: 5 },
  { id: "amendoim",   nome: "Amendoim",         descricao: "Pacote de amendoim torrado",           emoji: "🥜", categoriaHint: "Comida",    precoSugerido: 4 },
  { id: "artesanato", nome: "Artesanato",       descricao: "Peças artesanais locais",              emoji: "🧶", categoriaHint: "Acessório", precoSugerido: 25 },
  { id: "coco",       nome: "Côco Gelado",      descricao: "Côco verde gelado com canudo",         emoji: "🥥", categoriaHint: "Bebida",    precoSugerido: 8 },
  { id: "caiaque",    nome: "Caiaque",          descricao: "Aluguel de caiaque por hora",          emoji: "🚣", categoriaHint: "Esporte",   precoSugerido: 40 },
  { id: "sup",        nome: "Stand-up Paddle",  descricao: "Aluguel de SUP por hora",              emoji: "🏄", categoriaHint: "Esporte",   precoSugerido: 40 },
  { id: "bananboat",  nome: "Banana Boat",      descricao: "Passeio de banana boat",               emoji: "🚤", categoriaHint: "Esporte",   precoSugerido: 30 },
  { id: "oculos",     nome: "Óculos de Sol",    descricao: "Óculos polarizados",                   emoji: "🕶️", categoriaHint: "Acessório", precoSugerido: 35 },
  { id: "chapeu",     nome: "Chapéus/Bonés",    descricao: "Chapéus de palha, bonés e viseiras",   emoji: "🧢", categoriaHint: "Acessório", precoSugerido: 20 },
];

export const findProduto = (id: string): Produto | undefined =>
  CATALOGO_PADRAO.find((p) => p.id === id);
