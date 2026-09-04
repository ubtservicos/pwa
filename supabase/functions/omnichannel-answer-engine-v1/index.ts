import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==============================================================================
// CONSTANTS & LIMITS
// ==============================================================================
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnichannel-request-id, x-omnichannel-timestamp, x-omnichannel-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const PROTOCOL_VERSION = "1";
export const MAX_BODY_SIZE_BYTES = 64 * 1024; // 64 KiB
export const MAX_HISTORY_MESSAGES = 10;
export const MAX_HISTORY_CHARS = 8000;
export const MAX_KNOWLEDGE_CHARS = 6000;
export const TIMESTAMP_TOLERANCE_SECONDS = 300; // ±300s (5 minutes)
export const REPLAY_TTL_MINUTES = 15;
export const ALLOWED_RUNTIME_TOOLS = ["sandbox_order_status", "sandbox_account_status"];

// ==============================================================================
// CRYPTO HELPERS (Constant-Time HMAC-SHA256)
// ==============================================================================
export async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const signatureBytes = new Uint8Array(signatureBuffer);
  
  return Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ==============================================================================
// TYPES
// ==============================================================================
export interface KnowledgeItem {
  reference?: string;
  title?: string;
  content: string;
  is_errata?: boolean;
}

export interface RuntimeEvidence {
  reference: string;
  kind: "runtime_tool";
  tool_key: string;
  label: string;
  observed_at: string;
}

export interface AnswerEngineRequest {
  version: string;
  request_id: string;
  deadline_at?: string;
  conversation?: {
    id?: string;
    channel?: string;
  };
  message: {
    text: string;
  } | string;
  history?: Array<{
    role: string;
    content: string;
  }>;
  context?: Record<string, unknown>;
  knowledge?: {
    sources?: KnowledgeItem[];
  };
}

export interface AnswerEngineResponse {
  version: string;
  request_id: string;
  status: "answered" | "insufficient_knowledge" | "temporarily_unavailable";
  answer: string;
  citation_references: string[];
  runtime_evidence: RuntimeEvidence[];
}

// ==============================================================================
// CORE LOGIC (Exported for unit testing and server handling)
// ==============================================================================
export async function processAnswerEngineRequest(
  headers: Headers,
  rawBody: Uint8Array,
  options?: {
    secretOverride?: string;
    supabaseClientOverride?: any;
    skipReplayPersistence?: boolean;
  }
): Promise<{ status: number; body: Record<string, unknown> | AnswerEngineResponse }> {
  const startTime = Date.now();

  // 1. Check Body Size Limit (HTTP 413)
  if (rawBody.byteLength > MAX_BODY_SIZE_BYTES) {
    return {
      status: 413,
      body: { error: "Payload Too Large: Raw request body exceeds 64 KiB limit." }
    };
  }

  // 2. Hybrid Authentication: Check JWT Bearer vs S2S HMAC Signature
  let isAuthenticatedAdmin = false;
  const authHeader = headers.get("Authorization") || headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (supabaseUrl && (supabaseServiceKey || supabaseAnonKey)) {
      try {
        const client = options?.supabaseClientOverride || createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey!);
        const { data: { user }, error: authError } = await client.auth.getUser(token);
        if (user && !authError) {
          isAuthenticatedAdmin = true;
          console.log(`[Omnichannel Engine] Authenticated admin session accepted: ${user.email} (${user.id})`);
        }
      } catch (err: any) {
        console.warn("[Omnichannel Engine] JWT verification error:", err?.message || err);
      }
    }
  }

  // 3. If NOT authenticated by JWT, enforce strict S2S HMAC Authentication
  let requestIdHeader = headers.get("X-Omnichannel-Request-Id") || "";

  if (!isAuthenticatedAdmin) {
    const versionHeader = headers.get("X-Omnichannel-Version");
    const timestampHeader = headers.get("X-Omnichannel-Timestamp");
    const signatureHeader = headers.get("X-Omnichannel-Signature");

    if (!versionHeader || !requestIdHeader || !timestampHeader || !signatureHeader) {
      return {
        status: 401,
        body: { error: "Unauthorized: Missing required X-Omnichannel headers or valid Authorization Bearer token." }
      };
    }

    if (versionHeader !== PROTOCOL_VERSION) {
      return {
        status: 400,
        body: { error: `Bad Request: Unsupported protocol version "${versionHeader}". Expected "${PROTOCOL_VERSION}".` }
      };
    }

    // Validate Timestamp Window (±300 seconds)
    const timestampNum = parseInt(timestampHeader, 10);
    if (isNaN(timestampNum) || timestampNum.toString() !== timestampHeader) {
      return {
        status: 401,
        body: { error: "Unauthorized: Invalid X-Omnichannel-Timestamp format. Must be Unix seconds ASCII." }
      };
    }

    const currentEpochSec = Math.floor(Date.now() / 1000);
    const timeDrift = Math.abs(currentEpochSec - timestampNum);
    if (timeDrift > TIMESTAMP_TOLERANCE_SECONDS) {
      return {
        status: 401,
        body: { error: `Unauthorized: Timestamp outside acceptable window (drift: ${timeDrift}s, max: ${TIMESTAMP_TOLERANCE_SECONDS}s).` }
      };
    }

    // Resolve Secret (FAIL CLOSED in production if not set)
    const secret = options?.secretOverride || Deno.env.get("OMNICHANNEL_ANSWER_ENGINE_SECRET");
    if (!secret) {
      console.error("[Omnichannel Answer Engine] FAIL-CLOSED: OMNICHANNEL_ANSWER_ENGINE_SECRET is not configured.");
      return {
        status: 500,
        body: { error: "Internal Server Error: Authentication configuration unavailable." }
      };
    }

    // Verify Signature Format: "v1=<hex>"
    if (!signatureHeader.startsWith("v1=")) {
      return {
        status: 401,
        body: { error: "Unauthorized: Invalid signature format. Expected 'v1=<hex>'." }
      };
    }
    const providedHex = signatureHeader.substring(3).toLowerCase();

    // Compute Expected Signature over raw UTF-8 body bytes
    const decoder = new TextDecoder("utf-8");
    const rawBodyText = decoder.decode(rawBody);
    const canonicalPayload = `${timestampHeader}\n${requestIdHeader}\n${rawBodyText}`;
    const expectedHex = await computeHmacSha256Hex(secret, canonicalPayload);

    if (!constantTimeCompare(providedHex, expectedHex)) {
      return {
        status: 401,
        body: { error: "Unauthorized: HMAC signature verification failed." }
      };
    }
  }

  // 4. Parse JSON Body
  const decoder = new TextDecoder("utf-8");
  const rawBodyText = decoder.decode(rawBody);
  let parsedPayload: any;
  try {
    parsedPayload = JSON.parse(rawBodyText || "{}");
  } catch (_e) {
    return {
      status: 400,
      body: { error: "Bad Request: Malformed JSON body." }
    };
  }

  // Auto-generate or reconcile request_id for authenticated admin requests
  if (!requestIdHeader) {
    requestIdHeader = parsedPayload.request_id || crypto.randomUUID();
  } else if (!parsedPayload.request_id) {
    parsedPayload.request_id = requestIdHeader;
  } else if (!isAuthenticatedAdmin && parsedPayload.request_id !== requestIdHeader) {
    return {
      status: 400,
      body: { error: "Bad Request: Header X-Omnichannel-Request-Id must match body request_id." }
    };
  }

  // Check if this is an Admin Broadcast Campaign Dispatch
  if (parsedPayload.action?.startsWith("broadcast") || parsedPayload.record) {
    const campaignId = parsedPayload.campaign_id || parsedPayload.record?.id || requestIdHeader;
    const channelName = (parsedPayload.channel || parsedPayload.record?.channel || "omnichannel").toLowerCase();
    const targets = parsedPayload.total_targeted || parsedPayload.record?.total_targeted || 1;
    const title = parsedPayload.title || parsedPayload.record?.title || "Comunicado Oficial";
    const msgText = parsedPayload.message || parsedPayload.record?.message_template || "";
    const targetType = parsedPayload.target_type || parsedPayload.record?.target_type || "broadcast";
    const individualRecipient = parsedPayload.individual_recipient || parsedPayload.record?.individual_recipient || "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const client = options?.supabaseClientOverride || (supabaseUrl && (supabaseServiceKey || supabaseAnonKey)
      ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey!)
      : null);

    // --- CHANNEL 1: RESEND (Email & Omnichannel Agent default) ---
    if (channelName === "omnichannel" || channelName === "email") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "UBT Notificações <notificacoes@ubtservicos.com.br>";

      if (!resendApiKey) {
        const errorMsg = "Configuração Ausente: A secret RESEND_API_KEY não foi configurada nas Secrets do Supabase para o envio de e-mails.";
        console.error("[Omnichannel Provider Error - Resend]", errorMsg);
        return {
          status: 502,
          body: {
            error: errorMsg,
            provider: "resend",
            channel: channelName,
            status: "configuration_error"
          }
        };
      }

      // Resolve recipient emails
      let toRecipients: string[] = [];
      if (targetType === "individual" && individualRecipient && individualRecipient.includes("@")) {
        toRecipients = [individualRecipient.trim()];
      } else if (client) {
        try {
          const { data: users } = await client.from("usuarios").select("email").not("email", "is", null).limit(20);
          if (users && users.length > 0) {
            toRecipients = users.map((u: any) => u.email).filter(Boolean);
          }
        } catch (dbErr: any) {
          console.warn("[Omnichannel Engine] Aviso ao consultar destinatários do banco:", dbErr?.message || dbErr);
        }
      }

      if (toRecipients.length === 0) {
        toRecipients = ["ubt.servicos@gmail.com"];
      }

      const emailPayload = {
        from: resendFromEmail,
        to: toRecipients,
        subject: `[UBT Oficial] ${title}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 16px;">
              <div style="background: #0DB87E; color: #000; font-weight: 900; width: 32px; height: 32px; border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px;">U</div>
              <div>
                <h2 style="margin: 0; font-size: 16px; color: #ffffff;">UBT Central de Notificações</h2>
                <span style="font-size: 11px; color: #a1a1aa;">Comunicado Oficial via Omnichannel Agent</span>
              </div>
            </div>
            <h3 style="color: #0DB87E; font-size: 18px; margin-top: 0;">${title}</h3>
            <div style="font-size: 14px; line-height: 1.6; color: #e4e4e7; background: #18181b; padding: 16px; border-radius: 12px; border: 1px solid #27272a; white-space: pre-wrap;">
              ${msgText}
            </div>
            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #27272a; text-align: center; font-size: 11px; color: #71717a;">
              UBT Serviços • Ubatuba - SP • Autenticado via Protocolo v1 HMAC
            </div>
          </div>
        `,
        text: `${title}\n\n${msgText}\n\nUBT Serviços - Ubatuba SP`
      };

      console.log(`[Omnichannel Engine] Disparando e-mail via Resend API para ${toRecipients.length} destinatários...`);

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(emailPayload)
      });

      const responseBody = await resendResponse.text();

      if (!resendResponse.ok) {
        console.error(`[Omnichannel Provider Error - Resend HTTP ${resendResponse.status}]:`, responseBody);
        return {
          status: 502,
          body: {
            error: `Falha na API da Resend (HTTP ${resendResponse.status}): ${responseBody}`,
            provider: "resend",
            channel: channelName,
            http_status: resendResponse.status
          }
        };
      }

      let parsedResend: any = {};
      try {
        parsedResend = JSON.parse(responseBody);
      } catch (_) {
        parsedResend = { raw: responseBody };
      }

      console.log("[Omnichannel Engine] E-mail enviado com sucesso via Resend:", parsedResend);

      return {
        status: 200,
        body: {
          version: PROTOCOL_VERSION,
          request_id: requestIdHeader,
          status: "answered",
          campaign_id: campaignId,
          channel: channelName,
          provider: "resend",
          external_id: parsedResend.id,
          total_targeted: targets,
          dispatched_at: new Date().toISOString(),
          answer: `Transmissão por e-mail entregue com sucesso via Resend (ID: ${parsedResend.id || "ok"}).`,
          citation_references: [],
          runtime_evidence: []
        }
      };
    }

    // --- CHANNEL 2: WHATSAPP ---
    if (channelName === "whatsapp") {
      const whatsappApiUrl = Deno.env.get("WHATSAPP_API_URL") || Deno.env.get("EVOLUTION_API_URL");
      const whatsappToken = Deno.env.get("WHATSAPP_API_TOKEN") || Deno.env.get("WHATSAPP_TOKEN") || Deno.env.get("EVOLUTION_API_KEY");

      if (!whatsappApiUrl || !whatsappToken) {
        const errorMsg = "Configuração Ausente: WHATSAPP_API_URL ou WHATSAPP_API_TOKEN não configurados no Supabase Secrets.";
        console.error("[Omnichannel Provider Error - WhatsApp]", errorMsg);
        return {
          status: 502,
          body: {
            error: errorMsg,
            provider: "whatsapp",
            channel: channelName,
            status: "configuration_error"
          }
        };
      }

      const targetPhone = (individualRecipient ? individualRecipient.replace(/\D/g, "") : "");
      if (!targetPhone) {
        const errorMsg = "WhatsApp Delivery Error: Nenhum número de telefone válido fornecido.";
        console.error("[Omnichannel Provider Error - WhatsApp]", errorMsg);
        return {
          status: 400,
          body: { error: errorMsg, provider: "whatsapp" }
        };
      }

      const waResponse = await fetch(whatsappApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${whatsappToken}`,
          "apikey": whatsappToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          number: targetPhone,
          text: `*${title}*\n\n${msgText}\n\n_UBT Notificações Oficiais_`
        })
      });

      const responseBody = await waResponse.text();
      if (!waResponse.ok) {
        console.error(`[Omnichannel Provider Error - WhatsApp HTTP ${waResponse.status}]:`, responseBody);
        return {
          status: 502,
          body: {
            error: `Falha na API de WhatsApp (HTTP ${waResponse.status}): ${responseBody}`,
            provider: "whatsapp"
          }
        };
      }

      return {
        status: 200,
        body: {
          version: PROTOCOL_VERSION,
          request_id: requestIdHeader,
          status: "answered",
          campaign_id: campaignId,
          channel: channelName,
          provider: "whatsapp",
          total_targeted: targets,
          dispatched_at: new Date().toISOString(),
          answer: `Mensagem WhatsApp disparada com sucesso para ${targetPhone}.`,
          citation_references: [],
          runtime_evidence: []
        }
      };
    }

    // --- CHANNEL 3: SMS ---
    if (channelName === "sms") {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

      if (!twilioSid || !twilioAuthToken || !twilioFrom) {
        const errorMsg = "Configuração Ausente: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN ou TWILIO_FROM_NUMBER não configurados nas Secrets.";
        console.error("[Omnichannel Provider Error - Twilio]", errorMsg);
        return {
          status: 502,
          body: {
            error: errorMsg,
            provider: "twilio",
            channel: channelName,
            status: "configuration_error"
          }
        };
      }

      const targetPhone = individualRecipient.replace(/\D/g, "");
      const bodyParams = new URLSearchParams();
      bodyParams.append("To", targetPhone.startsWith("+") ? targetPhone : `+55${targetPhone}`);
      bodyParams.append("From", twilioFrom);
      bodyParams.append("Body", `${title}: ${msgText}`);

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: bodyParams.toString()
      });

      const responseBody = await twilioRes.text();
      if (!twilioRes.ok) {
        console.error(`[Omnichannel Provider Error - Twilio HTTP ${twilioRes.status}]:`, responseBody);
        return {
          status: 502,
          body: {
            error: `Falha na API do Twilio SMS (HTTP ${twilioRes.status}): ${responseBody}`,
            provider: "twilio"
          }
        };
      }

      return {
        status: 200,
        body: {
          version: PROTOCOL_VERSION,
          request_id: requestIdHeader,
          status: "answered",
          campaign_id: campaignId,
          channel: channelName,
          provider: "twilio",
          total_targeted: targets,
          dispatched_at: new Date().toISOString(),
          answer: `SMS transmitido com sucesso via Twilio.`,
          citation_references: [],
          runtime_evidence: []
        }
      };
    }

    // --- CHANNEL 4: PUSH / IN-APP ---
    console.log(`[Omnichannel Engine] Broadcast In-App/Push registrado com sucesso para campanha ${campaignId}`);
    return {
      status: 200,
      body: {
        version: PROTOCOL_VERSION,
        request_id: requestIdHeader,
        status: "answered",
        campaign_id: campaignId,
        channel: channelName,
        provider: "in_app",
        total_targeted: targets,
        dispatched_at: new Date().toISOString(),
        answer: `Transmissão In-App/Push registrada com sucesso no feed para ${targets} destinatários.`,
        citation_references: [],
        runtime_evidence: []
      }
    };
  }

  // 8. Enforce Request Limits
  // History limits
  if (parsedPayload.history) {
    if (parsedPayload.history.length > MAX_HISTORY_MESSAGES) {
      return {
        status: 413,
        body: { error: `Payload Too Large: History exceeds ${MAX_HISTORY_MESSAGES} messages limit.` }
      };
    }
    const historyChars = parsedPayload.history.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
    if (historyChars > MAX_HISTORY_CHARS) {
      return {
        status: 413,
        body: { error: `Payload Too Large: History exceeds ${MAX_HISTORY_CHARS} characters limit.` }
      };
    }
  }

  // Knowledge limits
  if (parsedPayload.knowledge?.sources) {
    const knowledgeChars = parsedPayload.knowledge.sources.reduce((acc, s) => acc + (s.content?.length || 0), 0);
    if (knowledgeChars > MAX_KNOWLEDGE_CHARS) {
      return {
        status: 413,
        body: { error: `Payload Too Large: Knowledge context exceeds ${MAX_KNOWLEDGE_CHARS} characters limit.` }
      };
    }
  }

  // 9. Replay Protection (Atomic Store in PostgreSQL)
  if (!options?.skipReplayPersistence) {
    const supabaseClient = options?.supabaseClientOverride || (() => {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
      }
      return null;
    })();

    if (supabaseClient) {
      const expiresAt = new Date(Date.now() + REPLAY_TTL_MINUTES * 60 * 1000).toISOString();
      const { error: replayError } = await supabaseClient
        .from("omnichannel_replay_store")
        .insert({
          request_id: requestIdHeader,
          expires_at: expiresAt
        });

      if (replayError) {
        // Unique constraint violation (23505) = Replay Attack
        if (replayError.code === "23505" || replayError.message?.includes("duplicate") || replayError.message?.includes("unique")) {
          return {
            status: 409,
            body: { error: "Conflict: Request already processed or duplicate request_id detected." }
          };
        }
        console.warn("[Omnichannel Answer Engine] Non-blocking replay store check error:", replayError.message);
      }
    }
  }

  // 10. Deadline Validation
  if (parsedPayload.deadline_at) {
    const deadlineTime = new Date(parsedPayload.deadline_at).getTime();
    if (isNaN(deadlineTime)) {
      return {
        status: 400,
        body: { error: "Bad Request: Invalid deadline_at format. Must be ISO-8601 UTC." }
      };
    }
    if (deadlineTime < Date.now()) {
      return {
        status: 200,
        body: {
          version: PROTOCOL_VERSION,
          request_id: requestIdHeader,
          status: "temporarily_unavailable",
          answer: "O prazo estipulado na requisição expirou antes da conclusão do processamento.",
          citation_references: [],
          runtime_evidence: []
        }
      };
    }
  }

  // 11. Deterministic Engine (6 Controlled Scenarios)
  const messageText = typeof parsedPayload.message === "string" 
    ? parsedPayload.message 
    : (parsedPayload.message?.text || "");

  const normalizedQuery = messageText.toLowerCase().trim();

  // --- Scenario F: Timeout Simulation ---
  if (normalizedQuery.includes("sandbox_timeout")) {
    await new Promise((r) => setTimeout(r, 3500));
    const response: AnswerEngineResponse = {
      version: PROTOCOL_VERSION,
      request_id: requestIdHeader,
      status: "answered",
      answer: "Simulação de timeout controlada concluída com sucesso após delay de 3.5 segundos.",
      citation_references: [],
      runtime_evidence: []
    };
    logSafeMetrics(requestIdHeader, "scenario_timeout", response.status, Date.now() - startTime);
    return { status: 200, body: response };
  }

  // --- Scenario E: Temporarily Unavailable ---
  if (normalizedQuery.includes("sandbox_unavailable") || parsedPayload.context?.simulate_unavailable === true) {
    const response: AnswerEngineResponse = {
      version: PROTOCOL_VERSION,
      request_id: requestIdHeader,
      status: "temporarily_unavailable",
      answer: "O Serviço de Atendimento ao Usuário está temporariamente indisponível no momento. Por favor, tente novamente em alguns instantes.",
      citation_references: [],
      runtime_evidence: []
    };
    logSafeMetrics(requestIdHeader, "scenario_unavailable", response.status, Date.now() - startTime);
    return { status: 200, body: response };
  }

  // --- Scenario C: Transactional Live State ($R^*$) ---
  if (
    normalizedQuery.includes("sandbox_order_status") || 
    normalizedQuery.includes("status do pedido") || 
    normalizedQuery.includes("status da corrida")
  ) {
    const toolKey = "sandbox_order_status";
    if (!ALLOWED_RUNTIME_TOOLS.includes(toolKey)) {
      return {
        status: 400,
        body: { error: `Bad Request: Tool key '${toolKey}' not allowed by sandbox policy.` }
      };
    }

    const liveEvidence: RuntimeEvidence = {
      reference: "R1",
      kind: "runtime_tool",
      tool_key: toolKey,
      label: "Status Operacional do Pedido",
      observed_at: new Date().toISOString()
    };

    // Note: Live transactional state is authoritative: order status is "pending".
    const response: AnswerEngineResponse = {
      version: PROTOCOL_VERSION,
      request_id: requestIdHeader,
      status: "answered",
      answer: "Identificamos o seu pedido em andamento (R1). O status atual é: 'pending' (mototáxi a caminho, previsão de chegada em 12 minutos).",
      citation_references: ["R1"],
      runtime_evidence: [liveEvidence]
    };
    logSafeMetrics(requestIdHeader, "scenario_runtime_evidence", response.status, Date.now() - startTime);
    return { status: 200, body: response };
  }

  // --- Scenario B: Errata Precedence ($E^* > S^*$) ---
  const sources = parsedPayload.knowledge?.sources ?? [];
  const erratas = sources.filter((source) => source?.is_errata === true);

  if (erratas.length > 0) {
    const primaryErrata = erratas[0];
    const primaryErrataRef = primaryErrata?.reference;
    if (
      typeof primaryErrataRef === "string" &&
      /^E[1-9]\d*$/.test(primaryErrataRef.trim())
    ) {
      const cleanRef = primaryErrataRef.trim();
      const response: AnswerEngineResponse = {
        version: PROTOCOL_VERSION,
        request_id: requestIdHeader,
        status: "answered",
        answer: `Conforme a atualização e errata oficial recente (${cleanRef}): ${primaryErrata.content}`,
        citation_references: [cleanRef],
        runtime_evidence: []
      };
      logSafeMetrics(requestIdHeader, "scenario_errata_precedence", response.status, Date.now() - startTime);
      return { status: 200, body: response };
    }
  }

  // --- Scenario A: Answered from Governed Knowledge ($S^*$) ---
  const standardSources = sources.filter((source) => !source?.is_errata);
  if (standardSources.length > 0) {
    const primarySource = standardSources[0];
    const primaryReference = primarySource?.reference;
    if (
      typeof primaryReference === "string" &&
      /^S[1-9]\d*$/.test(primaryReference.trim())
    ) {
      const cleanRef = primaryReference.trim();
      const response: AnswerEngineResponse = {
        version: PROTOCOL_VERSION,
        request_id: requestIdHeader,
        status: "answered",
        answer: `De acordo com as diretrizes e base de conhecimento oficial (${cleanRef}): ${primarySource.content}`,
        citation_references: [cleanRef],
        runtime_evidence: []
      };
      logSafeMetrics(requestIdHeader, "scenario_source_knowledge", response.status, Date.now() - startTime);
      return { status: 200, body: response };
    }
  }

  // --- Scenario D: Insufficient Knowledge ---
  const response: AnswerEngineResponse = {
    version: PROTOCOL_VERSION,
    request_id: requestIdHeader,
    status: "insufficient_knowledge",
    answer: "Não encontramos informações institucionais ou diretrizes suficientes na Base de Conhecimento para responder com precisão ao seu questionamento.",
    citation_references: [],
    runtime_evidence: []
  };
  logSafeMetrics(requestIdHeader, "scenario_insufficient", response.status, Date.now() - startTime);
  return { status: 200, body: response };
}

// ==============================================================================
// SAFE STRUCTURED LOGGING
// ==============================================================================
function logSafeMetrics(requestId: string, scenario: string, status: string, durationMs: number) {
  console.log(
    JSON.stringify({
      component: "omnichannel_answer_engine_v1",
      request_id: requestId,
      scenario,
      status,
      duration_ms: durationMs,
      timestamp_utc: new Date().toISOString()
    })
  );
}

// ==============================================================================
// HTTP SERVER LISTENER
// ==============================================================================
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed. Use POST." }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }

  try {
    const arrayBuffer = await req.arrayBuffer();
    const rawBody = new Uint8Array(arrayBuffer);

    const result = await processAnswerEngineRequest(req.headers, rawBody);

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Omnichannel-Version": PROTOCOL_VERSION
      }
    });
  } catch (err: any) {
    console.error("[Omnichannel Answer Engine] Unhandled server error:", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
