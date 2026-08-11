import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Key, Trash2, Plus, Info, Users, Gift, Star, Heart, AlertCircle, CreditCard, Shield } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SectionHeader from "@/components/settings/SectionHeader";
import BottomSheet from "@/components/settings/BottomSheet";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";
import { maskCPF, maskPhone, maskCardNumber, maskExpiry, maskCNPJ } from "@/utils/masks";


interface SegmentedSliderProps {
  poolSize: number;
  values: { comunidade: number; trabalhador: number; tomador: number; padrinho: number };
  onChange: (newValues: { comunidade: number; trabalhador: number; tomador: number; padrinho: number }) => void;
  theme: any;
}

const SegmentedPoolSlider = ({ poolSize, values, onChange, theme }: SegmentedSliderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const colors = {
    trabalhador: "#9B59B6",
    tomador: "#E84040",
    padrinho: "#0DB87E",
    comunidade: "#2B6EE8",
  };

  const t = values.trabalhador;
  const o = values.tomador;
  const p = values.padrinho;
  const c = values.comunidade;

  const d1 = t;
  const d2 = t + o;
  const d3 = t + o + p;

  const handleDrag = (handleIndex: number, clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const rawVal = percent * poolSize;
    const snapped = Math.round(rawVal * 2) / 2;
    const minPct = 0.5;

    if (handleIndex === 1) {
      const minD1 = minPct;
      const maxD1 = d2 - minPct;
      const newD1 = Math.max(minD1, Math.min(snapped, maxD1));
      onChange({
        trabalhador: newD1,
        tomador: Number((d2 - newD1).toFixed(1)),
        padrinho: p,
        comunidade: c,
      });
    } else if (handleIndex === 2) {
      const minD2 = d1 + minPct;
      const maxD2 = d3 - minPct;
      const newD2 = Math.max(minD2, Math.min(snapped, maxD2));
      onChange({
        trabalhador: t,
        tomador: Number((newD2 - d1).toFixed(1)),
        padrinho: Number((d3 - newD2).toFixed(1)),
        comunidade: c,
      });
    } else if (handleIndex === 3) {
      const minD3 = d2 + minPct;
      const maxD3 = poolSize - minPct;
      const newD3 = Math.max(minD3, Math.min(snapped, maxD3));
      onChange({
        trabalhador: t,
        tomador: o,
        padrinho: Number((newD3 - d2).toFixed(1)),
        comunidade: Number((poolSize - newD3).toFixed(1)),
      });
    }
  };

  const setupDrag = (handleIndex: number) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const isTouch = "touches" in e;
    
    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = "touches" in moveEvent ? (moveEvent as TouchEvent).touches[0].clientX : (moveEvent as MouseEvent).clientX;
      handleDrag(handleIndex, clientX);
    };

    const onEnd = () => {
      window.removeEventListener(isTouch ? "touchmove" : "mousemove", onMove);
      window.removeEventListener(isTouch ? "touchend" : "mouseup", onEnd);
    };

    window.addEventListener(isTouch ? "touchmove" : "mousemove", onMove);
    window.addEventListener(isTouch ? "touchend" : "mouseup", onEnd);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { key: "trabalhador", label: "Prêmio Trabalhador", val: t, color: colors.trabalhador },
          { key: "tomador", label: "Prêmio Tomador", val: o, color: colors.tomador },
          { key: "padrinho", label: "Padrinho/Madrinha", val: p, color: colors.padrinho },
          { key: "comunidade", label: "Associação", val: c, color: colors.comunidade },
        ].map((item) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: theme.text, flex: 1 }}>{item.label}</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 700, color: theme.text }}>{item.val.toFixed(1).replace(".", ",")}%</span>
          </div>
        ))}
      </div>

      <div 
        ref={containerRef}
        style={{
          position: "relative",
          height: 36,
          background: "#F1F5F9",
          borderRadius: 12,
          display: "flex",
          overflow: "visible",
          userSelect: "none"
        }}
      >
        <div style={{ width: `${(t / poolSize) * 100}%`, background: colors.trabalhador, borderRadius: "12px 0 0 12px" }} />
        <div style={{ width: `${(o / poolSize) * 100}%`, background: colors.tomador }} />
        <div style={{ width: `${(p / poolSize) * 100}%`, background: colors.padrinho }} />
        <div style={{ width: `${(c / poolSize) * 100}%`, background: colors.comunidade, borderRadius: "0 12px 12px 0" }} />

        <button
          type="button"
          onMouseDown={setupDrag(1)}
          onTouchStart={setupDrag(1)}
          style={{
            position: "absolute",
            top: -4,
            left: `calc(${(d1 / poolSize) * 100}% - 8px)`,
            width: 16,
            height: 44,
            borderRadius: 4,
            background: "#FFF",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            border: "1px solid #CBD5E1",
            cursor: "col-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            zIndex: 10,
            outline: "none"
          }}
        >
          <div style={{ width: 1.5, height: 16, background: "#94A3B8" }} />
          <div style={{ width: 1.5, height: 16, background: "#94A3B8" }} />
        </button>

        <button
          type="button"
          onMouseDown={setupDrag(2)}
          onTouchStart={setupDrag(2)}
          style={{
            position: "absolute",
            top: -4,
            left: `calc(${(d2 / poolSize) * 100}% - 8px)`,
            width: 16,
            height: 44,
            borderRadius: 4,
            background: "#FFF",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            border: "1px solid #CBD5E1",
            cursor: "col-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            zIndex: 10,
            outline: "none"
          }}
        >
          <div style={{ width: 1.5, height: 16, background: "#94A3B8" }} />
          <div style={{ width: 1.5, height: 16, background: "#94A3B8" }} />
        </button>

        <button
          type="button"
          onMouseDown={setupDrag(3)}
          onTouchStart={setupDrag(3)}
          style={{
            position: "absolute",
            top: -4,
            left: `calc(${(d3 / poolSize) * 100}% - 8px)`,
            width: 16,
            height: 44,
            borderRadius: 4,
            background: "#FFF",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            border: "1px solid #CBD5E1",
            cursor: "col-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            zIndex: 10,
            outline: "none"
          }}
        >
          <div style={{ width: 1.5, height: 16, background: "#94A3B8" }} />
          <div style={{ width: 1.5, height: 16, background: "#94A3B8" }} />
        </button>
      </div>
    </div>
  );
};

type PixKey = { id: string; tipo: "CPF" | "E-mail" | "Telefone" | "CNPJ"; valor: string };
type Card = { id: string; bandeira: string; final: string; vence: string };

const SPLIT_ITEMS = [
  { key: "comunidade", label: "Comunidade", icon: Users, color: "#2B6EE8" },
  { key: "trabalhador", label: "Prêmio Trabalhador", icon: Gift, color: "#9B59B6" },
  { key: "tomador", label: "Prêmio Tomador", icon: Star, color: "#E84040" },
  { key: "padrinho", label: "Padrinho/Madrinha", icon: Heart, color: "#0DB87E" },
] as const;

const ConfigFinanceiroPage = () => {
  const t = useTheme();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const { toast, showToast } = useSimpleToast();

  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  const [showPixModal, setShowPixModal] = useState(false);
  const [pixTipo, setPixTipo] = useState<"CPF" | "E-mail" | "Telefone" | "CNPJ">("CPF");
  const [pixValor, setPixValor] = useState("");

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCpfCnpj, setCardCpfCnpj] = useState("");

  const [mpStatus, setMpStatus] = useState<"NOT_CONNECTED" | "CONNECTED" | "ERROR" | "TOKEN_EXPIRING" | "AUTHORIZATION_STARTED">("NOT_CONNECTED");
  const [showMpRegisterModal, setShowMpRegisterModal] = useState(false);

  const [split, setSplit] = useState<Record<string, number>>({
    comunidade: 2,
    trabalhador: 1,
    tomador: 1,
    padrinho: 1,
  });
  const [poolSize, setPoolSize] = useState(5.0);
  const [prestadorPct, setPrestadorPct] = useState(90);
  const [ubtPct, setUbtPct] = useState(5);
  const [loadingSplit, setLoadingSplit] = useState(true);

  const [providerAssoc, setProviderAssoc] = useState<any[]>([]);
  const [allAssocs, setAllAssocs] = useState<any[]>([]);
  const [showAssocModal, setShowAssocModal] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState("mototaxi");
  const [selectedAssocId, setSelectedAssocId] = useState("");
  const [changeReason, setChangeReason] = useState("");

  const detectCardBrand = (num: string): string => {
    const clean = num.replace(/\D/g, "");
    if (clean.startsWith("4")) return "Visa";
    if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "Mastercard";
    if (/^3[47]/.test(clean)) return "Amex";
    if (/^(6011|622|64|65)/.test(clean) || /^50(67|90)/.test(clean) || /^63(62|63)/.test(clean)) return "Elo";
    return "Elo";
  };

  useEffect(() => {
    try {
      const savedPix = localStorage.getItem("ubt_pix_keys_user");
      if (savedPix) setPixKeys(JSON.parse(savedPix));
      const savedCards = localStorage.getItem("ubt_cards_user");
      if (savedCards) setCards(JSON.parse(savedCards));
      const savedMpStatus = localStorage.getItem("ubt_mp_status_user");
      if (savedMpStatus) setMpStatus(savedMpStatus as any);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const loadSplitAndAssociations = async () => {
      setLoadingSplit(true);
      try {
        const { data: dbConfig } = await supabase
          .from("split_config")
          .select("*")
          .eq("id", 1)
          .single();

        let baseP = 90;
        let baseU = 5;
        let baseC = 2;
        let baseT = 1;
        let baseO = 1;
        let baseG = 1;

        if (dbConfig) {
          baseP = Number(dbConfig.prestador_pct);
          baseU = Number(dbConfig.ubt_pct);
          baseC = Number(dbConfig.comunidade_pct);
          baseT = Number(dbConfig.premio_trabalhador_pct);
          baseO = Number(dbConfig.premio_consumidor_pct);
          baseG = Number(dbConfig.padrinho_pct);
        }

        setPrestadorPct(baseP);
        setUbtPct(baseU);
        const resolvedPool = baseC + baseT + baseO + baseG;
        setPoolSize(resolvedPool);

        const { data: customConfig } = await supabase
          .from("provider_split_settings")
          .select("*")
          .eq("provider_id", user.uid)
          .maybeSingle();

        if (customConfig) {
          const sumCustom = 
            Number(customConfig.comunidade_pct) +
            Number(customConfig.premio_trabalhador_pct) +
            Number(customConfig.premio_consumidor_pct) +
            Number(customConfig.padrinho_pct);

          if (Math.abs(sumCustom - resolvedPool) < 0.01) {
            setSplit({
              comunidade: Number(customConfig.comunidade_pct),
              trabalhador: Number(customConfig.premio_trabalhador_pct),
              tomador: Number(customConfig.premio_consumidor_pct),
              padrinho: Number(customConfig.padrinho_pct),
            });
          } else {
            setSplit({ comunidade: baseC, trabalhador: baseT, tomador: baseO, padrinho: baseG });
          }
        } else {
          setSplit({ comunidade: baseC, trabalhador: baseT, tomador: baseO, padrinho: baseG });
        }

        const { data: assocData } = await supabase
          .from("provider_associations")
          .select("service_type, association_id, associations(name)")
          .eq("provider_id", user.uid);
        
        if (assocData) {
          setProviderAssoc(assocData);
        }

        const { data: allAssocData } = await supabase
          .from("associations")
          .select("*")
          .eq("is_active", true);

        if (allAssocData) {
          setAllAssocs(allAssocData);
          if (allAssocData.length > 0) {
            setSelectedAssocId(allAssocData[0].id);
          }
        }

      } catch (err) {
        console.error("Erro ao carregar configurações de split/associações:", err);
      } finally {
        setLoadingSplit(false);
      }
    };

    loadSplitAndAssociations();
  }, [user?.uid]);

  const handleSaveSplit = async () => {
    if (!user?.uid) return;
    try {
      const { error } = await supabase
        .from("provider_split_settings")
        .upsert({
          provider_id: user.uid,
          comunidade_pct: split.comunidade,
          premio_trabalhador_pct: split.trabalhador,
          premio_consumidor_pct: split.tomador,
          padrinho_pct: split.padrinho,
          updated_at: new Date().toISOString()
        }, { onConflict: "provider_id" });

      if (error) throw error;
      showToast("Configuração de split salva com sucesso! ✓");
    } catch (err: any) {
      console.error("Erro ao salvar split individual:", err);
      showToast("Erro ao salvar: " + (err.message || err));
    }
  };

  const handleRequestAssocChange = async () => {
    if (!user?.uid) return;
    try {
      const current = providerAssoc.find(a => a.service_type === selectedServiceType);
      const { error } = await supabase
        .from("association_change_requests")
        .insert({
          provider_id: user.uid,
          service_type: selectedServiceType,
          current_association_id: current?.association_id || null,
          requested_association_id: selectedAssocId,
          reason: changeReason,
          status: "pending"
        });

      if (error) throw error;
      showToast("Solicitação de troca enviada para moderação! ✓");
      setShowAssocModal(false);
      setChangeReason("");
    } catch (err: any) {
      console.error("Erro ao enviar solicitação de troca:", err);
      showToast("Erro ao enviar solicitação: " + (err.message || err));
    }
  };

  const removePix = (id: string) => {
    const newKeys = pixKeys.filter((k) => k.id !== id);
    setPixKeys(newKeys);
    localStorage.setItem("ubt_pix_keys_user", JSON.stringify(newKeys));
    showToast("Chave removida");
  };

  const removeCard = (id: string) => {
    const target = cards.find(c => c.id === id);
    const newCards = cards.filter((c) => c.id !== id);
    setCards(newCards);
    localStorage.setItem("ubt_cards_user", JSON.stringify(newCards));
    if (target) {
      localStorage.removeItem(`card_token_${target.final}`);
    }
    showToast("Cartão removido");
  };

  const handleAddPix = () => {
    if (!pixValor.trim()) return;
    const newKeys = [...pixKeys, { id: String(Date.now()), tipo: pixTipo, valor: pixValor }];
    setPixKeys(newKeys);
    localStorage.setItem("ubt_pix_keys_user", JSON.stringify(newKeys));
    setPixValor("");
    setShowPixModal(false);
    showToast("Chave adicionada!");
  };

  const handleAddCard = () => {
    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv || !cardCpfCnpj) {
      showToast("Preencha todos os campos!");
      return;
    }
    const cleanNum = cardNumber.replace(/\D/g, "");
    if (cleanNum.length < 15) {
      showToast("Número do cartão inválido!");
      return;
    }
    const cleanExpiry = cardExpiry.replace(/\D/g, "");
    if (cleanExpiry.length < 4) {
      showToast("Vencimento inválido!");
      return;
    }
    const final = cleanNum.slice(-4);
    const bandeira = detectCardBrand(cleanNum);
    const newCards = [...cards, { id: String(Date.now()), bandeira, final, vence: cardExpiry }];
    setCards(newCards);
    localStorage.setItem("ubt_cards_user", JSON.stringify(newCards));
    
    // Simular o Token gerado do MP
    const mockToken = `mp_tok_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(`card_token_${final}`, mockToken);

    setShowCardModal(false);
    setCardNumber("");
    setCardHolder("");
    setCardExpiry("");
    setCardCvv("");
    setCardCpfCnpj("");
    showToast("Cartão adicionado via Mercado Pago! ✓");
  };



  const showSplit =
    ["prestador", "cocoecia", "cocoecia-colaborador", "cocoecia-dirigentes", "admin"].includes(user.role) ||
    user.kycStatus === "approved" ||
    (() => {
      try {
        return (
          localStorage.getItem(`diarista_perfil_${user?.uid}`) === "1" ||
          localStorage.getItem(`amb_session_${user?.uid}`) === "1" ||
          !!localStorage.getItem("caminhaoId")
        );
      } catch {
        return false;
      }
    })();

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 80px" }}>
        <PageHeader title="Financeiro" onBack={() => navigate("/app/config")} />

        <SectionHeader>CHAVES PIX</SectionHeader>
        {pixKeys.map((key) => (
          <SettingsGroup key={key.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(13,184,126,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Key size={20} color="#0DB87E" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#0DB87E",
                    background: "rgba(13,184,126,0.10)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    display: "inline-block",
                    marginBottom: 4,
                  }}
                >
                  {key.tipo}
                </span>
                <p
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    fontWeight: 500,
                    color: t.text,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {key.valor}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removePix(key.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}
              >
                <Trash2 size={16} color="rgba(232,64,64,0.70)" />
              </button>
            </div>
          </SettingsGroup>
        ))}

        <button
          type="button"
          onClick={() => setShowPixModal(true)}
          style={{
            width: "100%",
            border: "1.5px dashed rgba(13,184,126,0.40)",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <Plus size={18} color="#0DB87E" />
          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0DB87E" }}>
            Adicionar chave Pix
          </span>
        </button>

        <div style={{ marginTop: 24 }}>
          <SectionHeader>CARTÕES DE CRÉDITO</SectionHeader>
        </div>
        {cards.map((card) => (
          <SettingsGroup key={card.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(13,184,126,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CreditCard size={20} color="#0DB87E" />
              </div>
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#0DB87E",
                    background: "rgba(13,184,126,0.10)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    display: "inline-block",
                    marginBottom: 4,
                  }}
                >
                  {card.bandeira}
                </span>
                <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: t.text, margin: 0 }}>
                  •••• {card.final} · vence {card.vence}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeCard(card.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}
              >
                <Trash2 size={16} color="rgba(232,64,64,0.70)" />
              </button>
            </div>
          </SettingsGroup>
        ))}

        <button
          type="button"
          onClick={() => setShowCardModal(true)}
          style={{
            width: "100%",
            border: "1.5px dashed rgba(13,184,126,0.40)",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <Plus size={18} color="#0DB87E" />
          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0DB87E" }}>
            Adicionar cartão
          </span>
        </button>


        {showSplit && (
          <>
            <div style={{ marginTop: 24 }}>
              <SectionHeader>TAXA DE SERVIÇO</SectionHeader>
            </div>
            <div
              style={{
                background: "rgba(13,184,126,0.06)",
                border: "1px solid rgba(13,184,126,0.15)",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <Info size={16} color="#0DB87E" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: 0 }}>
                Você sempre recebe {prestadorPct}% e a UBT {ubtPct}%. Utilize o slider segmentado abaixo para redistribuir os {poolSize}% da taxa de benefícios conforme sua preferência:
              </p>
            </div>

            {loadingSplit ? (
              <div style={{ padding: 24, textAlign: "center", color: t.subtle, fontFamily: "DM Sans" }}>
                Carregando configurações financeiras...
              </div>
            ) : (
              <SettingsGroup>
                <div style={{ padding: "20px" }}>
                  <SegmentedPoolSlider
                    poolSize={poolSize}
                    values={{
                      comunidade: split.comunidade,
                      trabalhador: split.trabalhador,
                      tomador: split.tomador,
                      padrinho: split.padrinho,
                    }}
                    onChange={(newVal) => setSplit(newVal)}
                    theme={t}
                  />
                </div>
              </SettingsGroup>
            )}

            <button
              type="button"
              onClick={handleSaveSplit}
              disabled={loadingSplit}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "#0DB87E",
                color: "#FFF",
                border: "none",
                fontFamily: "DM Sans",
                fontSize: 15,
                fontWeight: 600,
                cursor: loadingSplit ? "not-allowed" : "pointer",
                opacity: loadingSplit ? 0.5 : 1,
                marginTop: 16,
              }}
            >
              Salvar distribuição
            </button>

            {/* ASSOCIATIONS SECTION */}
            <div style={{ marginTop: 24 }}>
              <SectionHeader>ASSOCIAÇÃO DE MORADORES</SectionHeader>
            </div>
            <div
              style={{
                background: "rgba(43,110,232,0.06)",
                border: "1px solid rgba(43,110,232,0.15)",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <Users size={16} color="#2B6EE8" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: 0 }}>
                Vincule-se à associação de moradores do seu bairro para destinar a sua contribuição comunitária.
              </p>
            </div>

            {providerAssoc.length === 0 ? (
              <div style={{ padding: "16px 20px", background: t.surface, borderRadius: 12, textAlign: "center", color: t.muted, fontFamily: "DM Sans", fontSize: 14, border: `1px solid ${t.border}` }}>
                Nenhuma associação vinculada.
              </div>
            ) : (
              providerAssoc.map((pa) => (
                <SettingsGroup key={pa.service_type}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: "rgba(43,110,232,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Users size={20} color="#2B6EE8" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#2B6EE8",
                          background: "rgba(43,110,232,0.10)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          display: "inline-block",
                          marginBottom: 4,
                          textTransform: "uppercase"
                        }}
                      >
                        {pa.service_type}
                      </span>
                      <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: t.text, margin: 0 }}>
                        {pa.associations?.name || "Associação Vinculada"}
                      </p>
                    </div>
                  </div>
                </SettingsGroup>
              ))
            )}

            <button
              type="button"
              onClick={() => {
                if (allAssocs.length > 0) {
                  setSelectedAssocId(allAssocs[0].id);
                }
                setShowAssocModal(true);
              }}
              style={{
                width: "100%",
                border: "1.5px dashed rgba(43,110,232,0.40)",
                borderRadius: 14,
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: "transparent",
                cursor: "pointer",
                marginTop: 12
              }}
            >
              <Plus size={18} color="#2B6EE8" />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#2B6EE8" }}>
                Solicitar Troca / Vínculo de Associação
              </span>
            </button>
          </>
        )}
      </div>

      <BottomSheet open={showPixModal} onClose={() => setShowPixModal(false)}>
        <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
          Nova Chave Pix
        </h2>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {(["CPF", "E-mail", "Telefone"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => {
                setPixTipo(tipo);
                setPixValor("");
              }}
              style={{
                borderRadius: 999,
                padding: "8px 20px",
                background: pixTipo === tipo ? "#0DB87E" : t.border,
                color: pixTipo === tipo ? "#FFF" : t.text,
                border: "none",
                fontFamily: "DM Sans",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tipo}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <label
            style={{
              fontFamily: "DM Sans",
              fontSize: 12,
              fontWeight: 500,
              color: t.subtle,
              display: "block",
              marginBottom: 6,
            }}
          >
            {pixTipo}
          </label>
          <input
            type={pixTipo === "E-mail" ? "email" : "text"}
            value={pixValor}
            onChange={(e) => {
              const v = e.target.value;
              if (pixTipo === "CPF") setPixValor(maskCPF(v));
              else if (pixTipo === "Telefone") setPixValor(maskPhone(v));
              else setPixValor(v);
            }}
            placeholder={
              pixTipo === "CPF"
                ? "000.000.000-00"
                : pixTipo === "Telefone"
                  ? "(00) 00000-0000"
                  : "voce@exemplo.com"
            }
            style={{
              width: "100%",
              background: t.inputBg,
              border: `1px solid ${t.inputBdr}`,
              borderRadius: 12,
              padding: "12px 14px",
              color: t.text,
              fontFamily: "DM Sans",
              fontSize: 15,
              outline: "none",
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleAddPix}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "#0DB87E",
            color: "#FFF",
            border: "none",
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            marginTop: 20,
          }}
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={() => setShowPixModal(false)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "transparent",
            color: t.text,
            border: `1px solid ${t.border}`,
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            marginTop: 12,
          }}
        >
          Cancelar
        </button>
      </BottomSheet>

      <BottomSheet open={showCardModal} onClose={() => setShowCardModal(false)}>
        <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
          Novo Cartão de Crédito
        </h2>
        <p style={{ fontFamily: "DM Sans", fontSize: 12, color: t.subtle, marginTop: 4, marginBottom: 16 }}>
          Preencha os dados do cartão para gerar o token criptografado via Mercado Pago.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: t.subtle, display: "block", marginBottom: 6 }}>
              Número do Cartão
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(maskCardNumber(e.target.value))}
                placeholder="4000 1234 5678 9010"
                inputMode="numeric"
                style={{
                  width: "100%",
                  background: t.inputBg,
                  border: `1px solid ${t.inputBdr}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  paddingRight: 80,
                  color: t.text,
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  outline: "none",
                }}
              />
              <span style={{
                position: "absolute",
                right: 14,
                top: 13,
                fontSize: 12,
                fontWeight: 600,
                color: "#0DB87E",
                background: "rgba(13,184,126,0.1)",
                padding: "2px 6px",
                borderRadius: 4
              }}>
                {cardNumber.replace(/\D/g, "").length >= 2 ? detectCardBrand(cardNumber) : "Cartão"}
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: t.subtle, display: "block", marginBottom: 6 }}>
              Nome Impresso no Cartão
            </label>
            <input
              type="text"
              value={cardHolder}
              onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
              placeholder="F S ANTANDER"
              style={{
                width: "100%",
                background: t.inputBg,
                border: `1px solid ${t.inputBdr}`,
                borderRadius: 12,
                padding: "12px 14px",
                color: t.text,
                fontFamily: "DM Sans",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: t.subtle, display: "block", marginBottom: 6 }}>
                Vencimento
              </label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                placeholder="MM/AA"
                inputMode="numeric"
                style={{
                  width: "100%",
                  background: t.inputBg,
                  border: `1px solid ${t.inputBdr}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  color: t.text,
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  outline: "none",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: t.subtle, display: "block", marginBottom: 6 }}>
                Código (CVV)
              </label>
              <input
                type="text"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                inputMode="numeric"
                style={{
                  width: "100%",
                  background: t.inputBg,
                  border: `1px solid ${t.inputBdr}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  color: t.text,
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 500, color: t.subtle, display: "block", marginBottom: 6 }}>
              CPF/CNPJ do Titular
            </label>
            <input
              type="text"
              value={cardCpfCnpj}
              onChange={(e) => {
                const v = e.target.value;
                if (v.replace(/\D/g, "").length <= 11) {
                  setCardCpfCnpj(maskCPF(v));
                } else {
                  setCardCpfCnpj(maskCNPJ(v));
                }
              }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              style={{
                width: "100%",
                background: t.inputBg,
                border: `1px solid ${t.inputBdr}`,
                borderRadius: 12,
                padding: "12px 14px",
                color: t.text,
                fontFamily: "DM Sans",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(13,184,126,0.06)",
          border: "1px solid rgba(13,184,126,0.15)",
          borderRadius: 12,
          padding: 12,
          marginTop: 18
        }}>
          <Shield size={16} color="#0DB87E" style={{ flexShrink: 0 }} />
          <p style={{ fontFamily: "DM Sans", fontSize: 11, color: t.subtle, margin: 0 }}>
            Seus dados são protegidos e tokenizados diretamente pelo Mercado Pago.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddCard}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "#0DB87E",
            color: "#FFF",
            border: "none",
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            marginTop: 20,
          }}
        >
          Salvar Cartão Seguro
        </button>
        <button
          type="button"
          onClick={() => setShowCardModal(false)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "transparent",
            color: t.text,
            border: `1px solid ${t.border}`,
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            marginTop: 12,
          }}
        >
          Cancelar
        </button>
      </BottomSheet>

      {/* ASSOCIATION CHANGE REQUEST SHEET */}
      <BottomSheet open={showAssocModal} onClose={() => setShowAssocModal(false)}>
        <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
          Solicitar Troca de Associação
        </h2>
        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, marginTop: 10, lineHeight: 1.5 }}>
          Selecione a nova associação de moradores à qual deseja se vincular e informe o motivo. Sua solicitação passará por aprovação administrativa.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          <label style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: t.text }}>Modalidade de Serviço</label>
          <select
            value={selectedServiceType}
            onChange={(e) => setSelectedServiceType(e.target.value)}
            style={{
              fontFamily: "DM Sans",
              fontSize: 14,
              color: t.text,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "10px",
              outline: "none",
            }}
          >
            <option value="mototaxi">Mototáxi</option>
            <option value="diarista">Diarista</option>
            <option value="cocoecia">Coco&Cia</option>
            <option value="ambulante">Ambulante</option>
          </select>

          <label style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: t.text }}>Associação Destino</label>
          <select
            value={selectedAssocId}
            onChange={(e) => setSelectedAssocId(e.target.value)}
            style={{
              fontFamily: "DM Sans",
              fontSize: 14,
              color: t.text,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "10px",
              outline: "none",
            }}
          >
            {allAssocs.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <label style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: t.text }}>Justificativa</label>
          <textarea
            placeholder="Informe o motivo da troca..."
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            rows={3}
            style={{
              fontFamily: "DM Sans",
              fontSize: 14,
              color: t.text,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "10px",
              outline: "none",
              resize: "none"
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleRequestAssocChange}
          disabled={!selectedAssocId || !changeReason.trim()}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "#2B6EE8",
            color: "#FFF",
            border: "none",
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 600,
            cursor: (!selectedAssocId || !changeReason.trim()) ? "not-allowed" : "pointer",
            opacity: (!selectedAssocId || !changeReason.trim()) ? 0.5 : 1,
            marginTop: 24,
          }}
        >
          Enviar Solicitação
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAssocModal(false);
            setChangeReason("");
          }}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "transparent",
            color: t.text,
            border: `1px solid ${t.border}`,
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            marginTop: 12,
            marginBottom: 10,
          }}
        >
          Cancelar
        </button>
      </BottomSheet>

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default ConfigFinanceiroPage;
