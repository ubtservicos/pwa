/**
 * UBT-PAY-006: checkout universal com tokenização PCI via MercadoPago.js Fields.
 * Somente o CardToken deixa o navegador; PAN, validade e CVV nunca são enviados à UBT.
 */

import { useEffect, useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/utils/ride";
import type { CheckoutUniversalProps } from "./types";

interface MpField {
  mount: (containerId: string) => MpField;
  unmount: () => void;
  on: (event: string, callback: (event: { bin?: string | null }) => void) => MpField;
}

interface CardTokenResponse {
  id: string;
  first_six_digits?: string;
  live_mode?: boolean;
}

interface MercadoPagoInstance {
  fields: {
    create: (type: "cardNumber" | "expirationDate" | "securityCode", options: Record<string, unknown>) => MpField;
    createCardToken: (input: {
      cardholderName: string;
      identificationType?: string;
      identificationNumber?: string;
    }) => Promise<CardTokenResponse | undefined>;
  };
  getPaymentMethods: (input: { bin: string }) => Promise<{ results?: Array<{ id?: string }> }>;
}

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string; advancedFraudPrevention?: boolean },
    ) => MercadoPagoInstance;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function collectErrorParts(value: unknown, depth = 0): string[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (value instanceof Error) return value.message ? [value.message] : [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number") return [String(value)];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectErrorParts(item, depth + 1));
  }
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["message", "description", "error_description", "error"]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) parts.push(item.trim());
  }
  if (typeof record.code === "string" || typeof record.code === "number") {
    parts.push(`código ${String(record.code)}`);
  }
  for (const key of ["cause", "causes", "details"]) {
    parts.push(...collectErrorParts(record[key], depth + 1));
  }
  return parts;
}

function checkoutErrorMessage(error: unknown, fallback = "Erro no processamento do pagamento."): string {
  const unique = [...new Set(collectErrorParts(error).map((part) => part.slice(0, 500)))];
  return unique.join(": ") || fallback;
}

function checkoutEnvironment(): "sandbox" | "production" {
  const value = String(import.meta.env.VITE_MP_ENVIRONMENT || "sandbox").trim().toLowerCase();
  if (value !== "sandbox" && value !== "production") {
    throw new Error("VITE_MP_ENVIRONMENT deve ser 'sandbox' ou 'production'.");
  }
  return value;
}

function resolvePayerIdentity(
  environment: "sandbox" | "production",
  sessionEmail: string,
  sessionCpf: string,
): { email: string; cpf: string } {
  if (environment === "sandbox") {
    const email = String(import.meta.env.VITE_MP_TEST_PAYER_EMAIL || "").trim().toLowerCase();
    if (email && (!EMAIL_RE.test(email) || !email.endsWith("@testuser.com"))) {
      throw new Error(
        "VITE_MP_TEST_PAYER_EMAIL deve conter um Buyer Test User válido quando configurado.",
      );
    }
    return {
      email,
      cpf: String(import.meta.env.VITE_MP_TEST_PAYER_CPF || "12345678909").replace(/\D/g, ""),
    };
  }

  const email = sessionEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.endsWith("@testuser.com")) {
    throw new Error("O e-mail do pagador autenticado é inválido para produção.");
  }
  return { email, cpf: sessionCpf };
}

async function tokenizeCard(
  mp: MercadoPagoInstance,
  cardholderName: string,
  cpf: string,
  detectedBin: string,
  environment: "sandbox" | "production",
): Promise<{ token: string; paymentMethodId: string }> {
  let cardToken: CardTokenResponse | undefined;
  try {
    cardToken = await mp.fields.createCardToken({
      cardholderName,
      ...(cpf ? { identificationType: "CPF", identificationNumber: cpf } : {}),
    });
  } catch (error) {
    throw new Error(checkoutErrorMessage(error, "O Mercado Pago não conseguiu tokenizar o cartão."));
  }
  if (!cardToken?.id) throw new Error("O Mercado Pago não retornou um CardToken válido.");
  if (typeof cardToken.live_mode === "boolean" && cardToken.live_mode !== (environment === "production")) {
    throw new Error("A Public Key do Mercado Pago pertence a outro ambiente.");
  }

  const bin = detectedBin || cardToken.first_six_digits || "";
  if (!/^\d{6,8}$/.test(bin)) throw new Error("Não foi possível identificar a bandeira do cartão.");
  let methods: { results?: Array<{ id?: string }> };
  try {
    methods = await mp.getPaymentMethods({ bin });
  } catch (error) {
    throw new Error(checkoutErrorMessage(error, "O Mercado Pago não reconheceu o meio de pagamento."));
  }
  const paymentMethodId = methods.results?.[0]?.id;
  if (!paymentMethodId) throw new Error("Meio de pagamento não reconhecido pelo Mercado Pago.");
  return { token: cardToken.id, paymentMethodId };
}

async function invokeErrorMessage(error: unknown): Promise<string> {
  const fallback = checkoutErrorMessage(error, "Pagamento rejeitado pelo gateway");
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.clone !== "function") return fallback;
  try {
    const payload = await context.clone().json();
    return checkoutErrorMessage(payload, fallback);
  } catch {
    return fallback;
  }
}

export default function CheckoutUniversal({
  amount,
  providerId,
  providerName,
  serviceType,
  serviceId,
  metadata,
  onSuccess,
  onError,
}: CheckoutUniversalProps) {
  const [cardHolder, setCardHolder] = useState(() => {
    try {
      return checkoutEnvironment() === "sandbox" ? "APRO" : "";
    } catch {
      return "";
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mpRef = useRef<MercadoPagoInstance | null>(null);
  const binRef = useRef("");

  useEffect(() => {
    let disposed = false;
    const mountedFields: MpField[] = [];
    setFieldsReady(false);
    mpRef.current = null;
    binRef.current = "";

    const initializeFields = async () => {
      const platformPublicKey = String(import.meta.env.VITE_MP_PUBLIC_KEY || "").trim();
      if (!window.MercadoPago) throw new Error("MercadoPago.js não pôde ser carregado.");

      const { data: checkoutConfig, error: configError } = await supabase.functions.invoke("payment-gateway", {
        body: { action: "get_checkout_config", provider_id: providerId },
      });
      if (configError) throw new Error(await invokeErrorMessage(configError));
      if (!checkoutConfig?.success) {
        throw new Error(checkoutErrorMessage(checkoutConfig, "Não foi possível configurar o checkout."));
      }

      const publicKey = String(checkoutConfig.public_key || platformPublicKey).trim();
      if (!publicKey) throw new Error("Public Key do Mercado Pago não está configurada para esta rota.");
      if (disposed) return;

      const mp = new window.MercadoPago(publicKey, {
        locale: "pt-BR",
        advancedFraudPrevention: true,
      });
      mpRef.current = mp;
      const fieldStyle = {
        color: "#ffffff",
        fontSize: "14px",
        fontFamily: "DM Sans, sans-serif",
        placeholderColor: "rgba(255,255,255,0.35)",
        height: "44px",
      };
      const cardNumber = mp.fields.create("cardNumber", {
        placeholder: "0000 0000 0000 0000",
        style: fieldStyle,
        ariaRequired: true,
      }).mount("mp-card-number");
      const expirationDate = mp.fields.create("expirationDate", {
        placeholder: "MM/AA",
        style: fieldStyle,
        mode: "short",
        ariaRequired: true,
      }).mount("mp-expiration-date");
      const securityCode = mp.fields.create("securityCode", {
        placeholder: "CVV",
        style: fieldStyle,
        ariaRequired: true,
      }).mount("mp-security-code");
      mountedFields.push(cardNumber, expirationDate, securityCode);

      cardNumber.on("binChange", ({ bin }) => {
        binRef.current = bin || "";
      });
      cardNumber.on("ready", () => {
        if (!disposed) setFieldsReady(true);
      });
    };

    void initializeFields().catch((caught) => {
      if (!disposed) setError(checkoutErrorMessage(caught, "Falha ao inicializar o checkout do Mercado Pago."));
    });

    return () => {
      disposed = true;
      setFieldsReady(false);
      mpRef.current = null;
      for (const field of mountedFields) {
        try {
          field.unmount();
        } catch {
          // MercadoPago.js may already have removed an iframe during navigation.
        }
      }
    };
  }, [providerId]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    const paymentAttemptId = crypto.randomUUID();

    try {
      const mp = mpRef.current;
      if (!mp || !fieldsReady) throw new Error("Os campos seguros do Mercado Pago ainda não estão prontos.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor de pagamento inválido.");

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Sua sessão expirou. Entre novamente antes de pagar.");
      const userCpf = String(
        (session.user.user_metadata as Record<string, unknown>)?.cpf || "",
      ).replace(/\D/g, "");
      const environment = checkoutEnvironment();
      const payerIdentity = resolvePayerIdentity(environment, session.user.email || "", userCpf);
      const cardholderName = cardHolder.trim();
      if (!cardholderName) throw new Error("Informe o nome do titular do cartão.");

      const { token, paymentMethodId } = await tokenizeCard(
        mp,
        cardholderName,
        payerIdentity.cpf,
        binRef.current,
        environment,
      );
      const nameParts = cardholderName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ");
      const resolvedServiceId = serviceId || crypto.randomUUID();
      const finalAmount = Number(amount.toFixed(2));

      const payload = {
        action: "create_payment_intent",
        payment_attempt_id: paymentAttemptId,
        service_type: serviceType,
        service_id: resolvedServiceId,
        transaction_amount: finalAmount,
        provider_id: providerId,
        provider_name: providerName || undefined,
        ...(payerIdentity.email ? { payer_email: payerIdentity.email } : {}),
        payer: {
          ...(payerIdentity.email ? { email: payerIdentity.email } : {}),
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {}),
          ...(payerIdentity.cpf
            ? { identification: { type: "CPF", number: payerIdentity.cpf } }
            : {}),
        },
        description: `Serviço UBT ${serviceType} - ${formatBRL(finalAmount)}`,
        payment_method_id: paymentMethodId,
        card_token: token,
        installments: 1,
        metadata: metadata || {},
      };

      console.info("[CheckoutUniversal] Enviando tentativa tokenizada", {
        payment_attempt_id: paymentAttemptId,
        service_type: serviceType,
        service_id: resolvedServiceId,
        provider_id: providerId,
        amount: finalAmount,
        environment,
      });

      const { data, error: invokeError } = await supabase.functions.invoke("payment-gateway", {
        body: payload,
      });
      if (invokeError) throw new Error(await invokeErrorMessage(invokeError));
      if (!data || data.success === false || data.error) {
        const details = Array.isArray(data?.details)
          ? data.details.map((item: { description?: string }) => item.description).filter(Boolean).join("; ")
          : "";
        throw new Error([data?.message || data?.error || "Pagamento rejeitado", details].filter(Boolean).join(": "));
      }

      onSuccess(data);
    } catch (caught: unknown) {
      const message = checkoutErrorMessage(caught);
      console.error("[CheckoutUniversal] Falha na tentativa", { payment_attempt_id: paymentAttemptId, message });
      setError(message);
      onError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl p-4 bg-white/5 border border-white/10 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="font-sans text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
          <CreditCard size={14} />
          Cartão de Crédito
        </span>
        <span className="text-[10px] text-white/40">Campos seguros Mercado Pago</span>
      </div>

      <div>
        <label className="block font-sans text-[11px] text-white/60 mb-1" htmlFor="mp-card-number">
          Número do cartão
        </label>
        <div id="mp-card-number" className="w-full h-11 rounded-xl px-3 bg-black/30 border border-white/10" />
      </div>

      <div>
        <label className="block font-sans text-[11px] text-white/60 mb-1" htmlFor="cardholder-name">
          Nome no cartão
        </label>
        <input
          id="cardholder-name"
          type="text"
          value={cardHolder}
          onChange={(event) => setCardHolder(event.target.value.toUpperCase())}
          placeholder={checkoutEnvironment() === "sandbox" ? "APRO" : "NOME COMO NO CARTÃO"}
          autoComplete="cc-name"
          className="w-full h-11 rounded-xl px-3 bg-black/30 border border-white/10 text-white font-sans text-[13px] uppercase outline-none focus:border-[#0DB87E]"
        />
        {checkoutEnvironment() === "sandbox" && (
          <p className="mt-1 text-[10px] text-amber-300/80">
            Sandbox: use APRO para simular aprovação e CPF 12345678909.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block font-sans text-[11px] text-white/60 mb-1" htmlFor="mp-expiration-date">
            Validade
          </label>
          <div id="mp-expiration-date" className="w-full h-11 rounded-xl px-3 bg-black/30 border border-white/10" />
        </div>
        <div>
          <label className="block font-sans text-[11px] text-white/60 mb-1" htmlFor="mp-security-code">
            CVV
          </label>
          <div id="mp-security-code" className="w-full h-11 rounded-xl px-3 bg-black/30 border border-white/10" />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium flex items-center justify-between gap-2">
          <span>⚠️ {error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs px-1">
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={isLoading || !fieldsReady}
        onClick={handleSubmit}
        className="mt-3 w-full h-12 rounded-xl font-display font-semibold text-white flex items-center justify-center bg-[#0DB87E] active:scale-[0.98] transition-all disabled:cursor-not-allowed"
        style={{ opacity: isLoading || !fieldsReady ? 0.7 : 1 }}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin" />
        ) : !fieldsReady ? (
          "Carregando pagamento seguro..."
        ) : (
          `Pagar com Cartão (${formatBRL(amount)})`
        )}
      </button>
    </div>
  );
}
