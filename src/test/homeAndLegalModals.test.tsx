import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as verticalFlags from "@/config/verticalFlags";

const { navigateMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/usePwaInstall", () => ({
  usePwaInstall: () => ({
    showInstallBtn: false,
    isStandalone: false,
    isIOS: false,
    hasNativePrompt: false,
    install: vi.fn(),
  }),
}));

vi.mock("@/services/AnalyticsService", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/services/LoggingService", () => ({
  logSystem: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

import Index from "@/pages/Index";
import SaibaMaisPage from "@/pages/SaibaMaisPage";
import Login from "@/pages/Login";
import PublicFooter from "@/components/landing/PublicFooter";

describe("Nova Home (/), /saiba-mais, Ocultação Temporária de Login Público e Modais Legais (v1.8.15 / v1.9.1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigateMock.mockReset();
    window.scrollTo = vi.fn();
  });

  it("Nova Home (/) exibe CADASTRE-SE e SAIBA MAIS, oculta FAZER LOGIN por padrão e renderiza #cadastro sem textos de Fundadores", () => {
    expect(verticalFlags.SHOW_PUBLIC_LOGIN_BUTTON).toBe(false);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Index />
      </MemoryRouter>,
    );

    const cadastroBtns = screen.getAllByRole("button", { name: /^CADASTRE-SE$/i });
    const saibaMaisBtns = screen.getAllByRole("button", { name: /^SAIBA MAIS$/i });

    expect(cadastroBtns.length).toBeGreaterThanOrEqual(2);
    expect(saibaMaisBtns.length).toBeGreaterThanOrEqual(2);

    // Botão público de login oculto temporariamente via SHOW_PUBLIC_LOGIN_BUTTON
    expect(screen.queryByRole("button", { name: /FAZER LOGIN/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Entrar/i })).not.toBeInTheDocument();

    // Textos de fundadores devem estar completamente ausentes
    expect(screen.queryByText(/QUERO SER UM FUNDADOR/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/JÁ SOU FUNDADOR/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ACESSO PIONEIRO/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Entrada de Fundadores/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/garantir seus benefícios exclusivos e prioridade no lançamento/i),
    ).not.toBeInTheDocument();

    // Formulário de cadastro ancorado em #cadastro + logotipo vetorial SVG no footer
    expect(document.getElementById("cadastro")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "UBT Serviços" }).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(saibaMaisBtns[saibaMaisBtns.length - 1]);
    expect(navigateMock).toHaveBeenCalledWith("/saiba-mais");
  });

  it("/saiba-mais oculta FAZER LOGIN por padrão, exibe Carros ativo, oculta Capítulo V e respeita flag 'Em breve' em Produção", () => {
    vi.spyOn(verticalFlags, "isVerticalEnabled").mockImplementation(
      (v) => v !== "diaristas" && v !== "ambulantes",
    );

    render(
      <MemoryRouter initialEntries={["/saiba-mais"]}>
        <SaibaMaisPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Quem faz a cidade acontecer")).toBeInTheDocument();
    expect(screen.getByText("Carros")).toBeInTheDocument();
    expect(screen.getByText("Todos ganham")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O Cadastro" })).toBeInTheDocument();

    // Botão público de login oculto por padrão em /saiba-mais
    expect(screen.queryByRole("button", { name: /FAZER LOGIN/i })).not.toBeInTheDocument();

    // Capítulo V oculto + textos de Fundadores removidos
    expect(screen.queryByText(/Capítulo V/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/estavam aqui desde o começo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Entrada de Fundadores/i)).not.toBeInTheDocument();

    // Em Produção, Diaristas e Ambulantes exibem selo "Em breve"
    expect(screen.getAllByText("Em breve").length).toBeGreaterThanOrEqual(2);
  });

  it("rota /login permanece 100% desobstruída e funcional para acesso direto", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/email|e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("PublicFooter abre os modais de Termos de Uso e Política de Privacidade e fecha por ESC ou botão Fechar", () => {
    render(
      <MemoryRouter>
        <PublicFooter />
      </MemoryRouter>,
    );

    // Abrir Termos de Uso
    fireEvent.click(screen.getByRole("button", { name: "Termos de Uso" }));
    const termsDialog = screen.getByRole("dialog");
    expect(termsDialog).toBeInTheDocument();
    expect(within(termsDialog).getByText("TERMOS DE USO DA PLATAFORMA UBT")).toBeInTheDocument();
    expect(within(termsDialog).getByText(/68\.394\.558\/0001-32/)).toBeInTheDocument();

    // Fechar por ESC
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Abrir Política de Privacidade
    fireEvent.click(screen.getByRole("button", { name: "Política de Privacidade" }));
    const privacyDialog = screen.getByRole("dialog");
    expect(privacyDialog).toBeInTheDocument();
    expect(
      within(privacyDialog).getByText(
        "POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD) – UBT",
      ),
    ).toBeInTheDocument();
    expect(within(privacyDialog).getByText(/ubt\.servicos@gmail\.com/)).toBeInTheDocument();

    // Fechar pelo botão Fechar
    fireEvent.click(within(privacyDialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
