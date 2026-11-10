import { describe, it, expect, vi } from "vitest";

// Interface do retorno da RPC resolver_padrinho_slug
export interface PadrinhoResolvido {
  padrinho_id: string;
  nome_exibicao: string;
  tipo_padrinho: string;
  padrinho_telefone: string | null;
}

// Função simuladora de resolução de padrinho via RPC / banco
export async function resolverPadrinho(
  rawSlug: string | null | undefined,
  rpcClient: (slug: string) => Promise<{ data: PadrinhoResolvido[] | null; error: Error | null }>
): Promise<PadrinhoResolvido | null> {
  if (!rawSlug) return null;
  const cleanSlug = rawSlug.trim().replace(/[\\/\s]/g, "");
  if (!cleanSlug || cleanSlug.length < 2) return null;

  try {
    const { data, error } = await rpcClient(cleanSlug);
    if (error || !data || data.length === 0 || !data[0]?.padrinho_id) {
      return null;
    }
    return data[0];
  } catch {
    return null;
  }
}

// Lógica de sanitização e proteção anti-fraude (auto-indicação)
export function validarVinculoPadrinho(
  leadTelefone: string,
  padrinho: PadrinhoResolvido | null
): {
  padrinho_id: string | null;
  origem: "indicacao" | "direto";
  isAutoIndicacao: boolean;
} {
  if (!padrinho?.padrinho_id) {
    return { padrinho_id: null, origem: "direto", isAutoIndicacao: false };
  }

  const cleanLeadPhone = leadTelefone.replace(/\D/g, "");
  const cleanPadrinhoPhone = (padrinho.padrinho_telefone || "").replace(/\D/g, "");

  // Bloqueio se o telefone for idêntico
  if (cleanPadrinhoPhone && cleanLeadPhone === cleanPadrinhoPhone) {
    return {
      padrinho_id: null,
      origem: "direto",
      isAutoIndicacao: true,
    };
  }

  return {
    padrinho_id: padrinho.padrinho_id,
    origem: "indicacao",
    isAutoIndicacao: false,
  };
}

describe("UBT Referral — Resolução e Vinculação de Padrinho", () => {
  const mockPadrinho: PadrinhoResolvido = {
    padrinho_id: "4db6e8a4-535f-4a77-9dba-8f3861f8b4dd",
    nome_exibicao: "Felipe Santander",
    tipo_padrinho: "tomador",
    padrinho_telefone: "(11) 95342-3954",
  };

  const mockEntidadeMadrinha: PadrinhoResolvido = {
    padrinho_id: "8c0067ed-c250-4400-b09b-a238b912c04b",
    nome_exibicao: "Associação Comercial UBT",
    tipo_padrinho: "associacao",
    padrinho_telefone: "(12) 3832-1100",
  };

  it("1. Resolução bem-sucedida de slug válido retornando padrinho_id e nome_exibicao", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [mockPadrinho],
      error: null,
    });

    const resultado = await resolverPadrinho("felipe-11953", mockRpc);

    expect(mockRpc).toHaveBeenCalledWith("felipe-11953");
    expect(resultado).not.toBeNull();
    expect(resultado?.padrinho_id).toBe("4db6e8a4-535f-4a77-9dba-8f3861f8b4dd");
    expect(resultado?.nome_exibicao).toBe("Felipe Santander");
    expect(resultado?.tipo_padrinho).toBe("tomador");
  });

  it("2. Resolução com sanitização de slug com barras e espaços residuais", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [mockEntidadeMadrinha],
      error: null,
    });

    const resultado = await resolverPadrinho(" /associacao-ubt/ \n", mockRpc);

    expect(mockRpc).toHaveBeenCalledWith("associacao-ubt");
    expect(resultado).not.toBeNull();
    expect(resultado?.nome_exibicao).toBe("Associação Comercial UBT");
    expect(resultado?.tipo_padrinho).toBe("associacao");
  });

  it("3. Tratamento gracioso de slug inexistente retornando nulo sem estourar exceção", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const resultado = await resolverPadrinho("slug-inexistente-123", mockRpc);

    expect(resultado).toBeNull();
  });

  it("4. Tratamento gracioso de erro de rede ou RPC retornando nulo", async () => {
    const mockRpc = vi.fn().mockRejectedValue(new Error("Network Error"));

    const resultado = await resolverPadrinho("slug-qualquer", mockRpc);

    expect(resultado).toBeNull();
  });

  it("5. Bloqueio de auto-indicação quando telefone do lead coincide com o do padrinho", () => {
    const leadTelefone = "(11) 95342-3954"; // Mesmo telefone do mockPadrinho

    const vinculo = validarVinculoPadrinho(leadTelefone, mockPadrinho);

    expect(vinculo.isAutoIndicacao).toBe(true);
    expect(vinculo.padrinho_id).toBeNull();
    expect(vinculo.origem).toBe("direto");
  });

  it("6. Persistência de origem = 'indicacao' quando lead possui telefone distinto do padrinho", () => {
    const leadTelefone = "(12) 98146-6358"; // Telefone diferente do padrinho

    const vinculo = validarVinculoPadrinho(leadTelefone, mockPadrinho);

    expect(vinculo.isAutoIndicacao).toBe(false);
    expect(vinculo.padrinho_id).toBe("4db6e8a4-535f-4a77-9dba-8f3861f8b4dd");
    expect(vinculo.origem).toBe("indicacao");
  });

  it("7. Persistência de origem = 'direto' e padrinho_id = null na ausência de padrinho", () => {
    const leadTelefone = "(12) 99999-8888";

    const vinculo = validarVinculoPadrinho(leadTelefone, null);

    expect(vinculo.isAutoIndicacao).toBe(false);
    expect(vinculo.padrinho_id).toBeNull();
    expect(vinculo.origem).toBe("direto");
  });
});
