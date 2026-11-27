import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as verticalFlags from "@/config/verticalFlags";
import VerticalRouteGuard from "@/components/VerticalRouteGuard";

const { getUserMock, navigateMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    uid: "user-1",
    name: "Cliente Teste",
    role: "tomador",
    status: "ativo",
    kycStatus: "approved",
  }),
}));

vi.mock("@/components/notifications/InAppNotificationBell", () => ({
  default: () => null,
}));

vi.mock("@/components/app/GuidedOnboarding", () => ({
  default: () => null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

import { AdminLayout } from "@/layouts/AdminLayout";
import AppHome from "@/pages/AppHome";

describe("Feature Flags de Verticais por Ambiente (v1.8.13 / v1.8.14)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigateMock.mockReset();
    getUserMock.mockResolvedValue({
      data: { user: { id: "super-1", email: "ubt.servicos@gmail.com" } },
    });
  });

  it("detecta Produção (ubtservicos.vercel.app / bfqidoduceusbqlnrsol) e desabilita diaristas e ambulantes", () => {
    const prodByHost = {
      appEnv: "",
      hostname: "ubtservicos.vercel.app",
      supabaseUrl: "https://example.supabase.co",
      envOverrides: {},
    };
    expect(verticalFlags.isProductionEnv(prodByHost)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("diaristas", prodByHost)).toBe(false);
    expect(verticalFlags.isVerticalEnabled("ambulantes", prodByHost)).toBe(false);
    expect(verticalFlags.isVerticalEnabled("mototaxi", prodByHost)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("coco_cia", prodByHost)).toBe(true);

    const prodByRef = {
      appEnv: "",
      hostname: "custom.example.com",
      supabaseUrl: "https://bfqidoduceusbqlnrsol.supabase.co",
      envOverrides: {},
    };
    expect(verticalFlags.isProductionEnv(prodByRef)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("diaristas", prodByRef)).toBe(false);
    expect(verticalFlags.isVerticalEnabled("ambulantes", prodByRef)).toBe(false);

    // Override futuro via env reativa sem alterar código
    expect(
      verticalFlags.isVerticalEnabled("diaristas", {
        ...prodByHost,
        envOverrides: { VITE_ENABLE_DIARISTAS: "true" },
      }),
    ).toBe(true);
    expect(
      verticalFlags.isVerticalEnabled("ambulantes", {
        ...prodByHost,
        envOverrides: { VITE_ENABLE_AMBULANTES: "true" },
      }),
    ).toBe(true);
  });

  it("mantém todas as verticais habilitadas em Homologação (ubt-homologacao.vercel.app / xqujubbqcfqxkfczbidq) e localhost", () => {
    const homologCtx = {
      appEnv: "",
      hostname: "ubt-homologacao.vercel.app",
      supabaseUrl: "https://xqujubbqcfqxkfczbidq.supabase.co",
      envOverrides: {},
    };
    expect(verticalFlags.isProductionEnv(homologCtx)).toBe(false);
    expect(verticalFlags.isVerticalEnabled("diaristas", homologCtx)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("ambulantes", homologCtx)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("mototaxi", homologCtx)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("coco_cia", homologCtx)).toBe(true);

    const localCtx = {
      appEnv: "",
      hostname: "localhost",
      supabaseUrl: "https://xqujubbqcfqxkfczbidq.supabase.co",
      envOverrides: {},
    };
    expect(verticalFlags.isProductionEnv(localCtx)).toBe(false);
    expect(verticalFlags.isVerticalEnabled("diaristas", localCtx)).toBe(true);
    expect(verticalFlags.isVerticalEnabled("ambulantes", localCtx)).toBe(true);
  });

  it("AppHome em Produção exibe Ambulantes e Diaristas com selo 'Em breve', desabilitados e sem navegação", () => {
    vi.spyOn(verticalFlags, "isVerticalEnabled").mockImplementation(
      (v) => v !== "diaristas" && v !== "ambulantes",
    );

    render(
      <MemoryRouter initialEntries={["/app/home"]}>
        <AppHome />
      </MemoryRouter>,
    );

    const ambulantesBtn = screen.getByRole("button", { name: /Ambulantes/i });
    const diaristasBtn = screen.getByRole("button", { name: /Diaristas/i });
    const mototaxiBtn = screen.getByRole("button", { name: /Mototaxi/i });

    expect(ambulantesBtn).toBeDisabled();
    expect(ambulantesBtn).toHaveAttribute("aria-disabled", "true");
    expect(ambulantesBtn).toHaveTextContent("Em breve");

    expect(diaristasBtn).toBeDisabled();
    expect(diaristasBtn).toHaveAttribute("aria-disabled", "true");
    expect(diaristasBtn).toHaveTextContent("Em breve");

    expect(mototaxiBtn).not.toBeDisabled();
    expect(mototaxiBtn).not.toHaveTextContent("Em breve");

    fireEvent.click(ambulantesBtn);
    fireEvent.click(diaristasBtn);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("AppHome em Homologação exibe Ambulantes e Diaristas ativos, clicáveis e sem selo 'Em breve'", () => {
    vi.spyOn(verticalFlags, "isVerticalEnabled").mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/app/home"]}>
        <AppHome />
      </MemoryRouter>,
    );

    const ambulantesBtn = screen.getByRole("button", { name: /Ambulantes/i });
    const diaristasBtn = screen.getByRole("button", { name: /Diaristas/i });

    expect(ambulantesBtn).not.toBeDisabled();
    expect(ambulantesBtn).not.toHaveTextContent("Em breve");

    expect(diaristasBtn).not.toBeDisabled();
    expect(diaristasBtn).not.toHaveTextContent("Em breve");

    fireEvent.click(ambulantesBtn);
    expect(navigateMock).toHaveBeenCalledWith("/app/ambulantes");

    fireEvent.click(diaristasBtn);
    expect(navigateMock).toHaveBeenCalledWith("/app/diaristas");
  });

  it("AdminLayout oculta Diaristas e Ambulantes em Produção e exibe ambos em Homologação", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
    const prodSpy = vi
      .spyOn(verticalFlags, "isVerticalEnabled")
      .mockImplementation((v) => v !== "diaristas" && v !== "ambulantes");

    const { unmount } = render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminLayout>
          <div>Conteúdo Admin</div>
        </AdminLayout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Mototaxistas")).toBeInTheDocument();
    });
    expect(screen.queryByText("Diaristas")).not.toBeInTheDocument();
    expect(screen.queryByText("Ambulantes")).not.toBeInTheDocument();
    expect(screen.getByText("Côco & Cia")).toBeInTheDocument();

    unmount();
    prodSpy.mockRestore();

    vi.spyOn(verticalFlags, "isVerticalEnabled").mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminLayout>
          <div>Conteúdo Admin</div>
        </AdminLayout>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Diaristas")).toBeInTheDocument();
      expect(screen.getByText("Ambulantes")).toBeInTheDocument();
    });
  });

  it("VerticalRouteGuard redireciona rotas de Diaristas/Ambulantes em Produção e permite acesso em Homologação", () => {
    const spy = vi
      .spyOn(verticalFlags, "isVerticalEnabled")
      .mockReturnValue(false);

    const { unmount } = render(
      <MemoryRouter initialEntries={["/app/diaristas"]}>
        <Routes>
          <Route path="/app/home" element={<div>Home Redirecionada</div>} />
          <Route
            path="/app/diaristas"
            element={
              <VerticalRouteGuard vertical="diaristas" redirectTo="/app/home">
                <div>Tela Diaristas</div>
              </VerticalRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Home Redirecionada")).toBeInTheDocument();
    expect(screen.queryByText("Tela Diaristas")).not.toBeInTheDocument();

    unmount();
    spy.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/app/diaristas"]}>
        <Routes>
          <Route path="/app/home" element={<div>Home Redirecionada</div>} />
          <Route
            path="/app/diaristas"
            element={
              <VerticalRouteGuard vertical="diaristas" redirectTo="/app/home">
                <div>Tela Diaristas</div>
              </VerticalRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Tela Diaristas")).toBeInTheDocument();
  });
});
