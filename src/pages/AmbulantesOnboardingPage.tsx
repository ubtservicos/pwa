import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, Plus, X, Truck, MapPin, ShoppingBag } from "lucide-react";

import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { CATALOGO_PADRAO, type Produto } from "@/mocks/ambulantesProdutos";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";

type Modalidade = "delivery" | "local_fixo" | "both";

interface CustomItem {
  id?: string;
  nome: string;
  emoji: string;
  foto?: string;
  preco: number;
  variosValores?: boolean;
}

const EMOJIS = ["🍽️", "🥤", "🍺", "🍫", "🍰", "🍔", "🍕", "🌭", "🍟", "🍿", "🍩", "🧁", "🍉", "🍇", "🍓", "🥥", "🥖", "🥐", "🧀", "🍦", "🧊"];

const AmbulantesOnboardingPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [activeTab, setActiveTab] = useState("Dados");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const tabEl = document.getElementById(`tab-${activeTab}`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  const [modalidades, setModalidades] = useState<Array<"delivery" | "local_fixo">>([]);
  const [selectedProds, setSelectedProds] = useState<Record<string, { preco: number; variosValores: boolean }>>({
    sorvete: { preco: 0, variosValores: false } // Pré-ativado por padrão para agilizar o fluxo
  });
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customDraft, setCustomDraft] = useState<Omit<CustomItem, "id">>({
    nome: "",
    emoji: "🍽️",
    preco: 10,
    variosValores: false,
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allList: Array<Produto | (CustomItem & { id?: string })> = [...CATALOGO_PADRAO, ...customItems];

  const toggleProduto = (id: string) => {
    setSelectedProds((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) {
        delete next[id];
      } else {
        next[id] = { preco: 0, variosValores: false };
      }
      return next;
    });
  };

  const handleSaveCustomProduct = () => {
    if (!customDraft.nome.trim()) return;
    const id = `custom-${Date.now()}`;
    const newItem: CustomItem = { ...customDraft, id };
    setCustomItems((c) => [...c, newItem]);
    setSelectedProds((p) => ({
      ...p,
      [id]: { preco: customDraft.preco, variosValores: !!customDraft.variosValores }
    }));
    setCustomDraft({ nome: "", emoji: "🍽️", preco: 10, variosValores: false });
    setShowCustomModal(false);
  };

  const PRODUCT_UUID_MAP: Record<string, string> = {
    milho: 'c5abeb4b-140b-41f3-a15e-bf3cdab793a0',
    coco: 'f701c9a6-71d5-45ea-b364-7bc1496b9f27',
    churrasco: '8b12f6a9-8fc0-4a88-8255-a22fc8eef714',
    acai: '1a54b9d0-0834-4a41-863a-23d2427a1b41',
    sorvete: '2a54b9d0-0834-4a41-863a-23d2427a1b42',
    amendoim: '3a54b9d0-0834-4a41-863a-23d2427a1b43',
    artesanato: '4a54b9d0-0834-4a41-863a-23d2427a1b44',
    caiaque: '5a54b9d0-0834-4a41-863a-23d2427a1b45',
    sup: '6a54b9d0-0834-4a41-863a-23d2427a1b46',
    bananboat: '7a54b9d0-0834-4a41-863a-23d2427a1b47',
    oculos: '8a54b9d0-0834-4a41-863a-23d2427a1b48',
    chapeu: '9a54b9d0-0834-4a41-863a-23d2427a1b49',
  };

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const finalizar = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      if (!user.uid) throw new Error("Usuário não autenticado");

      // Garante que o usuário existe na tabela public.usuarios como prestador
      await supabase.from('usuarios').upsert({
        id: user.uid,
        nome: user.name || 'Ambulante',
        role: 'prestador'
      });

      let modalidadeSalvar: Modalidade | null = null;
      if (modalidades.length === 2) {
        modalidadeSalvar = "both";
      } else if (modalidades.length === 1) {
        modalidadeSalvar = modalidades[0];
      }

      // 1. Salva/Atualiza a sessão do ambulante no Supabase
      const { error: sessionError } = await supabase
        .from('ambulante_sessions')
        .upsert({
          id: user.uid,
          prestador_id: user.uid,
          modalidade: modalidadeSalvar,
          lat: -23.432,
          lng: -45.083,
          address: "Ubatuba, SP",
          is_online: false
        });

      if (sessionError) throw sessionError;

      // 2. Processa cada produto selecionado
      const sessionProductsPayload = [];

      for (const [id, config] of Object.entries(selectedProds)) {
        const p = allList.find((x) => x.id === id);
        if (p) {
          const isCustom = id.startsWith('custom-');
          const pUuid = PRODUCT_UUID_MAP[id] || (isCustom ? generateUUID() : id);

          // Garante que o produto existe na tabela public.produtos
          const { error: prodUpsertError } = await supabase
            .from('produtos')
            .upsert({
              id: pUuid,
              nome: p.nome,
              emoji: p.emoji || '🍽️',
              descricao: ('descricao' in p && p.descricao) ? p.descricao : '',
              preco_sugerido: ('precoSugerido' in p && p.precoSugerido) ? p.precoSugerido : config.preco,
              categoria: ('categoriaHint' in p && p.categoriaHint) ? p.categoriaHint : 'Comida'
            });

          if (prodUpsertError) {
            console.error("Erro ao upsertar produto:", prodUpsertError);
            continue;
          }

          sessionProductsPayload.push({
            session_id: user.uid,
            produto_id: pUuid,
            preco: config.preco,
            disponivel: true
          });
        }
      }

      // 3. Deleta relações antigas de produtos da sessão
      await supabase
        .from('ambulante_session_produtos')
        .delete()
        .eq('session_id', user.uid);

      // 4. Insere as novas relações
      if (sessionProductsPayload.length > 0) {
        const { error: relError } = await supabase
          .from('ambulante_session_produtos')
          .insert(sessionProductsPayload);

        if (relError) throw relError;
      }

      // Legado localStorage para controle local rápido
      try {
        localStorage.setItem(`amb_session_${user.uid}`, "1");
      } catch { /* noop */ }

      navigate("/app/prestador/ambulantes/online");
    } catch (err) {
      console.error("Erro ao finalizar onboarding:", err);
      alert("Ocorreu um erro ao salvar as configurações.");
    } finally {
      setSubmitting(false);
    }
  };

  const canContinueStep1 = modalidades.length > 0;
  const canContinueStep2 = Object.keys(selectedProds).length > 0;

  return (
    <div style={{ minHeight: "100svh", background: "var(--prestador-bg)", padding: "24px 24px 180px", overflowY: "auto", color: "white" }}>
      <header className="flex items-center gap-3" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#FFFFFF" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>UBT.</span>
      </header>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Dados", "Cardápio"].map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#0DB87E" : "var(--prestador-card)",
              color: activeTab === t ? "#09090B" : "#A1A1AA",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Dados" && (
        <div style={{ marginTop: 28 }}>
          <h2 className="font-display text-[16px] font-bold text-white" style={{ marginTop: 8, marginBottom: 12 }}>
            Como você quer trabalhar?
          </h2>
          <div className="flex gap-3">
            {[
              { key: "delivery" as const, title: "🛵 Delivery", desc: "Você leva o produto ao cliente (raio ~500m)", icon: Truck },
              { key: "local_fixo" as const, title: "📍 Local Fixo", desc: "O cliente vem até você", icon: MapPin },
            ].map(({ key, title, desc, icon: Icon }) => {
              const active = modalidades.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setModalidades((prev) =>
                      prev.includes(key)
                        ? prev.filter((x) => x !== key)
                        : [...prev, key]
                    );
                  }}
                  className="flex-1 text-left rounded-2xl p-4 transition-all"
                  style={{
                    border: `2px solid ${active ? "#0DB87E" : "var(--prestador-border)"}`,
                    background: active ? "rgba(13,184,126,0.15)" : "var(--prestador-card)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 120,
                    cursor: "pointer"
                  }}
                >
                  <Icon size={24} color="#0DB87E" />
                  <div>
                    <p className="font-sans text-[15px] font-semibold text-white" style={{ margin: 0 }}>
                      {title}
                    </p>
                    <p className="font-sans text-[13px] mt-1" style={{ color: "#A1A1AA", margin: 0 }}>
                      {desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "Cardápio" && (
        <div style={{ marginTop: 24 }}>
          {/* Banner Marcas Parceiras (Kibon, Nestlé, Frutverão, Oggi, Napoleta, Ky-sabor) */}
          <div
            onClick={() => navigate('/app/prestador/ambulantes/catalogo')}
            className="p-4 rounded-2xl bg-gradient-to-r from-[#0DB87E]/20 via-[#18181B] to-[#18181B] border border-[#0DB87E]/40 mb-5 cursor-pointer hover:border-[#00FF66] transition-all flex items-center justify-between shadow-lg shadow-[#0DB87E]/5"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#0DB87E]/20 flex items-center justify-center text-xl flex-shrink-0">
                🍦
              </div>
              <div>
                <p className="text-sm font-bold text-white font-display">
                  Marcas Parceiras (Kibon, Nestlé, Oggi...)
                </p>
                <p className="text-xs text-[#00FF66] mt-0.5">
                  Acessar Catálogo Oficial de Marcas & Estoque →
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-[#00FF66] shrink-0" />
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-display text-[18px] font-bold text-white" style={{ margin: 0 }}>
                Seu Cardápio & Serviços
              </h2>
              <p className="font-sans text-[13px] text-zinc-400 mt-1">
                Ative as categorias que você comercializa. Categorias ativadas permitem gerenciar marcas e itens.
              </p>
            </div>
          </div>

          {/* Lista Vertical de Cards Largos (Padronizado com 'Meus Serviços Ativos') */}
          <div className="flex flex-col gap-3 mt-4">
            {CATALOGO_PADRAO.map((p) => {
              const isSelected = !!selectedProds[p.id];

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (isSelected) {
                      navigate('/app/prestador/ambulantes/catalogo');
                    } else {
                      toggleProduto(p.id);
                    }
                  }}
                  className="flex items-center w-full rounded-[20px] p-4 text-left transition-all cursor-pointer"
                  style={{
                    background: isSelected ? "var(--prestador-card)" : "var(--prestador-card)",
                    border: `1px solid ${isSelected ? "#0DB87E" : "var(--prestador-border)"}`,
                    boxShadow: isSelected ? "0 4px 20px rgba(13,184,126,0.12)" : "none",
                  }}
                >
                  {/* Ícone à esquerda */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                    style={{
                      background: isSelected ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.05)",
                    }}
                  >
                    {p.emoji}
                  </div>

                  {/* Título e Subtítulo */}
                  <div className="ml-4 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-[16px] font-bold text-white leading-snug">
                        {p.nome}
                      </h3>
                      {isSelected && (
                        <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-[#0DB87E]/20 text-[#00FF66] border border-[#0DB87E]/30">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-[13px] text-[#A1A1AA] mt-0.5 line-clamp-1">
                      {p.descricao}
                    </p>
                    {isSelected && (
                      <p className="font-sans text-[12px] text-[#0DB87E] mt-1 font-semibold flex items-center gap-1">
                        <span>Acessar cardápio pré-cadastrado</span>
                        <ChevronRight size={14} />
                      </p>
                    )}
                  </div>

                  {/* Switch Oficial (Idêntico ao Mototaxi na Home) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProduto(p.id);
                    }}
                    className="w-[52px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ml-3 cursor-pointer"
                    style={{ background: isSelected ? "#0DB87E" : "var(--prestador-border, #3F3F46)" }}
                    aria-label={`Alternar ${p.nome}`}
                  >
                    <span
                      className="block w-6 h-6 bg-white rounded-full absolute top-[2px] transition-transform"
                      style={{
                        transform: isSelected ? "translateX(26px)" : "translateX(2px)",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                      }}
                    />
                  </button>
                </div>
              );
            })}

            {/* Custom Items */}
            {customItems.map((c) => {
              const cId = c.id || `custom-${c.nome}`;
              const isSelected = !!selectedProds[cId];

              return (
                <div
                  key={cId}
                  onClick={() => toggleProduto(cId)}
                  className="flex items-center w-full rounded-[20px] p-4 text-left transition-all cursor-pointer"
                  style={{
                    background: "var(--prestador-card)",
                    border: `1px solid ${isSelected ? "#0DB87E" : "var(--prestador-border)"}`,
                    boxShadow: isSelected ? "0 4px 20px rgba(13,184,126,0.12)" : "none",
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                    style={{ background: isSelected ? "rgba(13,184,126,0.15)" : "rgba(255,255,255,0.05)" }}
                  >
                    {c.emoji}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="font-display text-[16px] font-bold text-white leading-snug">
                      {c.nome}
                    </h3>
                    <p className="font-sans text-[13px] text-[#A1A1AA] mt-0.5">
                      Item personalizado • R$ {Number(c.preco).toFixed(2)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProduto(cId);
                    }}
                    className="w-[52px] h-[28px] rounded-full relative transition-colors flex-shrink-0 ml-3 cursor-pointer"
                    style={{ background: isSelected ? "#0DB87E" : "var(--prestador-border, #3F3F46)" }}
                    aria-label={`Alternar ${c.nome}`}
                  >
                    <span
                      className="block w-6 h-6 bg-white rounded-full absolute top-[2px] transition-transform"
                      style={{
                        transform: isSelected ? "translateX(26px)" : "translateX(2px)",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                      }}
                    />
                  </button>
                </div>
              );
            })}

            {/* Botão Adicionar Item Customizado (Estilo Mais Oportunidades) */}
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="flex items-center w-full bg-transparent border-2 border-dashed rounded-[20px] p-4 text-left transition-colors cursor-pointer"
              style={{ borderColor: "var(--prestador-border)" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <Plus size={20} color="#0DB87E" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="font-display text-[15px] font-bold text-white">Outro Item Personalizado</h3>
                <p className="font-sans text-[12px] text-[#A1A1AA]">Adicionar produto específico que você vende</p>
              </div>
              <ChevronRight size={18} color="#71717A" />
            </button>
          </div>
        </div>
      )}

      {/* Footer Fixo */}
      <div style={{ position: "fixed", bottom: 64, left: 0, right: 0, padding: 24, background: "var(--prestador-bg)", borderTop: "1px solid var(--prestador-border)", zIndex: 10 }}>
        {activeTab === "Dados" ? (
          <PrimaryButtonLight
            onClick={() => setActiveTab("Cardápio")}
            disabled={!canContinueStep1}
          >
            Avançar para o Cardápio
          </PrimaryButtonLight>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("Dados")}
              className="flex-1 font-sans font-bold text-[14px]"
              style={{
                border: "1px solid var(--prestador-border)",
                borderRadius: 12,
                color: "#A1A1AA",
                background: "var(--prestador-card)",
                padding: "14px 0",
              }}
            >
              Voltar
            </button>
            <div className="flex-[2]">
              <PrimaryButtonLight
                onClick={finalizar}
                loading={submitting}
                disabled={!canContinueStep1 || !canContinueStep2}
              >
                Salvar Configurações
              </PrimaryButtonLight>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Item Customizado */}
      {showCustomModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowCustomModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--prestador-card)",
              borderRadius: 20,
              padding: 24,
              width: 340,
              maxWidth: "100%",
              border: "1px solid var(--prestador-border)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="font-display text-[18px] font-bold text-white" style={{ margin: 0 }}>
                Adicionar Item Personalizado
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#A1A1AA" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#A1A1AA", display: "block", marginBottom: 6 }}>
                  ÍCONE / EMOJI
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(true)}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid var(--prestador-border)", background: "var(--prestador-bg)", fontSize: 20, cursor: "pointer" }}
                  >
                    {customDraft.emoji}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(true)}
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid var(--prestador-border)", background: "var(--prestador-bg)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A1A1AA", fontFamily: "DM Sans", fontWeight: 500 }}
                  >
                    Alterar Ícone
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome do Item</label>
                <input
                  type="text"
                  value={customDraft.nome}
                  onChange={(e) => setCustomDraft((d) => ({ ...d, nome: e.target.value }))}
                  placeholder="Ex: Água mineral sem gás"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Preço Sugerido (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  value={customDraft.preco}
                  onChange={(e) => setCustomDraft((d) => ({ ...d, preco: parseFloat(e.target.value) || 0 }))}
                  placeholder="Ex: 5.00"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
              <PrimaryButtonLight
                onClick={handleSaveCustomProduct}
                disabled={!customDraft.nome.trim()}
              >
                Confirmar
              </PrimaryButtonLight>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                style={{ background: "transparent", border: "none", color: "#A1A1AA", padding: 12, cursor: "pointer", marginTop: 6 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picker de Emojis */}
      {showEmojiPicker && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
          onClick={() => setShowEmojiPicker(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--prestador-card)",
              borderRadius: 20,
              padding: 24,
              width: 320,
              maxWidth: "100%",
              border: "1px solid var(--prestador-border)"
            }}
          >
            <h3 className="font-display text-[16px] font-bold text-white" style={{ marginBottom: 16 }}>
              Escolha um ícone
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => {
                    setCustomDraft((d) => ({ ...d, emoji: em }));
                    setShowEmojiPicker(false);
                  }}
                  style={{
                    fontSize: 24,
                    padding: 8,
                    background: "var(--prestador-bg)",
                    border: "1px solid var(--prestador-border)",
                    borderRadius: 10,
                    cursor: "pointer"
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 16,
                border: "none",
                background: "transparent",
                color: "#A1A1AA",
                fontFamily: "DM Sans",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmbulantesOnboardingPage;
