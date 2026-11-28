import { createContext, useContext, useState, type ReactNode } from "react";
import { findProduto } from "@/mocks/ambulantesProdutos";

export interface CartItem {
  prodId: string;
  nome: string;
  emoji: string;
  qty: number;
  precoUnit: number;
  subtotal: number;
  maxStock?: number;
}

export type AmbulantePedidoStatus =
  | "idle"
  | "cart"
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "completed"
  | "paid"
  | "cancelled"
  | "rating";

export interface AmbulantePrestadorSnapshot {
  prestador_id: string;
  nome_comercial: string;
  delivery_fee: number;
  praia_referencia?: string | null;
  ponto_referencia?: string | null;
  tipo_estrutura?: string | null;
  estrutura_photo_url?: string | null;
  possui_alvara?: boolean;
  possui_vigilancia_sanitaria?: boolean;
  modalidades?: string[];
  lat?: number | null;
  lng?: number | null;
}

export interface AmbulantePrestadorInfo {
  prestadorId?: string;
  nome: string;
  emoji: string;
  rating: number;
  deliveryFee?: number;
  modalidades?: string[];
  praiaReferencia?: string | null;
  pontoReferencia?: string | null;
  tipoEstrutura?: string | null;
  estruturaPhotoUrl?: string | null;
  possuiAlvara?: boolean;
  possuiVigilanciaSanitaria?: boolean;
  lat?: number | null;
  lng?: number | null;
}

export interface AmbulantePedidoState {
  sessionId: string | null;
  prestadorId: string | null;
  pedidoId: string | null;
  status: AmbulantePedidoStatus;
  modalidade: "entrega" | "retirada" | "delivery" | "local_fixo" | null;
  itens: CartItem[];
  total: number;
  deliveryFee: number;
  prestadorInfo: AmbulantePrestadorInfo | null;
  prestadorSnapshot: AmbulantePrestadorSnapshot | null;
  paymentMethod: "pix" | "card" | null;
  tomadorAddress: string | null;
}

const initial: AmbulantePedidoState = {
  sessionId: null,
  prestadorId: null,
  pedidoId: null,
  status: "idle",
  modalidade: null,
  itens: [],
  total: 0,
  deliveryFee: 0,
  prestadorInfo: null,
  prestadorSnapshot: null,
  paymentMethod: null,
  tomadorAddress: null,
};

interface Ctx {
  state: AmbulantePedidoState;
  setState: (patch: Partial<AmbulantePedidoState>) => void;
  setSession: (sessionId: string, prestadorInfo: AmbulantePrestadorInfo | null) => void;
  addItem: (
    prodId: string,
    precoUnit: number,
    nome?: string,
    emoji?: string,
    maxStock?: number,
  ) => void;
  removeItem: (prodId: string) => void;
  setQty: (prodId: string, qty: number) => void;
  clearCart: () => void;
  resetPedido: () => void;
}

const C = createContext<Ctx | undefined>(undefined);

const recompute = (itens: CartItem[]): number =>
  +itens.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2);

function buildSnapshot(
  sessionId: string,
  info: AmbulantePrestadorInfo | null,
): AmbulantePrestadorSnapshot | null {
  if (!info) return null;
  const normalizedFee = Math.max(0, Number(info.deliveryFee ?? 0) || 0);
  return {
    prestador_id: info.prestadorId || sessionId,
    nome_comercial: info.nome,
    delivery_fee: normalizedFee,
    praia_referencia: info.praiaReferencia ?? null,
    ponto_referencia: info.pontoReferencia ?? null,
    tipo_estrutura: info.tipoEstrutura ?? null,
    estrutura_photo_url: info.estruturaPhotoUrl ?? null,
    possui_alvara: Boolean(info.possuiAlvara),
    possui_vigilancia_sanitaria: Boolean(info.possuiVigilanciaSanitaria),
    modalidades: info.modalidades ?? ["entrega", "retirada"],
    lat: info.lat ?? null,
    lng: info.lng ?? null,
  };
}

export const AmbulantePedidoProvider = ({ children }: { children: ReactNode }) => {
  const [state, setRaw] = useState<AmbulantePedidoState>(initial);
  const setState = (patch: Partial<AmbulantePedidoState>) =>
    setRaw((p) => ({ ...p, ...patch }));

  const setSession: Ctx["setSession"] = (sessionId, prestadorInfo) => {
    const resolvedPrestadorId = prestadorInfo?.prestadorId || sessionId;
    const normalizedFee = Math.max(0, Number(prestadorInfo?.deliveryFee ?? 0) || 0);
    const snapshot = buildSnapshot(sessionId, prestadorInfo);

    setRaw((p) =>
      p.sessionId === sessionId
        ? {
            ...p,
            prestadorId: resolvedPrestadorId,
            deliveryFee: normalizedFee,
            prestadorInfo,
            prestadorSnapshot: snapshot,
          }
        : {
            ...initial,
            sessionId,
            prestadorId: resolvedPrestadorId,
            deliveryFee: normalizedFee,
            prestadorInfo,
            prestadorSnapshot: snapshot,
          },
    );
  };

  const addItem: Ctx["addItem"] = (prodId, precoUnit, nome, emoji, maxStock) => {
    const prod = findProduto(prodId);
    const finalNome = nome || prod?.nome || "Produto";
    const finalEmoji = emoji || prod?.emoji || "🛒";

    setRaw((p) => {
      const existing = p.itens.find((i) => i.prodId === prodId);
      const stockCap = maxStock ?? existing?.maxStock;

      if (stockCap !== undefined && stockCap <= 0) {
        return p;
      }

      let itens: CartItem[];
      if (existing) {
        const nextQty = stockCap !== undefined ? Math.min(existing.qty + 1, stockCap) : existing.qty + 1;
        if (nextQty === existing.qty) return p;
        itens = p.itens.map((i) =>
          i.prodId === prodId
            ? {
                ...i,
                qty: nextQty,
                maxStock: stockCap,
                subtotal: +(i.precoUnit * nextQty).toFixed(2),
              }
            : i,
        );
      } else {
        itens = [
          ...p.itens,
          {
            prodId,
            nome: finalNome,
            emoji: finalEmoji,
            qty: 1,
            precoUnit,
            subtotal: +precoUnit.toFixed(2),
            maxStock: stockCap,
          },
        ];
      }
      return { ...p, itens, total: recompute(itens), status: "cart" };
    });
  };

  const removeItem: Ctx["removeItem"] = (prodId) =>
    setRaw((p) => {
      const itens = p.itens
        .map((i) =>
          i.prodId === prodId
            ? { ...i, qty: i.qty - 1, subtotal: +(i.precoUnit * (i.qty - 1)).toFixed(2) }
            : i,
        )
        .filter((i) => i.qty > 0);
      return { ...p, itens, total: recompute(itens) };
    });

  const setQty: Ctx["setQty"] = (prodId, qty) =>
    setRaw((p) => {
      const itens =
        qty <= 0
          ? p.itens.filter((i) => i.prodId !== prodId)
          : p.itens.map((i) => {
              if (i.prodId !== prodId) return i;
              const clamped = i.maxStock !== undefined ? Math.min(qty, i.maxStock) : qty;
              return { ...i, qty: clamped, subtotal: +(i.precoUnit * clamped).toFixed(2) };
            });
      return { ...p, itens, total: recompute(itens) };
    });

  const clearCart = () => setRaw((p) => ({ ...p, itens: [], total: 0 }));
  const resetPedido = () => setRaw(initial);

  return (
    <C.Provider
      value={{ state, setState, setSession, addItem, removeItem, setQty, clearCart, resetPedido }}
    >
      {children}
    </C.Provider>
  );
};

export const useAmbulantePedido = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useAmbulantePedido must be inside AmbulantePedidoProvider");
  return ctx;
};
