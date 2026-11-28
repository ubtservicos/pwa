import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// Hoisted Supabase mocks
const mocks = vi.hoisted(() => {
  const rpc = vi.fn();
  const invoke = vi.fn();
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  const from = vi.fn();
  const channelOn = vi.fn();
  const channelSubscribe = vi.fn();
  const removeChannel = vi.fn();
  const storageFrom = vi.fn();

  return {
    rpc,
    invoke,
    upload,
    getPublicUrl,
    from,
    channelOn,
    channelSubscribe,
    removeChannel,
    storageFrom,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
    functions: { invoke: mocks.invoke },
    storage: { from: mocks.storageFrom },
    channel: vi.fn(() => {
      const ch: any = {
        on: (...args: any[]) => {
          mocks.channelOn(...args);
          return ch;
        },
        subscribe: () => {
          mocks.channelSubscribe();
          return ch;
        },
      };
      return ch;
    }),
    removeChannel: mocks.removeChannel,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    uid: "user-test-1",
    name: "Cliente Teste",
    email: "cliente@ubt.app",
    role: "tomador",
    kycStatus: "none",
    carroKycStatus: "none",
    ambulanteKycStatus: "none",
    ambulanteDeliveryFee: 0,
    isLoading: false,
  }),
}));

vi.mock("@/lib/geoService", () => ({
  reverseGeocode: vi.fn().mockResolvedValue("Praia do Tenório, Ubatuba - SP"),
}));

vi.mock("@/components/Payment/CheckoutUniversal", () => ({
  default: (props: any) => (
    <div
      data-testid="mock-checkout-universal"
      data-service-type={props.serviceType}
      data-service-id={props.serviceId}
      data-provider-id={props.providerId}
      data-amount={String(props.amount)}
    >
      CheckoutUniversal Mock ({props.serviceType})
    </div>
  ),
}));

import AmbulantesCategoriaAmbulantesPage from "@/pages/AmbulantesCategoriaAmbulantesPage";
import AmbulanteCarrinhoPage from "@/pages/AmbulanteCarrinhoPage";
import AmbulantePedidoPage from "@/pages/AmbulantePedidoPage";
import AmbulantesOnboardingPage from "@/pages/AmbulantesOnboardingPage";
import {
  AmbulantePedidoProvider,
  useAmbulantePedido,
} from "@/contexts/AmbulantePedidoContext";
import { paymentToTransaction, type PaymentHistoryRow } from "@/services/PaymentHistoryService";
import { isVerticalEnabled } from "@/config/verticalFlags";

// Chainable query builder helper for Supabase mocks
function buildChain(result: { data?: any; error?: any }) {
  const promise = Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    gt: () => chain,
    gte: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    single: () => promise,
    maybeSingle: () => promise,
    then: (resolve: any, reject: any) => promise.then(resolve, reject),
  };
  return chain;
}

describe("Ambulantes App Flow (Fase 2 — v1.10.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://storage.example/kyc-documents/${path}` },
    }));
    mocks.storageFrom.mockReturnValue({
      upload: mocks.upload,
      getPublicUrl: mocks.getPublicUrl,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. Descoberta filtra apenas ambulantes online + KYC aprovado + estoque > 0 e exibe selos de confiança e taxa individual", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "categorias_ambulante") {
        return buildChain({
          data: { id: "cat-1", nome: "Bebidas", slug: "bebidas", emoji: "🥥" },
        });
      }
      if (table === "ambulante_sessions") {
        return buildChain({
          data: [
            {
              id: "amb-approved-1",
              is_online: true,
              categoria_slug: "bebidas",
              modalidades: ["entrega", "retirada"],
              lat: -23.4526,
              lng: -45.0631,
              delivery_fee: 4.5,
              praia_referencia: "Praia do Tenório",
              ponto_referencia: "Posto 2",
              usuarios: { nome: "João da Praia" },
            },
            {
              id: "amb-approved-free",
              is_online: true,
              categoria_slug: "bebidas",
              modalidades: ["entrega", "retirada"],
              lat: -23.453,
              lng: -45.064,
              delivery_fee: 0,
              praia_referencia: "Itaguá",
              ponto_referencia: null,
              usuarios: { nome: "Maria Coco" },
            },
            {
              id: "amb-unapproved",
              is_online: true,
              categoria_slug: "bebidas",
              modalidades: ["entrega"],
              lat: -23.4526,
              lng: -45.0631,
              delivery_fee: 2,
              usuarios: { nome: "Sem KYC" },
            },
          ],
        });
      }
      if (table === "prestador_ambulante") {
        return buildChain({
          data: [
            {
              user_id: "amb-approved-1",
              nome_comercial: "Barraca do João",
              delivery_fee: 4.5,
              modalidades: ["entrega", "retirada"],
              praia_referencia: "Praia do Tenório",
              ponto_referencia: "Posto 2",
              tipo_estrutura: "barraca",
              estrutura_photo_url: null,
              possui_alvara: true,
              possui_vigilancia_sanitaria: true,
              kyc_status: "approved",
            },
            {
              user_id: "amb-approved-free",
              nome_comercial: "Carrinho da Maria",
              delivery_fee: 0,
              modalidades: ["entrega", "retirada"],
              praia_referencia: "Itaguá",
              ponto_referencia: null,
              tipo_estrutura: "carrinho",
              estrutura_photo_url: null,
              possui_alvara: false,
              possui_vigilancia_sanitaria: false,
              kyc_status: "approved",
            },
          ],
        });
      }
      if (table === "estoque_ambulante") {
        return buildChain({
          data: [
            {
              prestador_id: "amb-approved-1",
              preco_venda: 12,
              quantidade: 10,
              disponivel: true,
              produtos_padrao: { nome: "Água de Coco", categoria_id: "cat-1" },
            },
            {
              prestador_id: "amb-approved-free",
              preco_venda: 10,
              quantidade: 5,
              disponivel: true,
              produtos_padrao: { nome: "Suco Natural", categoria_id: "cat-1" },
            },
            {
              prestador_id: "amb-unapproved",
              preco_venda: 8,
              quantidade: 5,
              disponivel: true,
              produtos_padrao: { nome: "Refri", categoria_id: "cat-1" },
            },
          ],
        });
      }
      if (table === "ambulante_avaliacoes") {
        return buildChain({ data: [{ avaliado_id: "amb-approved-1", nota: 5 }] });
      }
      return buildChain({ data: [] });
    });

    render(
      <MemoryRouter initialEntries={["/app/ambulantes/categoria/bebidas"]}>
        <Routes>
          <Route
            path="/app/ambulantes/categoria/:slug"
            element={<AmbulantesCategoriaAmbulantesPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Barraca do João")).toBeInTheDocument();
      expect(screen.getByText("Carrinho da Maria")).toBeInTheDocument();
    });

    // Unapproved vendor MUST NOT appear
    expect(screen.queryByText("Sem KYC")).not.toBeInTheDocument();

    // Trust badges + individual delivery fees
    expect(screen.getByText("Alvará Verificado")).toBeInTheDocument();
    expect(screen.getByText("Vigilância Sanitária")).toBeInTheDocument();
    expect(screen.getByText("Barraca")).toBeInTheDocument();
    expect(screen.getByText("Entrega R$ 4,50")).toBeInTheDocument();
    expect(screen.getByText("Entrega grátis")).toBeInTheDocument();
  });

  it("2. Carrinho aplica delivery_fee individual na entrega, R$ 0,00 na retirada e respeita limite de estoque", async () => {
    const insertedPedidos: any[] = [];
    const insertedItens: any[] = [];

    mocks.from.mockImplementation((table: string) => {
      if (table === "ambulante_sessions") {
        return buildChain({ data: { delivery_fee: 4.5 } });
      }
      if (table === "prestador_ambulante") {
        return buildChain({ data: { delivery_fee: 4.5 } });
      }
      if (table === "pedidos") {
        return {
          insert: vi.fn((payload: any) => {
            insertedPedidos.push(payload);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: "ped-created-1" }, error: null }),
              }),
            };
          }),
        };
      }
      if (table === "pedido_itens") {
        return {
          insert: vi.fn((payload: any) => {
            insertedItens.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }
      return buildChain({ data: null });
    });

    // Helper component that seeds the cart with maxStock=2 and deliveryFee=4.50
    const SeedCartAndRender = () => {
      const { setSession, addItem } = useAmbulantePedido();
      React.useEffect(() => {
        setSession("vendor-1", {
          prestadorId: "vendor-1",
          nome: "Barraca do Sol",
          emoji: "🥥",
          rating: 4.9,
          deliveryFee: 4.5,
          modalidades: ["entrega", "retirada"],
          praiaReferencia: "Praia Grande",
        });
        addItem("prod-coco", 10, "Água de Coco", "🥥", 2);
        addItem("prod-coco", 10, "Água de Coco", "🥥", 2);
        // 3rd attempt must be blocked by maxStock=2
        addItem("prod-coco", 10, "Água de Coco", "🥥", 2);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <AmbulanteCarrinhoPage />;
    };

    render(
      <AmbulantePedidoProvider>
        <MemoryRouter initialEntries={["/app/ambulantes/carrinho"]}>
          <Routes>
            <Route path="/app/ambulantes/carrinho" element={<SeedCartAndRender />} />
            <Route path="/app/ambulantes/pedido/:id" element={<div>Pedido Criado</div>} />
          </Routes>
        </MemoryRouter>
      </AmbulantePedidoProvider>,
    );

    // Qty capped at maxStock=2 => subtotal = 20,00; entrega fee = 4,50 => total = 24,50
    await waitFor(() => {
      expect(screen.getByText("Água de Coco")).toBeInTheDocument();
      expect(screen.getByText("R$ 24,50")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Aumentar Água de Coco")).toBeDisabled();

    // Switch to Retirada no Ponto => delivery_fee becomes 0,00 => total = 20,00
    fireEvent.click(screen.getByText("Retirar no Ponto"));
    await waitFor(() => {
      expect(screen.getByText("Grátis (R$ 0,00)")).toBeInTheDocument();
      expect(screen.getByText(/Enviar Pedido · R\$ 20,00/)).toBeInTheDocument();
    });

    // Submit pickup order
    fireEvent.click(screen.getByRole("button", { name: /Enviar Pedido/i }));

    await waitFor(() => {
      expect(insertedPedidos.length).toBe(1);
    });

    expect(insertedPedidos[0]).toMatchObject({
      tomador_id: "user-test-1",
      prestador_id: "vendor-1",
      modalidade: "retirada",
      status: "pending",
      subtotal: 20,
      delivery_fee: 0,
      total: 20,
    });
    expect(insertedPedidos[0].prestador_snapshot?.nome_comercial).toBe("Barraca do Sol");
    expect(insertedItens[0][0]).toMatchObject({
      produto_id: "prod-coco",
      qty: 2,
      preco_unit: 10,
      subtotal: 20,
    });
  });

  it("3. AmbulantePedidoPage não auto-avança status, chama cancel_ambulante_order e exibe CheckoutUniversal somente ao final", async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });

    let currentStatus = "pending";
    mocks.from.mockImplementation((table: string) => {
      if (table === "pedidos") {
        return buildChain({
          data: {
            id: "ped-live-1",
            tomador_id: "user-test-1",
            prestador_id: "vendor-1",
            status: currentStatus,
            modalidade: "entrega",
            subtotal: 20,
            delivery_fee: 4.5,
            total: 24.5,
            delivery_address: "Praia do Tenório",
            prestador_snapshot: { nome_comercial: "Barraca do João" },
            created_at: new Date().toISOString(),
            pedido_itens: [
              { id: "it-1", nome: "Água de Coco", emoji: "🥥", qty: 2, preco_unit: 10, subtotal: 20 },
            ],
          },
        });
      }
      if (table === "ambulante_mensagens" || table === "ambulante_avaliacoes") {
        return buildChain({ data: [] });
      }
      return buildChain({ data: null });
    });

    // Part A: status === 'pending' -> NO payment UI, NO fake auto-advance, Cancel calls RPC
    const { unmount } = render(
      <AmbulantePedidoProvider>
        <MemoryRouter initialEntries={["/app/ambulantes/pedido/ped-live-1"]}>
          <Routes>
            <Route path="/app/ambulantes/pedido/:id" element={<AmbulantePedidoPage />} />
          </Routes>
        </MemoryRouter>
      </AmbulantePedidoProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Aguardando ambulante aceitar/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("ambulante-payment-section")).not.toBeInTheDocument();

    // Cancel order calls cancel_ambulante_order RPC
    fireEvent.click(screen.getByRole("button", { name: /Cancelar Pedido/i }));
    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("cancel_ambulante_order", {
        p_pedido_id: "ped-live-1",
        p_reason: "Cancelado pelo cliente",
      });
    });

    unmount();

    // Part B: status === 'completed' -> Payment UI IS rendered with CheckoutUniversal(serviceType="ambulante")
    currentStatus = "completed";
    render(
      <AmbulantePedidoProvider>
        <MemoryRouter initialEntries={["/app/ambulantes/pedido/ped-live-1"]}>
          <Routes>
            <Route path="/app/ambulantes/pedido/:id" element={<AmbulantePedidoPage />} />
          </Routes>
        </MemoryRouter>
      </AmbulantePedidoProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ambulante-payment-section")).toBeInTheDocument();
    });

    // Switch to Cartão tab -> renders CheckoutUniversal with serviceType="ambulante"
    fireEvent.click(screen.getByRole("button", { name: /Cartão/i }));
    await waitFor(() => {
      const checkout = screen.getByTestId("mock-checkout-universal");
      expect(checkout).toHaveAttribute("data-service-type", "ambulante");
      expect(checkout).toHaveAttribute("data-service-id", "ped-live-1");
      expect(checkout).toHaveAttribute("data-provider-id", "vendor-1");
      expect(checkout).toHaveAttribute("data-amount", "24.5");
    });
  });

  it("4. AmbulantesOnboardingPage envia submit_ambulante_kyc com selos opcionais vazios e usa bucket kyc-documents", async () => {
    mocks.rpc.mockImplementation((fnName: string) => {
      if (fnName === "get_my_ambulante_profile") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fnName === "get_my_cadastral_profile") {
        return Promise.resolve({
          data: {
            nome: "João Ambulante",
            cpf: "12345678909",
            telefone: "12999998888",
            chave_pix: "12345678909",
          },
          error: null,
        });
      }
      if (fnName === "submit_ambulante_kyc") {
        return Promise.resolve({ data: { kyc_status: "pending" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(
      <MemoryRouter initialEntries={["/app/prestador/ambulantes/onboarding"]}>
        <Routes>
          <Route
            path="/app/prestador/ambulantes/onboarding"
            element={<AmbulantesOnboardingPage />}
          />
          <Route
            path="/app/prestador/ambulantes/kyc-pending"
            element={<div>KYC Em Análise</div>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/1\. Identidade & Recebimento/i)).toBeInTheDocument();
    });

    // Upload the 3 mandatory KYC docs (RG frente, RG verso, selfie) leaving optional trust badges EMPTY
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThanOrEqual(3);

    const fakeFile = new File(["img"], "doc.jpg", { type: "image/jpeg" });
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        fireEvent.change(fileInputs[i], { target: { files: [fakeFile] } });
      });
    }

    // All uploads must target kyc-documents bucket (NEVER catalogo-ambulantes)
    expect(mocks.storageFrom).toHaveBeenCalledWith("kyc-documents");
    expect(mocks.storageFrom).not.toHaveBeenCalledWith("catalogo-ambulantes");

    // Submit form with optional badges empty (non-blocking)
    fireEvent.click(screen.getByRole("button", { name: /Enviar KYC para Aprovação/i }));

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith(
        "submit_ambulante_kyc",
        expect.objectContaining({
          p_nome_comercial: "João Ambulante",
          p_cpf: "12345678909",
          p_telefone: "12999998888",
          p_chave_pix: "12345678909",
          p_delivery_fee: 0,
          p_possui_alvara: false,
          p_possui_vigilancia_sanitaria: false,
          p_tipo_estrutura: null,
          p_mei_cnpj: null,
        }),
      );
    });

    // Redirected to kyc-pending
    await waitFor(() => {
      expect(screen.getByText("KYC Em Análise")).toBeInTheDocument();
    });
  });

  it("5. PaymentHistoryService exibe Pedido Ambulantes UBT para Tomador (saída) e Prestador (entrada com split 90/10)", () => {
    const baseRow: PaymentHistoryRow = {
      payment_id: "pay-amb-1",
      transaction_id: "tx-amb-1",
      payment_status: "approved",
      service_id: "11223344-5566-7788-99aa-bbccddeeff00",
      service_type: "ambulante",
      total_amount: 50,
      provider_amount: 45,
      ubt_amount: 3.75,
      entity_amount: 0.25,
      prize_worker_amount: 0.25,
      prize_consumer_amount: 0.25,
      godparent_amount: 0.5,
      payment_route: "pix",
      paid_at: "2026-11-27T15:00:00Z",
      participant_role: "tomador",
      origin: null,
      destination: null,
      distance_km: null,
      duration_min: null,
      ride_type: "entrega",
      ride_status: "paid",
      payment_method: "pix",
    };

    const txTomador = paymentToTransaction(baseRow);
    expect(txTomador.type).toBe("saida");
    expect(txTomador.description).toBe("Pedido Ambulantes UBT · #11223344");
    expect(txTomador.amount).toBe(50);
    expect(txTomador.status).toBe("confirmed");
    expect(txTomador.splitAmounts?.provider).toBe(45);

    const txPrestador = paymentToTransaction({ ...baseRow, participant_role: "prestador" });
    expect(txPrestador.type).toBe("entrada");
    expect(txPrestador.description).toBe("Pedido Ambulantes UBT · #11223344");
    expect(txPrestador.amount).toBe(45);
    expect(txPrestador.splitAmounts?.ubt).toBe(3.75);
  });

  it("6. Feature flag mantém Ambulantes oculto (Em breve) no app público de Produção e ativo em Homologação", () => {
    expect(isVerticalEnabled("ambulantes", { hostname: "ubtservicos.com.br" })).toBe(false);
    expect(isVerticalEnabled("ambulantes", { hostname: "www.ubtservicos.com.br" })).toBe(false);
    expect(isVerticalEnabled("ambulantes", { hostname: "ubt-homologacao.vercel.app" })).toBe(true);
    expect(isVerticalEnabled("ambulantes", { hostname: "localhost" })).toBe(true);
  });
});
