export interface DiaristaMock {
  uid: string;
  nome: string;
  sexo: "feminino" | "masculino";
  valorPorM2: number;
  minimoM2: number;
  rating: number;
  totalServicos: number;
  bairro: string;
  location: { lat: number; lng: number };
  materiais: string[];
  disponibilidade: Record<"seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom", boolean>;
  horarios: string[];
}

export const MOCK_DIARISTAS: DiaristaMock[] = [];

export const MOCK_AGENDAMENTOS_PRESTADOR: any[] = [];

export const AVALIACOES_MOCK: any[] = [];
