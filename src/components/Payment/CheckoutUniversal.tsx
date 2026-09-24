/**
 * UBT-PAY-006: CheckoutUniversal
 *
 * Componente genérico de checkout que encapsula:
 *   1. Coleta dos dados do cartão (número, nome, validade, CVV)
 *   2. Tokenização direta via API REST do Mercado Pago (/v1/card_tokens)
 *   3. Invocação da Edge Function payment-gateway via Supabase Functions
 *
 * Totalmente agnóstico em relação ao serviço. O chamador (MototaxiTomador,
 * DeliveryTomador, etc.) passa apenas amount, providerId, serviceType e callbacks.
 */

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/utils/ride";
import type { CheckoutUniversalProps } from "./types";

// ─── Helpers de formatação ────────────────────────────────────────────
const formatCardNumber = (v: string) => {
  const clean = v.replace(/\D/g, "").slice(0, 16);
  return clean.replace(/(\d{4})(?=\d)/g, "$1 ");
};

const formatCardExpiry = (v: string) => {
  const clean = v.replace(/\D/g, "").slice(0, 4);
  if (clean.length >= 3) return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  return clean;
};

// ─── Tokenização via Mercado Pago REST API ────────────────────────────
async function tokenizeCard(
  cardNumber: string,
  cardholderName: string,
  expMonth: number,
  expYear: number,
  cvv: string,
  cpf?: string,
): Promise<string> {
  const mpPublicKey = import.meta.env.VITE_MP_PUBLIC_KEY;

  if (!mpPublicKey || !mpPublicKey.trim() || mpPublicKey.trim() === "undefined") {
    throw new Error("Chave pública do Mercado Pago (VITE_MP_PUBLIC_KEY) não está configurada no ambiente.");
  }

  const cleanKey = mpPublicKey.trim();
  const cleanCpf = (cpf || "").replace(/\D/g, "");

  const payload: Record<string, unknown> = {
    cardNumber,
    card_number: cardNumber,
    cardholder: {
      name: cardholderName,
      ...(cleanCpf
        ? { identification: { type: "CPF", number: cleanCpf } }
        : {}),
    },
    cardExpirationMonth: expMonth,
    card_expiration_month: expMonth,
    expiration_month: expMonth,
    cardExpirationYear: expYear,
    card_expiration_year: expYear,
    expiration_year: expYear,
    securityCode: cvv || "123",
    security_code: cvv || "123",
  };

  console.log("[CheckoutUniversal Tokenize] Enviando payload para /v1/card_tokens:", {
    ...payload,
    cardNumber: `***${cardNumber.slice(-4)}`,
    card_number: `***${cardNumber.slice(-4)}`,
  });

  const res = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(cleanKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const data = await res.json().catch(() => ({}));
  console.log("[CheckoutUniversal Tokenize] Resposta MP:", res.status, data);

  if (res.ok && data?.id) return data.id;

  const errMessage =
    data?.message ||
    (Array.isArray(data?.cause) && data.cause[0]?.description) ||
    data?.error ||
    `Erro ${res.status} ao tokenizar cartão no Mercado Pago`;

  console.error("Erro na tokenização Mercado Pago (Status " + res.status + "):", data);
  throw new Error(`Falha na tokenização do cartão: ${errMessage}`);
}

// ─── Componente ───────────────────────────────────────────────────────
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
  // Card form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Process state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Test card presets (sandbox) ──────────────────────────────────
  const applyTestCard = (preset: "master" | "visa") => {
    if (preset === "master") {
      setCardNumber("4242 4242 4242 4242");
      setCardHolder("Felipe Santander");
      setCardExpiry("11/28");
      setCardCvv("123");
    } else {
      setCardNumber("5031 7557 3450 1234");
      setCardHolder("Silvina Luz");
      setCardExpiry("05/29");
      setCardCvv("789");
    }
  };

  // ─── Submit handler ───────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const cleanNum = cardNumber.replace(/\s+/g, "");
      if (!cleanNum || cleanNum.length < 13) {
        throw new Error("Por favor, informe os dados completos do cartão.");
      }

      const [rawMonth, rawYear] = (cardExpiry || "").split("/");
      const expMonth = parseInt(rawMonth || "12", 10);
      const expYear = parseInt(
        rawYear ? (rawYear.length === 2 ? `20${rawYear}` : rawYear) : "2028",
        10,
      );

      // 1. Tokenização
      const cardToken = await tokenizeCard(
        cleanNum,
        cardHolder || "Cliente UBT",
        expMonth,
        expYear,
        cardCvv,
      );

      if (!cardToken || typeof cardToken !== "string" || cardToken.length < 15) {
        throw new Error("Token de cartão inválido ou vazio retornado pelo gateway.");
      }

      // 2. Montar payload para Edge Function
      const session = (await supabase.auth.getSession()).data.session;
      const userEmail = session?.user?.email || "";
      const userCpf = ((session?.user?.user_metadata as Record<string, unknown>)?.cpf as string || "").replace(/\D/g, "");
      const cardHolderName = (cardHolder || "").trim();
      const nameParts = cardHolderName ? cardHolderName.split(" ") : [];
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const paymentMethodId = cleanNum.startsWith("5") ? "master" : "visa";
      const finalAmount = Number(amount.toFixed(2));

      const payerData: Record<string, unknown> = {};
      if (userEmail) payerData.email = userEmail;
      if (firstName) payerData.first_name = firstName;
      if (lastName) payerData.last_name = lastName;
      if (userCpf) payerData.identification = { type: "CPF", number: userCpf };

      const payloadParaEdge = {
        action: "create_payment_intent",
        service_type: serviceType,
        service_id: serviceId || crypto.randomUUID(),
        external_reference: serviceId || undefined,
        transaction_amount: finalAmount,
        provider_id: providerId,
        provider_name: providerName || undefined,
        payer_email: userEmail || undefined,
        payer: Object.keys(payerData).length > 0 ? payerData : undefined,
        payer_first_name: firstName || undefined,
        payer_last_name: lastName || undefined,
        payer_identification: userCpf ? { type: "CPF", number: userCpf } : undefined,
        description: `Serviço UBT ${serviceType} - ${formatBRL(finalAmount)} (Split 7 Vias)`,
        payment_method_id: paymentMethodId,
        token: cardToken,
        card_token: cardToken,
        card_token_id: cardToken,
        card_data: {
          number: cleanNum,
          cardholder_name: cardHolderName || "Cliente UBT",
          expiration_month: expMonth,
          expiration_year: expYear,
          security_code: cardCvv || "123",
        },
        installments: 1,
        metadata: metadata || {},
      };

      console.log("[CheckoutUniversal] PAYLOAD PARA EDGE:", payloadParaEdge);

      // 3. Invocar Edge Function
      const { data, error: invokeError } = await supabase.functions.invoke(
        "payment-gateway",
        { body: payloadParaEdge },
      );

      if (invokeError || !data || data.error || data.success === false) {
        console.error("[CheckoutUniversal] GATEWAY ERROR:", data || invokeError);
        const errMain = data?.error || invokeError?.message || "Pagamento rejeitado pelo gateway";
        let errDetails = "";
        if (data?.mp_error) {
          errDetails = typeof data.mp_error === "object" ? JSON.stringify(data.mp_error) : String(data.mp_error);
        } else if (data?.details) {
          errDetails = typeof data.details === "object" ? JSON.stringify(data.details) : String(data.details);
        } else if (data?.detail) {
          errDetails = data.detail;
        } else if (data?.message) {
          errDetails = data.message;
        }
        throw new Error(errDetails ? `${errMain}: ${errDetails}` : errMain);
      }

      if (data?.split?.statement) {
        console.log("✅ [UBT Split Engine 7 Vias Extrato]:\n" + data.split.statement);
      }

      // 4. Sucesso → callback
      onSuccess(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro no processamento do pagamento.";
      console.error("[CheckoutUniversal] Payment failed:", err);
      setError(msg);
      onError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="mt-4 rounded-2xl p-4 bg-white/5 border border-white/10 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="font-sans text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
          <CreditCard size={14} />
          Cartão de Crédito
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => applyTestCard("master")}
            className="px-2 py-0.5 rounded bg-emerald-500/20 text-[#0DB87E] text-[10px] font-mono hover:bg-emerald-500/30"
          >
            Teste Master
          </button>
          <button
            type="button"
            onClick={() => applyTestCard("visa")}
            className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono hover:bg-blue-500/30"
          >
            Teste Visa
          </button>
        </div>
      </div>

      {/* Card Number */}
      <div>
        <label className="block font-sans text-[11px] text-white/60 mb-1">Número do Cartão</label>
        <input
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          placeholder="0000 0000 0000 0000"
          className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-mono text-[14px] outline-none focus:border-[#0DB87E]"
          maxLength={19}
        />
      </div>

      {/* Cardholder Name */}
      <div>
        <label className="block font-sans text-[11px] text-white/60 mb-1">Nome no Cartão</label>
        <input
          type="text"
          value={cardHolder}
          onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
          placeholder="NOME COMO NO CARTÃO"
          className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-sans text-[13px] uppercase outline-none focus:border-[#0DB87E]"
        />
      </div>

      {/* Expiry + CVV */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block font-sans text-[11px] text-white/60 mb-1">Validade (MM/AA)</label>
          <input
            type="text"
            value={cardExpiry}
            onChange={(e) => setCardExpiry(formatCardExpiry(e.target.value))}
            placeholder="MM/AA"
            className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-mono text-[13px] outline-none focus:border-[#0DB87E]"
            maxLength={5}
          />
        </div>
        <div>
          <label className="block font-sans text-[11px] text-white/60 mb-1">CVV</label>
          <input
            type="password"
            value={cardCvv}
            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="123"
            className="w-full rounded-xl px-3 py-2.5 bg-black/30 border border-white/10 text-white font-mono text-[13px] outline-none focus:border-[#0DB87E]"
            maxLength={4}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium flex items-center justify-between gap-2">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Submit button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleSubmit}
        className="mt-3 w-full h-12 rounded-xl font-display font-semibold text-white flex items-center justify-center bg-[#0DB87E] active:scale-[0.98] transition-all"
        style={{ opacity: isLoading ? 0.7 : 1 }}
      >
        {isLoading ? (
          <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin" />
        ) : (
          `Pagar com Cartão (${formatBRL(amount)})`
        )}
      </button>
    </div>
  );
}
