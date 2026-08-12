import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Info, Pencil, Plus, X } from "lucide-react";

import FormFieldLight from "@/components/prestador/FormFieldLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { CATALOGO_PADRAO, type Produto } from "@/mocks/ambulantesProdutos";
import { maskCPF } from "@/utils/masks";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";

type Modalidade = "delivery" | "local_fixo" | "both";

interface CustomItem { id?: string; nome: string; emoji: string; foto?: string; preco: number; variosValores?: boolean; }

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


  const [cpf, setCpf] = useState("");
  const [modalidades, setModalidades] = useState<Array<"delivery" | "local_fixo">>([]);
  const [selectedProds, setSelectedProds] = useState<Record<string, { preco: number, variosValores: boolean }>>({});
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customDraft, setCustomDraft] = useState<Omit<CustomItem, "id">>({ nome: "", emoji: "🍽️", preco: 10, variosValores: false });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user.cpf && !cpf) {
      setCpf(maskCPF(user.cpf));
    }
  }, [user.cpf, cpf]);

  const allList: Array<Produto | CustomItem & { id?: string }> = [...CATALOGO_PADRAO, ...customItems];

  const toggleProd = (id: string, preco: number) => {
    setSelectedProds((p) => {
      const n = { ...p };
      if (n[id] !== undefined) delete n[id];
      else n[id] = { preco, variosValores: false };
      return n;
    });
  };

  const updateProdPreco = (id: string, preco: number) => {
    setSelectedProds((p) => ({ ...p, [id]: { ...p[id], preco } }));
  };

  const toggleProdVariosValores = (id: string) => {
    setSelectedProds((p) => ({ ...p, [id]: { ...p[id], variosValores: !p[id].variosValores } }));
  };

  const addCustom = () => {
    if (!customDraft.nome.trim()) return;
    const id = `custom-${Date.now()}`;
    setCustomItems((c) => [...c, { ...customDraft, id }]);
    setSelectedProds((p) => ({ ...p, [id]: { preco: customDraft.preco, variosValores: !!customDraft.variosValores } }));
    setCustomDraft({ nome: "", emoji: "🍽️", preco: 10, variosValores: false, foto: undefined });
    setShowCustomModal(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCustomDraft((c) => ({ ...c, foto: ev.target?.result as string, emoji: "" }));
      };
      reader.readAsDataURL(file);
    }
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
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
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

      // Atualiza o CPF se aplicável
      supabase.auth.updateUser({ data: { cpf } }).catch(() => { });

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

  const canContinueStep1 = cpf.replace(/\D/g, "").length >= 11 && modalidades.length > 0;
  const canContinueStep2 = Object.keys(selectedProds).length > 0;

  return (
    <div style={{ minHeight: "100svh", background: "#F7F8FA", padding: "24px 24px 180px", overflowY: "auto" }}>
      <header className="flex items-center gap-3" style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#0B1B3E" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <span className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3E" }}>UBT.</span>
      </header>


      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Dados", "Cardápio"].map(t => (
          <button
            key={t} id={`tab-${t}`} onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#0B1B3E" : "#EFF0F3",
              color: activeTab === t ? "white" : "#5B6178",
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
          <FormFieldLight
            label="CPF"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(maskCPF(e.target.value))}
          />
          <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3E", marginTop: 24, marginBottom: 12 }}>
            Como você quer trabalhar?
          </h2>
          <div className="flex gap-3">
            {([
              { key: "delivery" as const, title: "🛵 Delivery", desc: "Você leva o produto ao cliente (raio ~500m)" },
              { key: "local_fixo" as const, title: "📍 Local Fixo", desc: "O cliente vem até você" },
            ]).map((opt) => {
              const active = modalidades.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setModalidades((prev) =>
                      prev.includes(opt.key)
                        ? prev.filter((x) => x !== opt.key)
                        : [...prev, opt.key]
                    );
                  }}
                  className="flex-1 text-left relative"
                  style={{
                    border: `2px solid ${active ? "#0DB87E" : "#D8DBE5"}`,
                    background: active ? "#E6FAF4" : "#fff",
                    borderRadius: 14,
                    padding: 20,
                    cursor: "pointer",
                  }}
                >
                  {active && (
                    <Check size={18} color="#0DB87E" style={{ position: "absolute", top: 10, right: 10 }} />
                  )}
                  <p className="font-sans" style={{ fontSize: 15, fontWeight: 600, color: "#0B1B3E", margin: 0 }}>
                    {opt.title}
                  </p>
                  <p className="font-sans" style={{ fontSize: 13, color: "#5B6178", marginTop: 6 }}>
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>

        </div>
      )}

      {activeTab === "Cardápio" && (
        <div style={{ marginTop: 24 }}>
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>
            Selecione seus produtos
          </h2>
          <p className="font-sans" style={{ fontSize: 14, color: "#5B6178", marginTop: 4 }}>
            Edite os preços conforme desejar.
          </p>
          <div className="grid grid-cols-2 gap-3" style={{ marginTop: 16 }}>
            {CATALOGO_PADRAO.map((prod) => {
              const selected = selectedProds[prod.id] !== undefined;
              return (
                <div
                  key={prod.id}
                  onClick={() => toggleProd(prod.id, prod.precoSugerido)}
                  style={{
                    background: selected ? "#E6FAF4" : "#fff",
                    border: `2px solid ${selected ? "#0DB87E" : "#D8DBE5"}`,
                    borderRadius: 14, padding: 14, cursor: "pointer", position: "relative",
                  }}
                >
                  {selected && <Check size={16} color="#0DB87E" style={{ position: "absolute", top: 10, right: 10 }} />}
                  <div style={{ fontSize: 28, textAlign: "center" }}>{prod.emoji}</div>
                  <p className="font-sans" style={{ fontSize: 13, fontWeight: 600, color: "#0B1B3E", textAlign: "center", marginTop: 6 }}>
                    {prod.nome}
                  </p>
                  {selected && (
                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <input type="checkbox" checked={selectedProds[prod.id].variosValores} onChange={() => toggleProdVariosValores(prod.id)} />
                        <span className="font-sans" style={{ fontSize: 11, color: "#5B6178" }}>Diversos valores</span>
                      </div>
                      {!selectedProds[prod.id].variosValores && (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-sans" style={{ fontSize: 11, color: "#5B6178" }}>R$</span>
                          <input
                            type="number" min={0} step={0.5}
                            value={selectedProds[prod.id].preco}
                            onChange={(e) => updateProdPreco(prod.id, +e.target.value)}
                            style={{
                              width: 60, textAlign: "center",
                              fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
                              color: "#0B1B3E", background: "#fff",
                              border: "1px solid #D8DBE5", borderRadius: 8, padding: "4px 6px",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              style={{
                border: "2px dashed #D8DBE5", borderRadius: 14, padding: 14,
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", minHeight: 120,
                background: "transparent",
              }}
            >
              <Plus size={24} color="#0DB87E" />
              <p className="font-sans" style={{ fontSize: 12, color: "#0DB87E", marginTop: 6 }}>Novo item</p>
            </button>
          </div>


        </div>
      )}




      <div style={{ position: "fixed", bottom: 64, left: 0, right: 0, padding: 24, background: "white", borderTop: "1px solid #E2E8F0", zIndex: 10 }}>
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
                border: "1px solid #D8DBE5",
                borderRadius: 12,
                color: "#5B6178",
                background: "white",
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

      {/* Custom modal */}
      {showCustomModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(11,27,62,0.40)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
          onClick={() => setShowCustomModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320, maxWidth: "100%" }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h3 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>
                Novo item
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#5B6178" }}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <FormFieldLight
              label="Nome do item"
              placeholder="Ex: Brigadeiro"
              value={customDraft.nome}
              onChange={(e) => setCustomDraft((c) => ({ ...c, nome: e.target.value }))}
            />
            <div className="mt-3">
              <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#5B6178", display: "block", marginBottom: 6 }}>
                Ícone ou Foto
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(true)}
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #D8DBE5", background: "#F8FAFC", fontSize: 20, cursor: "pointer" }}
                >
                  {customDraft.emoji || "😊"}
                </button>
                <label
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #D8DBE5", background: "#F8FAFC", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#5B6178", fontFamily: "DM Sans", fontWeight: 500 }}
                >
                  {customDraft.foto ? "📷 Foto OK" : "📷 Tirar foto"}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhotoUpload} />
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input type="checkbox" id="varios-valores-custom" checked={customDraft.variosValores} onChange={(e) => setCustomDraft(c => ({ ...c, variosValores: e.target.checked }))} />
              <label htmlFor="varios-valores-custom" style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0B1B3E", cursor: "pointer" }}>
                Diversos valores
              </label>
            </div>
            {!customDraft.variosValores && (
              <div className="mt-3">
                <FormFieldLight
                  label="Preço (R$)"
                  type="number"
                  value={String(customDraft.preco)}
                  onChange={(e) => setCustomDraft((c) => ({ ...c, preco: +e.target.value }))}
                />
              </div>
            )}
            <div style={{ marginTop: 24 }}>
              <PrimaryButtonLight onClick={addCustom} disabled={!customDraft.nome.trim()}>
                Adicionar Item
              </PrimaryButtonLight>
            </div>
            <button
              type="button"
              onClick={() => setShowCustomModal(false)}
              className="font-sans w-full"
              style={{ background: "transparent", border: "none", color: "#5B6178", padding: 12, cursor: "pointer", marginTop: 6 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {showEmojiPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(11,27,62,0.40)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowEmojiPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320, maxWidth: "100%" }}>
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3E", marginBottom: 16 }}>Escolha um ícone</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, maxHeight: "50vh", overflowY: "auto", paddingRight: 4 }}>
              <button
                type="button"
                onClick={() => { setCustomDraft(c => ({ ...c, emoji: "", foto: undefined })); setShowEmojiPicker(false); }}
                style={{ fontSize: 14, padding: 8, background: "#F8FAFC", border: "1px solid #D8DBE5", borderRadius: 8, cursor: "pointer", gridColumn: "span 5", fontWeight: 600, color: "#5B6178", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                🚫 Sem ícone
              </button>
              {EMOJIS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { setCustomDraft(c => ({ ...c, emoji: em, foto: undefined })); setShowEmojiPicker(false); }}
                  style={{ fontSize: 24, padding: 8, background: "#F8FAFC", border: "1px solid #D8DBE5", borderRadius: 8, cursor: "pointer" }}
                >
                  {em}
                </button>
              ))}
            </div>
            <button onClick={() => setShowEmojiPicker(false)} style={{ width: "100%", padding: 12, marginTop: 16, border: "none", background: "transparent", color: "#5B6178", fontFamily: "DM Sans", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AmbulantesOnboardingPage;
