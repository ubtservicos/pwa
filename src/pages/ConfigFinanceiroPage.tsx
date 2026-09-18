import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Key, Trash2, Plus, Users, CreditCard, Shield, CheckCircle2, Unlink, ExternalLink, RefreshCw } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SectionHeader from "@/components/settings/SectionHeader";
import BottomSheet from "@/components/settings/BottomSheet";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";
import { maskCPF, maskPhone, maskCardNumber, maskExpiry, maskCNPJ } from "@/utils/masks";

type PixKey = { id: string; tipo: "CPF" | "E-mail" | "Telefone" | "CNPJ"; valor: string };
type Card = { id: string; bandeira: string; final: string; vence: string };

interface MpAccountData {
  status: string;
  connected_at?: string;
  mercado_pago_user_id?: string;
  ambiente?: string;
}

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

  // Mercado Pago Marketplace Account State
  const [mpAccount, setMpAccount] = useState<MpAccountData | null>(null);
  const [loadingMp, setLoadingMp] = useState(true);
  const [isConnectingMp, setIsConnectingMp] = useState(false);

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
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch Mercado Pago Connection and Associations
  useEffect(() => {
    if (!user?.uid) return;

    const loadFinancialData = async () => {
      setLoadingMp(true);
      try {
        // 1. Check Mercado Pago OAuth Account in marketplace_accounts
        const { data: mpData, error: mpErr } = await supabase
          .from("marketplace_accounts")
          .select("status, connected_at, mercado_pago_user_id, ambiente")
          .eq("user_id", user.uid)
          .eq("status", "CONNECTED")
          .order("connected_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (mpData) {
          setMpAccount(mpData as MpAccountData);
        } else {
          setMpAccount(null);
        }

        // 2. Check for OAuth callback code in URL search params
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (code) {
          await handleExchangeCode(code, state);
        }

        // 3. Associations
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
        console.error("Erro ao carregar dados financeiros:", err);
      } finally {
        setLoadingMp(false);
      }
    };

    loadFinancialData();
  }, [user?.uid]);

  // Exchange authorization code for test tokens
  const handleExchangeCode = async (code: string, state: string | null) => {
    if (!user?.uid) return;
    setIsConnectingMp(true);
    try {
      const redirectUri = `${window.location.origin}/app/config/financeiro`;
      const { data, error } = await supabase.functions.invoke("payment-gateway", {
        body: {
          action: "exchange_oauth_code",
          code,
          state,
          redirect_uri: redirectUri,
          user_id: user.uid,
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Falha na vinculação do Mercado Pago");
      }

      showToast("Conta Mercado Pago vinculada com sucesso! ✓");
      setMpAccount({
        status: "CONNECTED",
        connected_at: new Date().toISOString(),
        mercado_pago_user_id: String(data.user_id || ""),
        ambiente: "sandbox",
      });

      // Clear query params from browser URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      console.error("Erro na troca de código MP:", err);
      showToast("Erro ao vincular conta: " + (err.message || err));
    } finally {
      setIsConnectingMp(false);
    }
  };

  // Trigger OAuth redirect
  const handleConnectMercadoPago = async () => {
    if (!user?.uid) {
      showToast("Faça login para conectar sua conta.");
      return;
    }
    setIsConnectingMp(true);
    try {
      const redirectUri = `${window.location.origin}/app/config/financeiro`;
      const { data, error } = await supabase.functions.invoke("payment-gateway", {
        body: {
          action: "get_oauth_url",
          user_id: user.uid,
          redirect_uri: redirectUri,
          origin: window.location.origin,
          test_token: true, // Garante geração de token de homologação
        }
      });

      if (error || !data?.oauth_url) {
        throw new Error(data?.error || error?.message || "Não foi possível gerar a URL de autorização.");
      }

      // Redireciona para o Mercado Pago
      window.location.href = data.oauth_url;
    } catch (err: any) {
      console.error("Erro ao conectar Mercado Pago:", err);
      showToast("Erro ao iniciar conexão: " + (err.message || err));
      setIsConnectingMp(false);
    }
  };

  // Disconnect Mercado Pago
  const handleDisconnectMercadoPago = async () => {
    if (!user?.uid) return;
    const confirmed = window.confirm(
      "Deseja realmente desvincular sua conta do Mercado Pago? Os repasses automáticos de corridas serão pausados até nova conexão."
    );
    if (!confirmed) return;

    setIsConnectingMp(true);
    try {
      const { error } = await supabase
        .from("marketplace_accounts")
        .update({
          status: "REVOKED",
          disconnected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.uid);

      if (error) throw error;

      setMpAccount(null);
      showToast("Conta do Mercado Pago desvinculada.");
    } catch (err: any) {
      console.error("Erro ao desvincular Mercado Pago:", err);
      showToast("Erro ao desvincular: " + (err.message || err));
    } finally {
      setIsConnectingMp(false);
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

  const showPrestadorFinance =
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

        {/* ---------------------------------------------------------------- */}
        {/* SEÇÃO MERCADO PAGO / RECEBIMENTOS                                */}
        {/* ---------------------------------------------------------------- */}
        {showPrestadorFinance && (
          <div style={{ marginBottom: 28 }}>
            <SectionHeader>RECEBIMENTOS & MERCADO PAGO</SectionHeader>

            {loadingMp ? (
              <div style={{ padding: 24, textAlign: "center", color: t.subtle, fontFamily: "DM Sans" }}>
                Verificando vinculação da conta...
              </div>
            ) : mpAccount?.status === "CONNECTED" ? (
              <SettingsGroup>
                <div style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: "rgba(13,184,126,0.15)",
                        border: "1px solid rgba(13,184,126,0.30)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle2 size={22} color="#0DB87E" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: t.text }}>
                          Mercado Pago Conectado
                        </span>
                        <span
                          style={{
                            fontFamily: "DM Sans",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#0DB87E",
                            background: "rgba(13,184,126,0.12)",
                            padding: "2px 8px",
                            borderRadius: 999,
                            textTransform: "uppercase",
                          }}
                        >
                          Ativo (Homologação)
                        </span>
                      </div>
                      <p style={{ fontFamily: "DM Sans", fontSize: 12, color: t.subtle, margin: 0 }}>
                        {mpAccount.mercado_pago_user_id
                          ? `ID Vendedor: ${mpAccount.mercado_pago_user_id}`
                          : "Sua conta está pronta para receber o split de 90% das corridas."}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: `1px solid ${t.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, color: t.muted }}>
                      Conectado em: {mpAccount.connected_at ? new Date(mpAccount.connected_at).toLocaleDateString("pt-BR") : "Recente"}
                    </span>
                    <button
                      type="button"
                      onClick={handleDisconnectMercadoPago}
                      disabled={isConnectingMp}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "rgba(232,64,64,0.85)",
                        fontFamily: "DM Sans",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                      }}
                    >
                      <Unlink size={13} />
                      Desvincular
                    </button>
                  </div>
                </div>
              </SettingsGroup>
            ) : (
              <div
                style={{
                  background: "rgba(13,184,126,0.04)",
                  border: "1px solid rgba(13,184,126,0.20)",
                  borderRadius: 16,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "rgba(13,184,126,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <CreditCard size={20} color="#0DB87E" />
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: t.text, margin: "0 0 4px 0" }}>
                      Receba seus pagamentos na hora
                    </h3>
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle, margin: 0, lineHeight: 1.4 }}>
                      Vincule sua conta do Mercado Pago para receber automaticamente o valor de 90% das corridas e serviços direto no seu saldo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConnectMercadoPago}
                  disabled={isConnectingMp}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 12,
                    background: "#0DB87E",
                    color: "#FFF",
                    border: "none",
                    fontFamily: "DM Sans",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: isConnectingMp ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "0 4px 14px rgba(13,184,126,0.30)",
                    opacity: isConnectingMp ? 0.7 : 1,
                  }}
                >
                  {isConnectingMp ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Iniciando conexão...
                    </>
                  ) : (
                    <>
                      <ExternalLink size={18} />
                      Conectar Mercado Pago
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* CHAVES PIX                                                       */}
        {/* ---------------------------------------------------------------- */}
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

        {/* ---------------------------------------------------------------- */}
        {/* CARTÕES DE CRÉDITO                                               */}
        {/* ---------------------------------------------------------------- */}
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

        {/* ---------------------------------------------------------------- */}
        {/* ASSOCIAÇÃO DE MORADORES                                          */}
        {/* ---------------------------------------------------------------- */}
        {showPrestadorFinance && (
          <>
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
