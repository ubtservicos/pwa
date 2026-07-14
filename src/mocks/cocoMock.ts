export interface PontoColeta {
  id: string;
  lat: number;
  lng: number;
  address: string;
  material: string;
  status: "aguardando" | "confirmado" | "coletado" | "recusado";
  createdAt: number;
  coletadoAt: number | null;
  caminhaoId?: string | null;
  fotoUrl?: string | null;
  horarioPrevisto?: string | null;
}

export interface CaminhaoCoco {
  id: string;
  plate: string;
  apelido: string;
  isOnline: boolean;
  location: { lat: number; lng: number };
  collectionsToday: number;
  totalCollections: number;
}

export const MOCK_COCO_CONFIG = {
  pixKey: "coco@pix.com.br",
  descricao: "Côco & Cia — Reciclagem em Ubatuba",
  missao:
    "A Côco & Cia recolhe materiais recicláveis nas praias e ruas de Ubatuba. Cada ponto informado ajuda a otimizar nossas rotas e reduzir o impacto ambiental da nossa cidade.",
};

export const MOCK_PONTOS: PontoColeta[] = [];

export const MOCK_CAMINHOES: CaminhaoCoco[] = [];
