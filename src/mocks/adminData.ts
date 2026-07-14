export type AdminUser = {
  id: string;
  name: string;
  role: "tomador" | "prestador";
  email: string;
  phone: string;
  createdAt: string;
  kycStatus?: "approved" | "pending" | "rejected";
  categories?: string[];
  plate?: string;
  rating?: number | null;
  totalRides?: number;
  pagos?: number;
  recebidos?: number;
  birthMonth?: number;
  ticketsTrabalhador?: number;
  ticketsConsumidor?: number;
  contribComunidade?: number;
  donations?: { entity: string; amount: number }[];
};

export const MOCK_USERS: AdminUser[] = [];

export type AdminTicket = {
  id: string;
  status: "open" | "closed";
  type: string;
  tomador: string;
  prestador: string;
  date: string;
  value: number;
  description: string;
};

export const MOCK_TICKETS: AdminTicket[] = [
  {
    id: "1001",
    status: "open",
    type: "Corrida - Mototaxi",
    tomador: "Felipe Silva",
    prestador: "Maria do Milho",
    date: "2026-06-15",
    value: 25.00,
    description: "O passageiro alega que o motorista errou o caminho de propósito e o deixou longe do destino programado, exigindo reembolso do valor total da corrida.",
  },
  {
    id: "1002",
    status: "open",
    type: "Limpeza - Diarista",
    tomador: "Juliana Costa",
    prestador: "João Souza",
    date: "2026-06-16",
    value: 150.00,
    description: "O prestador não compareceu no horário combinado e não atendeu as ligações. A tomadora solicita o reembolso integral do adiantamento.",
  },
  {
    id: "1003",
    status: "closed",
    type: "Reciclagem - Côco & Cia",
    tomador: "Roberto Alves",
    prestador: "Zé do Coco",
    date: "2026-06-14",
    value: 50.00,
    description: "O descarte reciclável foi marcado como coletado, mas o cliente alega que o material continuava na calçada. Resolvido amigavelmente via chat.",
  },
];

export type AdminEntidade = {
  id: string;
  name: string;
  sigla: string;
  categoria: string;
  membros: number;
  pixKey: string;
  ativa: boolean;
};

export const MOCK_ENTIDADES: AdminEntidade[] = [];

export const MOCK_TRUCKS: any[] = [];

export const MOCK_COLLECTION_POINTS: any[] = [];
