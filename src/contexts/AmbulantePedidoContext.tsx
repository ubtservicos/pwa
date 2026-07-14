import { createContext, useContext, useState, type ReactNode } from "react";
import { findProduto } from "@/mocks/ambulantesProdutos";

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

const initial: AmbulantePedidoState = {
  sessionId: null,
  pedidoId: null,
  status: "idle",
  modalidade: null,
  itens: [],
  total: 0,
  prestadorInfo: null,
  paymentMethod: null,
  tomadorAddress: null,
};

interface Ctx {
  state: AmbulantePedidoState;
  setState: (patch: Partial<AmbulantePedidoState>) => void;
  setSession: (sessionId: string, prestadorInfo: AmbulantePedidoState["prestadorInfo"]) => void;
  addItem: (prodId: string, precoUnit: number, nome?: string, emoji?: string) => void;
  removeItem: (prodId: string) => void;
  setQty: (prodId: string, qty: number) => void;
  clearCart: () => void;
  resetPedido: () => void;
}

const C = createContext<Ctx | undefined>(undefined);

const recompute = (itens: CartItem[]): number =>
  +itens.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2);

export const AmbulantePedidoProvider = ({ children }: { children: ReactNode }) => {
  const [state, setRaw] = useState<AmbulantePedidoState>(initial);
  const setState = (patch: Partial<AmbulantePedidoState>) =>
    setRaw((p) => ({ ...p, ...patch }));

  const setSession: Ctx["setSession"] = (sessionId, prestadorInfo) =>
    setRaw((p) =>
      p.sessionId === sessionId
        ? { ...p, prestadorInfo }
        : { ...initial, sessionId, prestadorInfo }
    );

  const addItem: Ctx["addItem"] = (prodId, precoUnit, nome, emoji) => {
    const prod = findProduto(prodId);
    const finalNome = nome || prod?.nome || "Produto";
    const finalEmoji = emoji || prod?.emoji || "🛒";

    setRaw((p) => {
      const existing = p.itens.find((i) => i.prodId === prodId);
      let itens: CartItem[];
      if (existing) {
        itens = p.itens.map((i) =>
          i.prodId === prodId
            ? { ...i, qty: i.qty + 1, subtotal: +(i.precoUnit * (i.qty + 1)).toFixed(2) }
            : i
        );
      } else {
        itens = [
          ...p.itens,
          { prodId, nome: finalNome, emoji: finalEmoji, qty: 1, precoUnit, subtotal: +precoUnit.toFixed(2) },
        ];
      }
      return { ...p, itens, total: recompute(itens), status: "cart" };
    });
  };

  const removeItem: Ctx["removeItem"] = (prodId) =>
    setRaw((p) => {
      const itens = p.itens
        .map((i) => (i.prodId === prodId ? { ...i, qty: i.qty - 1, subtotal: +(i.precoUnit * (i.qty - 1)).toFixed(2) } : i))
        .filter((i) => i.qty > 0);
      return { ...p, itens, total: recompute(itens) };
    });

  const setQty: Ctx["setQty"] = (prodId, qty) =>
    setRaw((p) => {
      const itens =
        qty <= 0
          ? p.itens.filter((i) => i.prodId !== prodId)
          : p.itens.map((i) =>
              i.prodId === prodId ? { ...i, qty, subtotal: +(i.precoUnit * qty).toFixed(2) } : i
            );
      return { ...p, itens, total: recompute(itens) };
    });

  const clearCart = () => setRaw((p) => ({ ...p, itens: [], total: 0 }));
  const resetPedido = () => setRaw(initial);

  return (
    <C.Provider value={{ state, setState, setSession, addItem, removeItem, setQty, clearCart, resetPedido }}>
      {children}
    </C.Provider>
  );
};

export const useAmbulantePedido = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useAmbulantePedido must be inside AmbulantePedidoProvider");
  return ctx;
};
