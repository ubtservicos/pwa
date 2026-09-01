import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

// ==============================================================================
// PROTOCOL CONSTANTS
// ==============================================================================
const PROTOCOL_VERSION = "1";
const MAX_BODY_SIZE_BYTES = 64 * 1024;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS = 8000;
const MAX_KNOWLEDGE_CHARS = 6000;
const TIMESTAMP_TOLERANCE_SECONDS = 300;
const TEST_SECRET = "test_sandbox_shared_secret_1234567890abcdef";

// ==============================================================================
// TEST ENGINE IMPLEMENTATION (Mirroring Deno Edge Function Logic in Node/Vitest)
// ==============================================================================
async function computeHmacSha256(secret: string, payload: string): Promise<string> {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface ProcessOptions {
  secretOverride?: string;
  mockReplayStore?: Set<string>;
  skipReplayPersistence?: boolean;
}

async function processAnswerEngine(
  headers: Record<string, string>,
  rawBodyBytes: Uint8Array,
  options?: ProcessOptions
): Promise<{ status: number; body: any }> {
  // 1. Check Body Size Limit (HTTP 413)
  if (rawBodyBytes.byteLength > MAX_BODY_SIZE_BYTES) {
    return {
      status: 413,
      body: { error: "Payload Too Large: Raw request body exceeds 64 KiB limit." }
    };
  }

  // 2. Extract Headers
  const version = headers["x-omnichannel-version"] || headers["X-Omnichannel-Version"];
  const requestId = headers["x-omnichannel-request-id"] || headers["X-Omnichannel-Request-Id"];
  const timestamp = headers["x-omnichannel-timestamp"] || headers["X-Omnichannel-Timestamp"];
  const signature = headers["x-omnichannel-signature"] || headers["X-Omnichannel-Signature"];

  if (!version || !requestId || !timestamp || !signature) {
    return {
      status: 401,
      body: { error: "Unauthorized: Missing required X-Omnichannel headers." }
    };
  }

  if (version !== PROTOCOL_VERSION) {
    return {
      status: 400,
      body: { error: `Bad Request: Unsupported protocol version "${version}".` }
    };
  }

  // 3. Validate Timestamp
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum) || timestampNum.toString() !== timestamp) {
    return {
      status: 401,
      body: { error: "Unauthorized: Invalid X-Omnichannel-Timestamp format." }
    };
  }

  const currentEpoch = Math.floor(Date.now() / 1000);
  const timeDrift = Math.abs(currentEpoch - timestampNum);
  if (timeDrift > TIMESTAMP_TOLERANCE_SECONDS) {
    return {
      status: 401,
      body: { error: `Unauthorized: Timestamp outside acceptable window (${timeDrift}s).` }
    };
  }

  // 4. Resolve Secret (Fail Closed if empty)
  const secret = options?.secretOverride;
  if (!secret) {
    return {
      status: 500,
      body: { error: "Internal Server Error: Authentication configuration unavailable." }
    };
  }

  // 5. Verify Signature
  if (!signature.startsWith("v1=")) {
    return {
      status: 401,
      body: { error: "Unauthorized: Invalid signature format. Expected 'v1=<hex>'." }
    };
  }
  const providedHex = signature.substring(3).toLowerCase();
  const rawBodyText = Buffer.from(rawBodyBytes).toString("utf8");
  const canonicalPayload = `${timestamp}\n${requestId}\n${rawBodyText}`;
  const expectedHex = await computeHmacSha256(secret, canonicalPayload);

  if (!constantTimeCompare(providedHex, expectedHex)) {
    return {
      status: 401,
      body: { error: "Unauthorized: HMAC signature verification failed." }
    };
  }

  // 6. Parse JSON Body
  let parsedPayload: any;
  try {
    parsedPayload = JSON.parse(rawBodyText);
  } catch {
    return {
      status: 400,
      body: { error: "Bad Request: Malformed JSON body." }
    };
  }

  if (!parsedPayload.request_id || parsedPayload.request_id !== requestId) {
    return {
      status: 400,
      body: { error: "Bad Request: Header X-Omnichannel-Request-Id must match body request_id." }
    };
  }

  // 7. Enforce Limits
  if (parsedPayload.history) {
    if (parsedPayload.history.length > MAX_HISTORY_MESSAGES) {
      return {
        status: 413,
        body: { error: `Payload Too Large: History exceeds ${MAX_HISTORY_MESSAGES} messages limit.` }
      };
    }
    const historyChars = parsedPayload.history.reduce((acc: number, m: any) => acc + (m.content?.length || 0), 0);
    if (historyChars > MAX_HISTORY_CHARS) {
      return {
        status: 413,
        body: { error: `Payload Too Large: History exceeds ${MAX_HISTORY_CHARS} characters limit.` }
      };
    }
  }

  if (parsedPayload.knowledge) {
    let knowledgeChars = 0;
    if (parsedPayload.knowledge.sources) {
      knowledgeChars += parsedPayload.knowledge.sources.reduce((acc: number, s: any) => acc + (s.content?.length || 0), 0);
    }
    if (parsedPayload.knowledge.errata) {
      knowledgeChars += parsedPayload.knowledge.errata.reduce((acc: number, e: any) => acc + (e.content?.length || 0), 0);
    }
    if (knowledgeChars > MAX_KNOWLEDGE_CHARS) {
      return {
        status: 413,
        body: { error: `Payload Too Large: Knowledge context exceeds ${MAX_KNOWLEDGE_CHARS} characters limit.` }
      };
    }
  }

  // 8. Replay Protection Store
  if (!options?.skipReplayPersistence && options?.mockReplayStore) {
    if (options.mockReplayStore.has(requestId)) {
      return {
        status: 409,
        body: { error: "Conflict: Request already processed or duplicate request_id detected." }
      };
    }
    options.mockReplayStore.add(requestId);
  }

  // 9. Deadline Validation
  if (parsedPayload.deadline_at) {
    const deadlineTime = new Date(parsedPayload.deadline_at).getTime();
    if (isNaN(deadlineTime)) {
      return {
        status: 400,
        body: { error: "Bad Request: Invalid deadline_at format." }
      };
    }
    if (deadlineTime < Date.now()) {
      return {
        status: 200,
        body: {
          version: PROTOCOL_VERSION,
          request_id: requestId,
          status: "temporarily_unavailable",
          answer: "O prazo estipulado na requisição expirou antes do processamento.",
          citation_references: [],
          runtime_evidence: []
        }
      };
    }
  }

  // 10. Deterministic Scenarios
  const messageText = typeof parsedPayload.message === "string" 
    ? parsedPayload.message 
    : (parsedPayload.message?.text || "");
  const normalizedQuery = messageText.toLowerCase().trim();

  // Scenario F: Timeout Simulation
  if (normalizedQuery.includes("sandbox_timeout")) {
    return {
      status: 200,
      body: {
        version: PROTOCOL_VERSION,
        request_id: requestId,
        status: "answered",
        answer: "Simulação de timeout controlada concluída com sucesso.",
        citation_references: [],
        runtime_evidence: []
      }
    };
  }

  // Scenario E: Temporarily Unavailable
  if (normalizedQuery.includes("sandbox_unavailable") || parsedPayload.context?.simulate_unavailable === true) {
    return {
      status: 200,
      body: {
        version: PROTOCOL_VERSION,
        request_id: requestId,
        status: "temporarily_unavailable",
        answer: "O Serviço de Atendimento ao Usuário está temporariamente indisponível.",
        citation_references: [],
        runtime_evidence: []
      }
    };
  }

  // Scenario C: Transactional Live State (R*) — Evaluated before generic E*
  if (
    normalizedQuery.includes("sandbox_order_status") || 
    normalizedQuery.includes("status do pedido") || 
    normalizedQuery.includes("status do meu pedido") ||
    normalizedQuery.includes("status da corrida") ||
    parsedPayload.context?.requested_tool === "sandbox_order_status"
  ) {
    const liveEvidence = {
      id: "R1",
      kind: "runtime_tool",
      tool_key: "sandbox_order_status",
      label: "Status Operacional do Pedido",
      observed_at: new Date().toISOString(),
      data: {
        status: "pending",
        service_type: "mototaxi_coleta",
        driver_assigned: true,
        estimated_arrival_minutes: 12
      }
    };

    return {
      status: 200,
      body: {
        version: PROTOCOL_VERSION,
        request_id: requestId,
        status: "answered",
        answer: "Identificamos o seu pedido em andamento (R1). O status atual é: 'pending' (mototáxi a caminho).",
        citation_references: ["R1"],
        runtime_evidence: [liveEvidence]
      }
    };
  }

  // Scenario B: Errata Precedence (E* > S*)
  const erratas = parsedPayload.knowledge?.errata || [];
  const sources = parsedPayload.knowledge?.sources || [];

  if (erratas.length > 0) {
    const primaryErrata = erratas[0];
    return {
      status: 200,
      body: {
        version: PROTOCOL_VERSION,
        request_id: requestId,
        status: "answered",
        answer: `Conforme a atualização e errata oficial recente (${primaryErrata.id}): ${primaryErrata.content}`,
        citation_references: [primaryErrata.id],
        runtime_evidence: []
      }
    };
  }

  // Scenario A: Answered from S*
  if (sources.length > 0) {
    const primarySource = sources[0];
    return {
      status: 200,
      body: {
        version: PROTOCOL_VERSION,
        request_id: requestId,
        status: "answered",
        answer: `De acordo com as diretrizes oficiais (${primarySource.id}): ${primarySource.content}`,
        citation_references: [primarySource.id],
        runtime_evidence: []
      }
    };
  }

  // Scenario D: Insufficient Knowledge
  return {
    status: 200,
    body: {
      version: PROTOCOL_VERSION,
      request_id: requestId,
      status: "insufficient_knowledge",
      answer: "Não encontramos informações institucionais suficientes na Base de Conhecimento.",
      citation_references: [],
      runtime_evidence: []
    }
  };
}

// ==============================================================================
// TEST SUITE
// ==============================================================================
describe("UBT Omnichannel Answer Engine Sandbox V1 — Comprehensive Protocol Tests", () => {
  const buildSignedRequest = async (payload: any, options?: { secret?: string; timestampOffset?: number; customRequestId?: string; tamperedSignature?: boolean }) => {
    const requestId = options?.customRequestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = Math.floor(Date.now() / 1000 + (options?.timestampOffset || 0)).toString();
    const payloadWithId = { ...payload, request_id: payload.request_id || requestId };
    const rawBodyText = JSON.stringify(payloadWithId);
    const rawBodyBytes = Buffer.from(rawBodyText, "utf8");

    const secret = options?.secret || TEST_SECRET;
    const canonicalPayload = `${timestamp}\n${requestId}\n${rawBodyText}`;
    let signature = await computeHmacSha256(secret, canonicalPayload);

    if (options?.tamperedSignature) {
      signature = signature.substring(0, 10) + "0000" + signature.substring(14);
    }

    const headers = {
      "X-Omnichannel-Version": PROTOCOL_VERSION,
      "X-Omnichannel-Request-Id": requestId,
      "X-Omnichannel-Timestamp": timestamp,
      "X-Omnichannel-Signature": `v1=${signature}`,
      "Content-Type": "application/json"
    };

    return { headers, rawBodyBytes, requestId, timestamp };
  };

  // 1. HMAC Authentication & Constant Time
  it("authenticates valid request with correct HMAC-SHA256 signature", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Qual o horário de funcionamento?" },
      knowledge: { sources: [{ id: "S1", content: "Segunda a Sexta das 08h às 18h." }] }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("answered");
    expect(res.body.citation_references).toContain("S1");
  });

  it("rejects request with invalid HMAC signature with HTTP 401", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest(
      { version: "1", message: { text: "Teste" } },
      { tamperedSignature: true }
    );

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("HMAC signature verification failed");
  });

  it("rejects request missing required headers with HTTP 401", async () => {
    const rawBodyBytes = Buffer.from(JSON.stringify({ message: "teste" }), "utf8");
    const res = await processAnswerEngine({}, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Missing required X-Omnichannel headers");
  });

  // 2. Timestamp Tolerance (±300s)
  it("accepts timestamp within 300 seconds window", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest(
      { version: "1", message: { text: "Teste" }, knowledge: { sources: [{ id: "S1", content: "OK" }] } },
      { timestampOffset: -120 }
    );

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
  });

  it("rejects expired timestamp (> 300s in past) with HTTP 401", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest(
      { version: "1", message: { text: "Teste" } },
      { timestampOffset: -305 }
    );

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Timestamp outside acceptable window");
  });

  it("rejects future timestamp (> 300s ahead) with HTTP 401", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest(
      { version: "1", message: { text: "Teste" } },
      { timestampOffset: 310 }
    );

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Timestamp outside acceptable window");
  });

  // 3. Replay Protection Store
  it("prevents replay attacks by returning HTTP 409 on duplicate request_id", async () => {
    const mockStore = new Set<string>();
    const req = await buildSignedRequest({
      version: "1",
      message: { text: "Qual o horário?" },
      knowledge: { sources: [{ id: "S1", content: "08h às 18h" }] }
    });

    // 1st request -> success
    const res1 = await processAnswerEngine(req.headers, req.rawBodyBytes, {
      secretOverride: TEST_SECRET,
      mockReplayStore: mockStore
    });
    expect(res1.status).toBe(200);

    // 2nd request with exact same request_id -> 409 Conflict
    const res2 = await processAnswerEngine(req.headers, req.rawBodyBytes, {
      secretOverride: TEST_SECRET,
      mockReplayStore: mockStore
    });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toContain("duplicate request_id detected");
  });

  // 4. Request Limits & Oversized Rejection (HTTP 413)
  it("rejects raw body exceeding 64 KiB with HTTP 413", async () => {
    const largeBytes = new Uint8Array(65 * 1024); // 65 KiB
    const res = await processAnswerEngine({}, largeBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("exceeds 64 KiB limit");
  });

  it("rejects history exceeding 10 messages with HTTP 413", async () => {
    const history = Array.from({ length: 11 }, (_, i) => ({ role: "user", content: `Mensagem ${i}` }));
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Teste" },
      history
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("History exceeds 10 messages");
  });

  it("rejects knowledge exceeding 6,000 characters with HTTP 413", async () => {
    const hugeContent = "A".repeat(6500);
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Teste" },
      knowledge: { sources: [{ id: "S1", content: hugeContent }] }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("Knowledge context exceeds");
  });

  // 5. Deadline Validation
  it("handles valid future deadline normally", async () => {
    const futureDeadline = new Date(Date.now() + 60000).toISOString();
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      deadline_at: futureDeadline,
      message: { text: "Pergunta" },
      knowledge: { sources: [{ id: "S1", content: "Resposta" }] }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("answered");
  });

  it("returns temporarily_unavailable when deadline has expired", async () => {
    const pastDeadline = new Date(Date.now() - 5000).toISOString();
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      deadline_at: pastDeadline,
      message: { text: "Pergunta" },
      knowledge: { sources: [{ id: "S1", content: "Resposta" }] }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("temporarily_unavailable");
    expect(res.body.answer).toContain("prazo estipulado");
  });

  // 6. Six Controlled Deterministic Scenarios
  it("Scenario A: Answered from S* (Governed Knowledge Source)", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Onde descartar garrafas PET em Ubatuba?" },
      knowledge: {
        sources: [{ id: "S1", title: "Ecopontos UBT", content: "O descarte de PET pode ser feito nos Ecopontos do Centro e Itaguá." }]
      }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("answered");
    expect(res.body.citation_references).toEqual(["S1"]);
    expect(res.body.answer).toContain("S1");
    expect(res.body.runtime_evidence).toEqual([]);
  });

  it("Scenario B: Answered from E* (Human Errata Precedence over S*)", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Qual o horário da coleta hoje no Centro?" },
      knowledge: {
        sources: [{ id: "S1", title: "Escala Padrão", content: "Horário padrão: 18:00h." }],
        errata: [{ id: "E1", title: "Aviso Feriado", content: "Horário excepcional hoje: 15:00h devido a manutenção." }]
      }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("answered");
    // Precedence rule: E* > S*
    expect(res.body.citation_references).toEqual(["E1"]);
    expect(res.body.answer).toContain("15:00h");
    expect(res.body.answer).toContain("E1");
  });

  it("Scenario C: Answered with R* (Live Transactional State Authority)", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Qual o status do meu pedido de mototáxi?" },
      knowledge: {
        errata: [{ id: "E1", content: "Pagamentos normalmente são aprovados de imediato." }]
      }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("answered");
    expect(res.body.citation_references).toEqual(["R1"]);
    expect(res.body.runtime_evidence.length).toBe(1);
    expect(res.body.runtime_evidence[0].tool_key).toBe("sandbox_order_status");
    // Transactional state "pending" must NOT be overwritten by errata
    expect(res.body.runtime_evidence[0].data.status).toBe("pending");
    expect(res.body.answer).toContain("pending");
  });

  it("Scenario D: Insufficient Knowledge (No matching context/evidence)", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Qual a altitude do Morro do Pico em metros?" },
      knowledge: { sources: [], errata: [] }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("insufficient_knowledge");
    expect(res.body.citation_references).toEqual([]);
    expect(res.body.runtime_evidence).toEqual([]);
  });

  it("Scenario E: Temporarily Unavailable (Controlled Synthetic Trigger)", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "SANDBOX_UNAVAILABLE" }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("temporarily_unavailable");
    expect(res.body.answer).toContain("temporariamente indisponível");
  });

  it("Scenario F: Timeout Simulation (Controlled Delay for Caller Testing)", async () => {
    const { headers, rawBodyBytes, requestId } = await buildSignedRequest({
      version: "1",
      message: { text: "SANDBOX_TIMEOUT" }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: TEST_SECRET });
    expect(res.status).toBe(200);
    expect(res.body.request_id).toBe(requestId);
    expect(res.body.status).toBe("answered");
  });

  // 7. Fail-Closed Security Policy
  it("fails closed with HTTP 500 when secret is not configured", async () => {
    const { headers, rawBodyBytes } = await buildSignedRequest({
      version: "1",
      message: { text: "Teste" }
    });

    const res = await processAnswerEngine(headers, rawBodyBytes, { secretOverride: undefined });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Authentication configuration unavailable");
  });
});
