export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          nome: string | null;
          role: string | null;
          cpf: string | null;
          telefone: string | null;
          chave_pix: string | null;
          padrinho_id: string | null;
          status: string | null;
          created_at: string | null;
          bairro_moradia: string | null;
          bairro_trabalho: string | null;
          praias_frequenta: string[] | null;
          praias_atende: string[] | null;
          cnpj: string | null;
        };
        Insert: {
          id: string;
          nome?: string | null;
          role?: string | null;
          cpf?: string | null;
          telefone?: string | null;
          chave_pix?: string | null;
          padrinho_id?: string | null;
          status?: string | null;
          created_at?: string | null;
          bairro_moradia?: string | null;
          bairro_trabalho?: string | null;
          praias_frequenta?: string[] | null;
          praias_atende?: string[] | null;
          cnpj?: string | null;
        };
        Update: {
          id?: string;
          nome?: string | null;
          role?: string | null;
          cpf?: string | null;
          telefone?: string | null;
          chave_pix?: string | null;
          padrinho_id?: string | null;
          status?: string | null;
          created_at?: string | null;
          bairro_moradia?: string | null;
          bairro_trabalho?: string | null;
          praias_frequenta?: string[] | null;
          praias_atende?: string[] | null;
          cnpj?: string | null;
        };
      };
      user_consents: {
        Row: {
          id: string;
          user_id: string;
          document_type: string;
          document_version: string;
          accepted: boolean;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_type: string;
          document_version: string;
          accepted?: boolean;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          document_type?: string;
          document_version?: string;
          accepted?: boolean;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      associacao_documentos: {
        Row: {
          id: string;
          associacao_id: string;
          tipo_documento: string;
          status: 'pendente' | 'aprovado' | 'vencido' | 'rejeitado';
          data_validade: string | null;
          url_arquivo: string | null;
          justificativa_rejeicao: string | null;
        };
        Insert: {
          id?: string;
          associacao_id: string;
          tipo_documento: string;
          status?: 'pendente' | 'aprovado' | 'vencido' | 'rejeitado';
          data_validade?: string | null;
          url_arquivo?: string | null;
          justificativa_rejeicao?: string | null;
        };
        Update: {
          id?: string;
          associacao_id?: string;
          tipo_documento?: string;
          status?: 'pendente' | 'aprovado' | 'vencido' | 'rejeitado';
          data_validade?: string | null;
          url_arquivo?: string | null;
          justificativa_rejeicao?: string | null;
        };
      };
    };
  };
}

export type RealUserRole = "tomador" | "prestador" | "admin" | "cocoecia" | "cocoecia-colaborador" | "cocoecia-dirigentes" | "associacao";

export interface RealUser {
  uid: string;
  name: string;
  email?: string;
  role: RealUserRole;
  plate?: string;
  modalidade?: "carona_entrega" | "so_entrega" | "so_carona";
  cpf?: string;
  sexo?: "masculino" | "feminino" | string;
  kycStatus?: string;
  status?: string;
  mototaxiActive?: boolean;
  isLoading?: boolean;
}

export interface CartItem {
  prodId: string;
  nome: string;
  emoji: string;
  qty: number;
  precoUnit: number;
  subtotal: number;
}

export type AmbulantePedidoStatus =
  | "idle" | "cart" | "pending" | "confirmed"
  | "preparing" | "ready" | "completed" | "rating";

export interface AmbulantePedidoState {
  sessionId: string | null;
  pedidoId: string | null;
  status: AmbulantePedidoStatus;
  modalidade: "delivery" | "local_fixo" | null;
  itens: CartItem[];
  total: number;
  prestadorInfo: { nome: string; emoji: string; rating: number } | null;
  paymentMethod: "pix" | "card" | null;
  tomadorAddress: string | null;
}

export type RideStatus =
  | "idle"
  | "searching"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "rating";

export type RideType = "carona" | "entrega";

export interface LatLngAddr {
  lat: number;
  lng: number;
  address: string;
}

export interface PrestadorInfo {
  name: string;
  photo: string;
  plate: string;
  rating: number;
}

export interface RideMessage {
  text: string;
  from: "tomador" | "prestador";
  ts: number;
}

export interface RideState {
  status: RideStatus;
  rideId: string | null;
  type: RideType | null;
  origin: LatLngAddr | null;
  destination: LatLngAddr | null;
  estimatedPrice: number;
  finalPrice: number;
  distanceKm: number;
  durationMin: number;
  prestadorInfo: PrestadorInfo | null;
  prestadorLocation: { lat: number; lng: number } | null;
  acceptedAt: number | null;
  paymentMethod: "pix" | "card" | null;
  messages: RideMessage[];
}
