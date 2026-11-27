/**
 * UBT-PAY-006: checkout universal com tokenização PCI via MercadoPago.js Fields
 * e suporte à Wallet de Cartões Salvos (/v1/customers e /v1/customers/{id}/cards).
 * Somente o CardToken deixa o navegador; PAN, validade e CVV nunca são enviados à UBT.
 */

import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, Plus, Trash2, Wallet } from "lucide-react";
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

interface SavedWalletCard {
  id: string;
  last_four_digits: string;
  first_six_digits: string;
  expiration_month: number | null;
  expiration_year: number | null;
  payment_method: {
    id: string;
    name: string;
    thumbnail: string | null;
  };
  cardholder: {
    name: string;
  };
}

interface MercadoPagoInstance {
  fields: {
    create: (type: "cardNumber" | "expirationDate" | "securityCode", options: Record<string, unknown>) => MpField;
    createCardToken: (input: {
      cardholderName?: string;
      identificationType?: string;
      identificationNumber?: string;
      cardId?: string;
      securityCode?: string;
    }) => Promise<CardTokenResponse | undefined>;
  };
  createCardToken?: (input: {
    cardId: string;
    securityCode: string;
  }) => Promise<CardTokenResponse | undefined>;
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

function translateRejectionDetail(detail: string): string | null {
  switch (detail) {
    case "cc_rejected_insufficient_amount":
      return "Cartão sem saldo suficiente para concluir o pagamento.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade do cartão incorreta.";
    case "cc_rejected_bad_filled_other":
      return "Revise os dados informados do cartão.";
    case "cc_rejected_call_for_authorize":
      return "Autorize o pagamento junto ao banco emissor do cartão.";
    case "cc_rejected_card_disabled":
      return "Cartão desabilitado. Entre em contato com o emissor.";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado detectado. Aguarde antes de tentar novamente.";
    case "cc_rejected_high_risk":
      return "Pagamento recusado por análise de segurança do Mercado Pago.";
    case "cc_rejected_max_attempts":
      return "Limite de tentativas excedido para este cartão.";
    case "cc_rejected_other_reason":
      return "Pagamento recusado pela operadora do cartão. Tente outro cartão ou Pix.";
    default:
      if (detail.startsWith("cc_rejected_bad_filled_")) {
        if (detail.endsWith("_code")) {
          return "Código de segurança (CVV) inválido. Verifique e tente novamente.";
        }
        if (detail.endsWith("_number")) {
          return "Número do cartão inválido. Confira os dígitos.";
        }
      }
      return null;
  }
}

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
  if (typeof record.status_detail === "string") {
    const translated = translateRejectionDetail(record.status_detail);
    if (translated) parts.push(translated);
  }
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

function checkoutEnvironment(serverOverride?: string | null): "sandbox" | "production" {
  const explicit = String(import.meta.env.VITE_MP_ENVIRONMENT || "").trim().toLowerCase();
  if (explicit === "sandbox" || explicit === "production") return explicit;
  const fromServer = String(serverOverride || "").trim().toLowerCase();
  if (fromServer === "sandbox" || fromServer === "production") return fromServer;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.includes("homologacao") ||
      host.endsWith(".vercel.app")
    ) {
      return "sandbox";
    }
  }
  return "production";
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

async function tokenizeNewCard(
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
  // In production, block test-only tokens; in sandbox, both APP_USR- and TEST- test credentials are accepted.
  if (environment === "production" && cardToken.live_mode === false) {
    throw new Error("A Public Key do Mercado Pago pertence ao ambiente Sandbox.");
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

async function tokenizeSavedCard(
  mp: MercadoPagoInstance,
  cardId: string,
  cvv: string,
  environment: "sandbox" | "production",
): Promise<string> {
  const cleanCvv = cvv.replace(/\D/g, "");
  if (cleanCvv.length < 3 || cleanCvv.length > 4) {
    throw new Error("Informe o código de segurança (CVV) de 3 ou 4 dígitos.");
  }
  let cardToken: CardTokenResponse | undefined;
  try {
    if (typeof mp.createCardToken === "function") {
      cardToken = await mp.createCardToken({ cardId, securityCode: cleanCvv });
    } else {
      cardToken = await mp.fields.createCardToken({ cardId, securityCode: cleanCvv });
    }
  } catch (error) {
    throw new Error(checkoutErrorMessage(error, "Não foi possível validar o cartão salvo com o Mercado Pago."));
  }
  if (!cardToken?.id) throw new Error("O Mercado Pago não retornou um CardToken para o cartão salvo.");
  if (environment === "production" && cardToken.live_mode === false) {
    throw new Error("A Public Key do Mercado Pago pertence ao ambiente Sandbox.");
  }
  return cardToken.id;
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
  const [resolvedEnv, setResolvedEnv] = useState<"sandbox" | "production">(() => checkoutEnvironment());
  const [cardHolder, setCardHolder] = useState(() =>
    checkoutEnvironment() === "sandbox" ? "APRO" : "",
  );
  const [cardMode, setCardMode] = useState<"saved" | "new">("new");
  const [savedCards, setSavedCards] = useState<SavedWalletCard[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [savedCvv, setSavedCvv] = useState("");
  const [saveNewCard, setSaveNewCard] = useState(true);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inFlightRef = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mpRef = useRef<MercadoPagoInstance | null>(null);
  const binRef = useRef("");

  const isSandbox = resolvedEnv === "sandbox";

  // 1. Initialize MercadoPago.js SDK and fetch saved cards from Wallet
  useEffect(() => {
    let disposed = false;
    setSdkReady(false);
    setWalletLoading(true);
    setError(null);
    mpRef.current = null;

    const initCheckoutAndWallet = async () => {
      const platformPublicKey = String(import.meta.env.VITE_MP_PUBLIC_KEY || "").trim();
      if (!window.MercadoPago) throw new Error("MercadoPago.js não pôde ser carregado.");

      const [configRes, walletRes] = await Promise.all([
        supabase.functions.invoke("payment-gateway", {
          body: { action: "get_checkout_config", provider_id: providerId },
        }),
        supabase.functions.invoke("payment-gateway", {
          body: { action: "list_saved_cards", provider_id: providerId },
        }).catch(() => ({ data: null, error: null })),
      ]);

      if (configRes.error) throw new Error(await invokeErrorMessage(configRes.error));
      const checkoutConfig = configRes.data;
      if (!checkoutConfig?.success) {
        throw new Error(checkoutErrorMessage(checkoutConfig, "Não foi possível configurar o checkout."));
      }

      const env = checkoutEnvironment(checkoutConfig.environment);
      if (!disposed) {
        setResolvedEnv(env);
        if (env === "sandbox") {
          setCardHolder((prev) => prev || "APRO");
        }
      }

      const publicKey = String(checkoutConfig.public_key || platformPublicKey).trim();
      if (!publicKey) throw new Error("Public Key do Mercado Pago não está configurada para esta rota.");
      if (disposed) return;

      mpRef.current = new window.MercadoPago(publicKey, {
        locale: "pt-BR",
        advancedFraudPrevention: true,
      });
      setSdkReady(true);

      const loadedCards = Array.isArray(walletRes?.data?.cards)
        ? (walletRes.data.cards as SavedWalletCard[])
        : [];
      if (!disposed) {
        setSavedCards(loadedCards);
        if (loadedCards.length > 0) {
          setSelectedCardId(loadedCards[0].id);
          setCardMode("saved");
        } else {
          setCardMode("new");
        }
        setWalletLoading(false);
      }
    };

    void initCheckoutAndWallet().catch((caught) => {
      if (!disposed) {
        setWalletLoading(false);
        setError(checkoutErrorMessage(caught, "Falha ao inicializar o checkout do Mercado Pago."));
      }
    });

    return () => {
      disposed = true;
      setSdkReady(false);
      mpRef.current = null;
    };
  }, [providerId]);

  // 2. Mount PCI Fields whenever SDK is ready and user is in "new" card mode
  useEffect(() => {
    if (!sdkReady || cardMode !== "new" || !mpRef.current) {
      setFieldsReady(false);
      return;
    }

    let disposed = false;
    const mountedFields: MpField[] = [];
    setFieldsReady(false);
    binRef.current = "";

    try {
      const mp = mpRef.current;
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
    } catch (caught) {
      if (!disposed) {
        setError(checkoutErrorMessage(caught, "Falha ao montar os campos seguros do cartão."));
      }
    }

    return () => {
      disposed = true;
      setFieldsReady(false);
      for (const field of mountedFields) {
        try {
          field.unmount();
        } catch {
          // MercadoPago.js may already have removed an iframe during navigation.
        }
      }
    };
  }, [sdkReady, cardMode]);

  const handleDeleteSavedCard = async (cardId: string) => {
    if (deletingCardId) return;
    setDeletingCardId(cardId);
    setError(null);
    try {
      const { data, error: delErr } = await supabase.functions.invoke("payment-gateway", {
        body: { action: "delete_saved_card", provider_id: providerId, card_id: cardId },
      });
      if (delErr) throw new Error(await invokeErrorMessage(delErr));
      if (!data?.success) throw new Error(checkoutErrorMessage(data, "Não foi possível remover o cartão."));
      const remaining = savedCards.filter((item) => item.id !== cardId);
      setSavedCards(remaining);
      if (remaining.length === 0) {
        setSelectedCardId("");
        setCardMode("new");
      } else if (selectedCardId === cardId) {
        setSelectedCardId(remaining[0].id);
      }
    } catch (caught) {
      setError(checkoutErrorMessage(caught, "Erro ao remover cartão da carteira."));
    } finally {
      setDeletingCardId(null);
    }
  };

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    setPendingNotice(null);
    const paymentAttemptId = crypto.randomUUID();

    try {
      const mp = mpRef.current;
      if (!mp || !sdkReady) throw new Error("O SDK seguro do Mercado Pago ainda não está pronto.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor de pagamento inválido.");

      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Sua sessão expirou. Entre novamente antes de pagar.");
      const userCpf = String(
        (session.user.user_metadata as Record<string, unknown>)?.cpf || "",
      ).replace(/\D/g, "");
      const environment = resolvedEnv;
      const payerIdentity = resolvePayerIdentity(environment, session.user.email || "", userCpf);

      let token = "";
      let saveCardToken: string | undefined;
      let paymentMethodId = "";
      let resolvedCardholderName = "";
      let savedCardId: string | undefined;

      if (cardMode === "saved") {
        const chosen = savedCards.find((item) => item.id === selectedCardId);
        if (!chosen) throw new Error("Selecione um cartão salvo na carteira ou cadastre um novo cartão.");
        token = await tokenizeSavedCard(mp, chosen.id, savedCvv, environment);
        paymentMethodId = chosen.payment_method.id || "credit_card";
        resolvedCardholderName = chosen.cardholder.name || "";
        savedCardId = chosen.id;
      } else {
        if (!fieldsReady) throw new Error("Os campos seguros do Mercado Pago ainda não estão prontos.");
        resolvedCardholderName = cardHolder.trim();
        if (!resolvedCardholderName) throw new Error("Informe o nome do titular do cartão.");

        const tokenized = await tokenizeNewCard(
          mp,
          resolvedCardholderName,
          payerIdentity.cpf,
          binRef.current,
          environment,
        );
        token = tokenized.token;
        paymentMethodId = tokenized.paymentMethodId;

        if (saveNewCard) {
          try {
            const extra = await mp.fields.createCardToken({
              cardholderName: resolvedCardholderName,
              ...(payerIdentity.cpf
                ? { identificationType: "CPF", identificationNumber: payerIdentity.cpf }
                : {}),
            });
            if (extra?.id && extra.id !== token) {
              saveCardToken = extra.id;
            }
          } catch {
            // Non-blocking: card payment proceeds even if secondary wallet token fails.
          }
        }
      }

      const nameParts = resolvedCardholderName.split(/\s+/).filter(Boolean);
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
        ...(savedCardId ? { saved_card_id: savedCardId } : {}),
        ...(saveNewCard && !savedCardId && saveCardToken
          ? { save_card: true, save_card_token: saveCardToken }
          : {}),
        installments: 1,
        metadata: metadata || {},
      };

      console.info("[CheckoutUniversal] Enviando tentativa tokenizada", {
        payment_attempt_id: paymentAttemptId,
        service_type: serviceType,
        service_id: resolvedServiceId,
        provider_id: providerId,
        amount: finalAmount,
        mode: cardMode,
        environment,
      });

      const { data, error: invokeError } = await supabase.functions.invoke("payment-gateway", {
        body: payload,
      });
      if (invokeError) throw new Error(await invokeErrorMessage(invokeError));
      if (!data || data.success === false || data.error) {
        throw new Error(checkoutErrorMessage(data, "Pagamento rejeitado pelo Mercado Pago."));
      }

      const paymentStatus = String(data.status || data.payment?.status || "").toLowerCase();
      if (paymentStatus === "approved") {
        if (data.saved_card && typeof data.saved_card === "object") {
          setSavedCards((prev) => {
            const exists = prev.some((item) => item.id === data.saved_card.id);
            return exists ? prev : [data.saved_card as SavedWalletCard, ...prev];
          });
        }
        onSuccess(data);
        return;
      }

      if (paymentStatus === "in_process" || paymentStatus === "pending") {
        setPendingNotice(
          "Pagamento em análise pela operadora do cartão. A confirmação acontecerá automaticamente assim que o Mercado Pago aprovar.",
        );
        return;
      }

      throw new Error(checkoutErrorMessage(data, "Pagamento recusado pela operadora do cartão."));
    } catch (caught: unknown) {
      const message = checkoutErrorMessage(caught);
      console.error("[CheckoutUniversal] Falha na tentativa", { payment_attempt_id: paymentAttemptId, message });
      setError(message);
      onError(message);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const canSubmit =
    !isLoading &&
    sdkReady &&
    (cardMode === "saved" ? Boolean(selectedCardId && savedCvv.replace(/\D/g, "").length >= 3) : fieldsReady);

  return (
    <div className="mt-4 rounded-2xl p-4 bg-white/5 border border-white/10 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="font-sans text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
          <CreditCard size={14} />
          Cartão de Crédito
        </span>
        <span className="text-[10px] text-white/40">Wallet & PCI Mercado Pago</span>
      </div>

      {/* Mode toggle: Wallet vs New card */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setCardMode("saved");
            setError(null);
          }}
          disabled={savedCards.length === 0 && !walletLoading}
          className="h-9 rounded-xl px-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
          style={{
            background: cardMode === "saved" ? "rgba(13,184,126,0.18)" : "rgba(255,255,255,0.04)",
            border: cardMode === "saved" ? "1px solid #0DB87E" : "1px solid rgba(255,255,255,0.10)",
            color: cardMode === "saved" ? "#0DB87E" : "rgba(255,255,255,0.7)",
          }}
        >
          <Wallet size={13} />
          <span>Carteira ({savedCards.length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCardMode("new");
            setError(null);
          }}
          className="h-9 rounded-xl px-2.5 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: cardMode === "new" ? "rgba(13,184,126,0.18)" : "rgba(255,255,255,0.04)",
            border: cardMode === "new" ? "1px solid #0DB87E" : "1px solid rgba(255,255,255,0.10)",
            color: cardMode === "new" ? "#0DB87E" : "rgba(255,255,255,0.7)",
          }}
        >
          <Plus size={13} />
          <span>Novo cartão</span>
        </button>
      </div>

      {/* SAVED CARDS WALLET MODE */}
      {cardMode === "saved" && (
        <div className="space-y-2.5">
          {walletLoading ? (
            <p className="text-[12px] text-white/50 text-center py-3">Carregando cartões salvos...</p>
          ) : savedCards.length === 0 ? (
            <p className="text-[12px] text-white/50 text-center py-2">
              Nenhum cartão salvo ainda. Cadastre um novo cartão para usar na carteira.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {savedCards.map((card) => {
                  const active = card.id === selectedCardId;
                  const expLabel =
                    card.expiration_month && card.expiration_year
                      ? `${String(card.expiration_month).padStart(2, "0")}/${String(card.expiration_year).slice(-2)}`
                      : "";
                  return (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedCardId(card.id);
                      }}
                      className="rounded-xl p-3 flex items-center justify-between gap-2 cursor-pointer transition-all"
                      style={{
                        background: active ? "rgba(13,184,126,0.12)" : "rgba(0,0,0,0.28)",
                        border: active ? "1.5px solid #0DB87E" : "1px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: active ? "#0DB87E" : "rgba(255,255,255,0.08)",
                          }}
                        >
                          {active && <Check size={12} className="text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-sans text-[12px] font-semibold text-white truncate">
                            {card.payment_method.name} •••• {card.last_four_digits}
                          </p>
                          <p className="font-sans text-[10px] text-white/50 truncate">
                            {card.cardholder.name}{expLabel ? ` · Val. ${expLabel}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label="Remover cartão salvo"
                        disabled={deletingCardId === card.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteSavedCard(card.id);
                        }}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-sans text-[11px] text-white/60 mb-1" htmlFor="wallet-saved-cvv">
                  Código de segurança (CVV) do cartão selecionado
                </label>
                <input
                  id="wallet-saved-cvv"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={savedCvv}
                  onChange={(e) => setSavedCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  autoComplete="cc-csc"
                  className="w-full h-11 rounded-xl px-3 bg-black/30 border border-white/10 text-white font-mono text-[14px] outline-none focus:border-[#0DB87E]"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* NEW CARD PCI FIELDS MODE */}
      {cardMode === "new" && (
        <>
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
              placeholder={isSandbox ? "APRO" : "NOME COMO NO CARTÃO"}
              autoComplete="cc-name"
              className="w-full h-11 rounded-xl px-3 bg-black/30 border border-white/10 text-white font-sans text-[13px] uppercase outline-none focus:border-[#0DB87E]"
            />
            {isSandbox && (
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

          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveNewCard}
              onChange={(e) => setSaveNewCard(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0DB87E]"
            />
            <span className="font-sans text-[11px] text-white/75">
              Salvar este cartão na minha carteira (Wallet) para próximas corridas
            </span>
          </label>
        </>
      )}

      {pendingNotice && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-medium">
          ⏳ {pendingNotice}
        </div>
      )}

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
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="mt-3 w-full h-12 rounded-xl font-display font-semibold text-white flex items-center justify-center bg-[#0DB87E] active:scale-[0.98] transition-all disabled:cursor-not-allowed"
        style={{ opacity: canSubmit ? 1 : 0.7 }}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin" />
        ) : !sdkReady || (cardMode === "new" && !fieldsReady) ? (
          "Carregando pagamento seguro..."
        ) : (
          `Pagar com Cartão (${formatBRL(amount)})`
        )}
      </button>
    </div>
  );
}
