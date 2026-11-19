import { describe, it, expect } from "vitest";
import {
  REGULATORY_DEFAULTS,
  resolveGodparentAllocation,
  releaseContingencyRepasses,
  type GodparentLedgerItem,
} from "@/lib/finance/splitEngine";

describe("UBT Finance — Fase 3: Split de Apadrinhamento e Contingenciamento por Chave PIX", () => {
  const PADRINHO_TOMADOR_ID = "11111111-1111-4111-8111-111111111111";
  const PADRINHO_PRESTADOR_ID = "22222222-2222-4222-8222-222222222222";

  it("1. Transação sem padrinho direciona cotas de 0,5% ao fundo de reserva com status nao_aplicavel", () => {
    const result = resolveGodparentAllocation({
      totalAmount: 100,
      config: REGULATORY_DEFAULTS,
      godparentTomador: null,
      godparentPrestador: null,
    });

    expect(result.split.padrinho_tomador_amount).toBe(0.5);
    expect(result.split.padrinho_prestador_amount).toBe(0.5);
    expect(result.godparent_tomador_id).toBeNull();
    expect(result.godparent_prestador_id).toBeNull();
    expect(result.status_repasse_godparent_tomador).toBe("nao_aplicavel");
    expect(result.status_repasse_godparent_prestador).toBe("nao_aplicavel");
    expect(result.destino_tomador).toBe("fundo_reserva_plataforma");
    expect(result.destino_prestador).toBe("fundo_reserva_plataforma");
  });

  it("2. Transação com padrinho COM Chave PIX aloca 0,5% diretamente como pendente_repasse", () => {
    const result = resolveGodparentAllocation({
      totalAmount: 200,
      config: REGULATORY_DEFAULTS,
      godparentTomador: { id: PADRINHO_TOMADOR_ID, hasPixKey: true },
      godparentPrestador: null,
    });

    expect(result.godparent_tomador_id).toBe(PADRINHO_TOMADOR_ID);
    expect(result.godparent_tomador_amount).toBe(1.0);
    expect(result.status_repasse_godparent_tomador).toBe("pendente_repasse");
    expect(result.destino_tomador).toBe("padrinho_tomador");

    expect(result.godparent_prestador_id).toBeNull();
    expect(result.status_repasse_godparent_prestador).toBe("nao_aplicavel");
    expect(result.destino_prestador).toBe("fundo_reserva_plataforma");
  });

  it("3. Transação com padrinho SEM Chave PIX retém 0,5% como contingenciado sem desviar ao fundo de reserva", () => {
    const result = resolveGodparentAllocation({
      totalAmount: 100,
      config: REGULATORY_DEFAULTS,
      godparentTomador: { id: PADRINHO_TOMADOR_ID, hasPixKey: false },
      godparentPrestador: null,
    });

    expect(result.godparent_tomador_id).toBe(PADRINHO_TOMADOR_ID);
    expect(result.godparent_tomador_amount).toBe(0.5);
    expect(result.status_repasse_godparent_tomador).toBe("contingenciado");
    expect(result.destino_tomador).toBe("padrinho_tomador");
  });

  it("4. Transação com padrinhos distintos para tomador (com PIX) e prestador (sem PIX) aloca 0,5% para cada", () => {
    const result = resolveGodparentAllocation({
      totalAmount: 100,
      config: REGULATORY_DEFAULTS,
      godparentTomador: { id: PADRINHO_TOMADOR_ID, hasPixKey: true },
      godparentPrestador: { id: PADRINHO_PRESTADOR_ID, hasPixKey: false },
    });

    expect(result.godparent_tomador_id).toBe(PADRINHO_TOMADOR_ID);
    expect(result.godparent_tomador_amount).toBe(0.5);
    expect(result.status_repasse_godparent_tomador).toBe("pendente_repasse");
    expect(result.destino_tomador).toBe("padrinho_tomador");

    expect(result.godparent_prestador_id).toBe(PADRINHO_PRESTADOR_ID);
    expect(result.godparent_prestador_amount).toBe(0.5);
    expect(result.status_repasse_godparent_prestador).toBe("contingenciado");
    expect(result.destino_prestador).toBe("padrinho_prestador");
    expect(result.split.padrinho_amount).toBe(1.0);
  });

  it("5. Regularização da Chave PIX converte saldos contingenciados do padrinho para pendente_repasse sem afetar outros registros", () => {
    const ledger: GodparentLedgerItem[] = [
      {
        id: "split-1",
        godparent_tomador_id: PADRINHO_TOMADOR_ID,
        godparent_tomador_amount: 0.5,
        status_repasse_godparent_tomador: "contingenciado",
        godparent_prestador_id: PADRINHO_PRESTADOR_ID,
        godparent_prestador_amount: 0.5,
        status_repasse_godparent_prestador: "contingenciado",
      },
      {
        id: "split-2",
        godparent_tomador_id: PADRINHO_PRESTADOR_ID,
        godparent_tomador_amount: 1.5,
        status_repasse_godparent_tomador: "pago",
        godparent_prestador_id: PADRINHO_TOMADOR_ID,
        godparent_prestador_amount: 1.5,
        status_repasse_godparent_prestador: "contingenciado",
      },
    ];

    const updated = releaseContingencyRepasses(ledger, PADRINHO_TOMADOR_ID, true);

    // PADRINHO_TOMADOR_ID teve suas cotas contingenciadas liberadas para pendente_repasse
    expect(updated[0].status_repasse_godparent_tomador).toBe("pendente_repasse");
    expect(updated[1].status_repasse_godparent_prestador).toBe("pendente_repasse");

    // PADRINHO_PRESTADOR_ID não foi alterado (continua contingenciado no split-1 e pago no split-2)
    expect(updated[0].status_repasse_godparent_prestador).toBe("contingenciado");
    expect(updated[1].status_repasse_godparent_tomador).toBe("pago");
  });
});
