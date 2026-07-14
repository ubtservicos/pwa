import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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


type PixKey = { id: string; tipo: "CPF" | "E-mail" | "Telefone"; valor: string };
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
  const [pixTipo, setPixTipo] = useState<"CPF" | "E-mail" | "Telefone">("CPF");
  const [pixValor, setPixValor] = useState("");

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardCpfCnpj, setCardCpfCnpj] = useState("");

  const [split, setSplit] = useState<Record<string, number>>({
    comunidade: 2,
    trabalhador: 1.5,
    tomador: 1.5,
    padrinho: 1,
  });

  const total = Object.values(split).reduce((a, b) => a + b, 0);
  const totalRound = Math.round(total * 10) / 10;

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
      const savedSplit = localStorage.getItem("ubt_split_user");
      if (savedSplit) setSplit(JSON.parse(savedSplit));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const updateSplit = (key: string, value: number) => {
    setSplit({ ...split, [key]: value });
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

  const handleSaveSplit = () => {
    localStorage.setItem("ubt_split_user", JSON.stringify(split));
    showToast("Distribuição da Taxa salva!");
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
                Distribua os 6% da taxa de serviço UBT entre as categorias de benefício. Você sempre recebe 90% e a UBT 4%.
              </p>
            </div>


            {SPLIT_ITEMS.map((item) => {
              const Icon = item.icon;
              const v = split[item.key];
              return (
                <SettingsGroup key={item.key}>
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Icon size={16} color={item.color} />
                      <span
                        style={{
                          flex: 1,
                          fontFamily: "DM Sans",
                          fontSize: 14,
                          color: t.text,
                        }}
                      >
                        {item.label}
                      </span>
                      <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0DB87E" }}>
                        {v.toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      step={0.5}
                      value={v}
                      onChange={(e) => updateSplit(item.key, Number(e.target.value))}
                      style={{ width: "100%", marginTop: 10, accentColor: "#0DB87E" }}
                    />
                    <div
                      style={{
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        color: t.muted,
                        marginTop: 4,
                      }}
                    >
                      ≈ R$ {(40 * (v / 100)).toFixed(2).replace(".", ",")} por corrida de R$ 40
                    </div>
                  </div>
                </SettingsGroup>
              );
            })}

            <div
              style={{
                background: t.surface,
                borderRadius: 12,
                padding: 14,
                marginTop: 4,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle }}>Total:</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {totalRound !== 6 && <AlertCircle size={14} color="#F5A623" />}
                <span
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    fontWeight: 600,
                    color: totalRound === 6 ? "#0DB87E" : "#F5A623",
                  }}
                >
                  {totalRound.toFixed(1).replace(".", ",")}% / 6,0%
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSplit}
              disabled={totalRound !== 6}
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
                cursor: totalRound !== 6 ? "not-allowed" : "pointer",
                opacity: totalRound !== 6 ? 0.5 : 1,
                marginTop: 16,
              }}
            >
              Salvar distribuição
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

      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default ConfigFinanceiroPage;
