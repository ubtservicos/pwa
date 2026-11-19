import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Copy,
  Shield,
  Truck,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { ColaboradorPerfil } from "@/pages/admin/AdminCocoColaboradores";

interface ColaboradorVinculo {
  id: string;
  nome: string;
  perfil: ColaboradorPerfil;
  status_aprovacao: "pendente" | "aprovado" | "rejeitado";
  is_ativo: boolean;
}

const CocoOnboardingPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const [loading, setLoading] = useState(true);
  const [vinculo, setVinculo] = useState<ColaboradorVinculo | null>(null);
  const [ubtSlug, setUbtSlug] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user.uid) {
      if (!user.isLoading) setLoading(false);
      return;
    }

    const loadStatus = async () => {
      try {
        const [{ data: uData }, { data: colabData }] = await Promise.all([
          supabase
            .from("usuarios")
            .select("referral_code")
            .eq("id", user.uid)
            .maybeSingle(),
          supabase
            .from("coco_colaboradores")
            .select("id, nome, perfil, status_aprovacao, is_ativo")
            .eq("user_id", user.uid)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        setUbtSlug(uData?.referral_code || user.uid.slice(0, 8));
        if (colabData && colabData.length > 0) {
          setVinculo(colabData[0] as ColaboradorVinculo);
        }
      } catch (err) {
        console.error("Erro ao consultar vínculo Côco & Cia:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, [user.uid, user.isLoading]);

  const handleCopySlug = () => {
    if (!ubtSlug) return;
    navigator.clipboard.writeText(ubtSlug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const perfilLabel =
    vinculo?.perfil === "alta_gestao"
      ? "Alta Gestão"
      : vinculo?.perfil === "colaborador_administrativo"
        ? "Colaborador Administrativo"
        : "Prestador (Coleta em Campo)";

  return (
    <div
      className="relative text-zinc-100"
      style={{
        minHeight: "100svh",
        background: "#0B0F14",
        padding: "72px 20px 32px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <button
          onClick={() => navigate("/app/prestador/home")}
          aria-label="voltar"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </button>
        <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
          UBT · Côco &amp; Cia
        </span>
      </div>

      <div
        style={{
          background: "#111827",
          borderRadius: 20,
          border: "1px solid rgba(16,185,129,0.30)",
          boxShadow: "0 0 28px rgba(16,185,129,0.10)",
          padding: 28,
          textAlign: "center",
          maxWidth: 440,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "rgba(16,185,129,0.14)",
            border: "1px solid rgba(16,185,129,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
          }}
        >
          {vinculo?.status_aprovacao === "aprovado" && vinculo.is_ativo ? (
            <CheckCircle size={30} color="#10B981" />
          ) : (
            <Users size={28} color="#10B981" />
          )}
        </div>

        <span
          style={{
            fontFamily: "DM Sans",
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "#10B981",
          }}
        >
          Credenciamento Administrativo
        </span>

        <h1 style={{ fontFamily: "Syne", fontSize: 21, fontWeight: 700, color: "#FFFFFF", margin: "6px 0 0" }}>
          {vinculo?.status_aprovacao === "aprovado" && vinculo.is_ativo
            ? "Vínculo Ativo na Côco & Cia"
            : "Vincule sua Conta via Administrativo"}
        </h1>

        {loading ? (
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#9CA3AF", marginTop: 14 }}>
            Verificando seu credenciamento...
          </p>
        ) : vinculo?.status_aprovacao === "aprovado" && vinculo.is_ativo ? (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "rgba(16,185,129,0.10)",
                border: "1px solid rgba(16,185,129,0.30)",
                borderRadius: 12,
                padding: 14,
                textAlign: "left",
                fontFamily: "DM Sans",
                fontSize: 13,
                color: "#D1FAE5",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#10B981" }}>
                <Shield size={14} /> Perfil: {perfilLabel}
              </div>
              <div style={{ marginTop: 4, color: "#9CA3AF", fontSize: 12 }}>
                Colaborador: <strong style={{ color: "#FFFFFF" }}>{vinculo.nome}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/app/prestador/coco/online")}
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 12,
                background: "#10B981",
                border: "none",
                color: "#0B0F14",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Truck size={17} /> Abrir Central de Coletas
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#9CA3AF", margin: 0, lineHeight: 1.5 }}>
              O vínculo à frota da <strong>Côco &amp; Cia</strong> é realizado exclusivamente pelo painel administrativo. Informe o seu <strong>ID do Colaborador</strong> abaixo ao responsável da equipe:
            </p>

            <div
              style={{
                background: "#0B0F14",
                border: "1px solid rgba(16,185,129,0.40)",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10B981", display: "block" }}>
                  Seu ID / Slug UBT
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>
                  {ubtSlug || "—"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopySlug}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: copied ? "#059669" : "#10B981",
                  border: "none",
                  color: "#0B0F14",
                  fontFamily: "Syne",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copiado!" : "Copiar ID"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate("/app/prestador/home")}
              style={{
                width: "100%",
                minHeight: 44,
                borderRadius: 12,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "#D1D5DB",
                fontFamily: "DM Sans",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Voltar para a Home do Prestador
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CocoOnboardingPage;
