import React, { useState } from "react";
import { CheckCircle2, ExternalLink, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const MERCADO_PAGO_REGISTRATION_URL =
  "https://www.mercadopago.com.br/hub/registration/landing";

interface MercadoPagoOnboardingCardProps {
  userId: string;
  possuiMercadoPago: boolean;
  isDarkTheme?: boolean;
  onStatusChange?: (possui: boolean) => void;
}

export default function MercadoPagoOnboardingCard({
  userId,
  possuiMercadoPago,
  isDarkTheme = true,
  onStatusChange,
}: MercadoPagoOnboardingCardProps) {
  const [updating, setUpdating] = useState(false);

  const handleToggleHasAccount = async () => {
    if (!userId || updating) return;
    const nextValue = !possuiMercadoPago;
    setUpdating(true);
    try {
      const { error } = await supabase.rpc("atualizar_status_mercadopago_usuario", {
        p_user_id: userId,
        p_possui: nextValue,
      });
      if (error) throw error;
      onStatusChange?.(nextValue);
      toast.success(
        nextValue
          ? "Confirmado! Sua conta Mercado Pago foi sinalizada como ativa."
          : "Status da conta Mercado Pago atualizado."
      );
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar status do Mercado Pago.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <section
      style={{
        background: isDarkTheme
          ? "linear-gradient(135deg, rgba(0,158,227,0.12), rgba(13,184,126,0.08))"
          : "linear-gradient(135deg, #EFF8FF, #ECFDF5)",
        border: isDarkTheme
          ? "1px solid rgba(0,158,227,0.35)"
          : "1px solid rgba(0,158,227,0.30)",
        borderRadius: 16,
        padding: 16,
        marginTop: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(0,158,227,0.16)",
            border: "1px solid rgba(0,158,227,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Landmark size={20} color="#009EE3" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h3
              style={{
                fontFamily: "Syne",
                fontSize: 15,
                fontWeight: 700,
                color: isDarkTheme ? "#FFFFFF" : "#0F172A",
                margin: 0,
              }}
            >
              Conta Digital Mercado Pago
            </h3>
            {possuiMercadoPago && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "rgba(13,184,126,0.16)",
                  color: "#0DB87E",
                  border: "1px solid rgba(13,184,126,0.35)",
                }}
              >
                <CheckCircle2 size={12} /> Conta Confirmada
              </span>
            )}
          </div>

          <p
            style={{
              fontFamily: "DM Sans",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: isDarkTheme ? "#CBD5E1" : "#334155",
              margin: "6px 0 12px",
            }}
          >
            Crie sua conta no Mercado Pago para habilitar seus recebimentos e repasses automáticos na UBT.{" "}
            <strong style={{ color: isDarkTheme ? "#38BDF8" : "#0284C7" }}>
              A abertura da conta é fundamental para movimentar e receber na plataforma e é totalmente gratuita.
            </strong>
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <a
              href={MERCADO_PAGO_REGISTRATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "9px 14px",
                borderRadius: 10,
                background: "#009EE3",
                color: "#FFFFFF",
                fontFamily: "DM Sans",
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(0,158,227,0.30)",
              }}
            >
              <span>Abrir Conta Gratuita no Mercado Pago</span>
              <ExternalLink size={14} />
            </a>

            <button
              type="button"
              onClick={handleToggleHasAccount}
              disabled={updating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 12px",
                borderRadius: 10,
                background: possuiMercadoPago
                  ? "rgba(13,184,126,0.14)"
                  : isDarkTheme
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(15,23,42,0.05)",
                border: possuiMercadoPago
                  ? "1px solid rgba(13,184,126,0.45)"
                  : isDarkTheme
                    ? "1px solid rgba(255,255,255,0.16)"
                    : "1px solid rgba(15,23,42,0.15)",
                color: possuiMercadoPago
                  ? "#0DB87E"
                  : isDarkTheme
                    ? "#E2E8F0"
                    : "#1E293B",
                fontFamily: "DM Sans",
                fontSize: 12,
                fontWeight: 600,
                cursor: updating ? "wait" : "pointer",
              }}
            >
              {updating ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ShieldCheck size={14} color={possuiMercadoPago ? "#0DB87E" : undefined} />
              )}
              <span>{possuiMercadoPago ? "Já possuo conta (Confirmado)" : "Já possuo conta Mercado Pago"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
