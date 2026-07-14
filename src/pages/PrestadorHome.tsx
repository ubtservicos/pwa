import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, ChevronRight, Recycle, ShoppingBag, Sparkles, Wallet, MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { getStatusRules, STATUS_THEMES } from "@/lib/statusRules";

const PrestadorHome = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();

  // Load status rules and find rule for current user status
  const rules = getStatusRules();
  const activeRule = user.status && user.status !== "active" ? rules.find((r) => r.key === user.status) : null;
  const colors = activeRule ? (STATUS_THEMES[activeRule.theme] || STATUS_THEMES.Grey) : null;

  if (activeRule && activeRule.blockLogin) {
    return (
      <div
        className="min-h-[100svh] bg-[#0A1128] text-white flex flex-col items-center justify-center p-6 text-center"
        style={{ fontFamily: "DM Sans" }}
      >
        <div
          style={{
            padding: 24,
            borderRadius: "50%",
            background: colors?.bg || "rgba(232,64,64,0.15)",
            color: colors?.color || "#E84040",
            marginBottom: 24,
          }}
        >
          <AlertTriangle size={48} />
        </div>
        <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "white", marginBottom: 12 }}>
          Conta sob {activeRule.label}
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.70)", maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
          Sua conta foi suspensa temporariamente sob a regra administrativa de <strong>{activeRule.label}</strong> do Superapp UBT.
        </p>

        {/* List of active blocks */}
        <div
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 28,
            textAlign: "left",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.50)", display: "block", marginBottom: 8 }}>
            Restrições de Conta Ativas:
          </span>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "rgba(255,255,255,0.85)", display: "flex", flexDirection: "column", gap: 5 }}>
            {activeRule.blockLogin && <li>Bloqueio de acesso ao aplicativo</li>}
            {activeRule.blockRequests && <li>Bloqueio de prestação/configuração de serviços</li>}
            {activeRule.blockChat && <li>Bloqueio de envio de mensagens no chat</li>}
            {activeRule.blockPayments && <li>Bloqueio de pagamentos e saques</li>}
            {activeRule.hideProfile && <li>Ocultação do perfil em pesquisas públicas</li>}
          </ul>
          {activeRule.durationDays && (
            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 12 }}>
              Duração estimada: {activeRule.durationDays} dias
            </span>
          )}
        </div>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
          style={{
            background: colors?.color || "#E84040",
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "12px 28px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sair da Conta
        </button>
      </div>
    );
  }

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");


  // States for toggling services on the home page
  const [activeServices, setActiveServices] = useState<Record<string, boolean>>({
    mototaxi: false,
    ambulante: false,
    diarista: false,
    coco: false
  });

  const [pedidosAmbulante, setPedidosAmbulante] = useState<any[]>([]);
  const [activeCaminhao, setActiveCaminhao] = useState<any | null>(null);

  // Check configurations
  const hasMototaxi = user.kycStatus === "approved";
  const hasAmbulante = (() => { try { return localStorage.getItem(`amb_session_${user.uid}`) === "1"; } catch { return false; } })();
  const hasDiarista = (() => { try { return localStorage.getItem(`diarista_perfil_${user.uid}`) === "1"; } catch { return false; } })();
  const hasCoco = user.role === "cocoecia" || user.role === "cocoecia-colaborador" || user.role === "cocoecia-dirigentes" || (() => { try { return !!localStorage.getItem("caminhaoId"); } catch { return false; } })();

  useEffect(() => {
    const caminhaoId = localStorage.getItem("caminhaoId");
    if (!caminhaoId) {
      setActiveCaminhao(null);
      setActiveServices(prev => ({ ...prev, coco: false }));
      return;
    }

    const fetchActiveCaminhao = async () => {
      try {
        const { data, error } = await supabase
          .from("coco_caminhoes")
          .select("*")
          .eq("id", caminhaoId)
          .single();
        if (data) {
          setActiveCaminhao(data);
          setActiveServices(prev => ({ ...prev, coco: !!data.is_online }));
        } else {
          setActiveCaminhao(null);
          setActiveServices(prev => ({ ...prev, coco: false }));
        }
      } catch (err) {
        console.error("Erro ao buscar caminhão ativo no home:", err);
      }
    };

    fetchActiveCaminhao();

    const channel = supabase
      .channel(`public:coco_caminhoes:active:${caminhaoId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "coco_caminhoes", filter: `id=eq.${caminhaoId}` },
        (payload) => {
          const updated = payload.new as any;
          setActiveCaminhao(updated);
          setActiveServices(prev => ({ ...prev, coco: !!updated.is_online }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleService = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    if (activeRule && activeRule.blockRequests) {
      alert(`Serviço temporariamente bloqueado devido ao status: ${activeRule.label}`);
      return;
    }
    if (key === 'coco') {
      const caminhaoId = localStorage.getItem("caminhaoId");
      if (!caminhaoId) {
        alert("Selecione um veículo na Central do Coletor antes de ficar online.");
        navigate("/app/prestador/coco/online");
        return;
      }
      const newStatus = !activeServices.coco;
      try {
        const { error } = await supabase
          .from("coco_caminhoes")
          .update({ is_online: newStatus })
          .eq("id", caminhaoId);
        if (error) throw error;
        setActiveServices(prev => ({ ...prev, coco: newStatus }));
      } catch (err) {
        console.error("Erro ao alterar status do caminhão:", err);
      }
      return;
    }
    setActiveServices(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch Ambulante Pedidos if Ambulante is active
  useEffect(() => {
    if (!activeServices.ambulante || !user.uid) return;

    const fetchPedidos = async () => {
      const { data } = await supabase
        .from('pedidos')
        .select(`id, status, total, modalidade, delivery_address, delivery_referencia, pedido_itens(nome, qty, emoji)`)
        .eq('prestador_id', user.uid)
        .eq('status', 'pending');
      
      if (data) setPedidosAmbulante(data);
    };

    fetchPedidos();

    const channel = supabase
      .channel('public:pedidos:prestador')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos', filter: `prestador_id=eq.${user.uid}` }, () => {
        fetchPedidos();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `prestador_id=eq.${user.uid}` }, () => {
        fetchPedidos();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeServices.ambulante, user.uid]);

  const hasAnyActive = Object.values(activeServices).some(v => v);

  const handleServiceNavigate = (to: string) => {
    if (activeRule && activeRule.blockRequests) {
      alert(`Serviço temporariamente bloqueado devido ao status: ${activeRule.label}`);
      return;
    }
    navigate(to);
  };

  return (
    <div
      className="min-h-[100svh] overflow-y-auto"
      style={{ background: "#F7F8FA", padding: "24px", paddingBottom: "100px" }}
    >
      {activeRule && (
        <div
          style={{
            background: colors?.bg || "rgba(245,166,35,0.08)",
            border: `1px solid ${colors?.border || "rgba(245,166,35,0.20)"}`,
            color: colors?.color || "#F5A623",
            borderRadius: 20,
            padding: 16,
            marginBottom: 20,
            fontFamily: "DM Sans",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
            <AlertTriangle size={16} /> Atenção: Conta sob {activeRule.label}
          </div>
          <div>
            Sua conta está sob o status <strong>{activeRule.label}</strong>.
            As seguintes restrições estão ativas para você:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {activeRule.blockRequests && <span style={{ background: "rgba(0,0,0,0.05)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Prestar/Configurar serviços</span>}
            {activeRule.blockChat && <span style={{ background: "rgba(0,0,0,0.05)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Chat e mensagens</span>}
            {activeRule.blockPayments && <span style={{ background: "rgba(0,0,0,0.05)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Pagamentos/Saques</span>}
            {activeRule.hideProfile && <span style={{ background: "rgba(0,0,0,0.05)", borderRadius: 6, padding: "2px 6px", fontSize: 11 }}>Perfil oculto</span>}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold" style={{ color: "#0B1B3E" }}>
            Olá, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 font-sans text-[14px]" style={{ color: "#5B6178" }}>
            Pronto para ganhar dinheiro hoje?
          </p>
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: "#E6FAF4", border: "2px solid #0DB87E" }}
        >
          <span className="font-display text-[14px] font-bold" style={{ color: "#0DB87E" }}>
            {initials}
          </span>
        </div>
      </header>

      {/* Switch Hub no Topo */}
      <section className="mt-5 flex">
        <div
          className="inline-flex items-center rounded-full p-1 w-full"
          style={{ background: "#EFF0F3" }}
        >
          <button
            type="button"
            onClick={() => navigate("/app/home")}
            className="font-sans text-[13px] flex-1"
            style={{ color: "#9399AD", padding: "8px 0" }}
          >
            Tomador
          </button>
          <button
            type="button"
            className="rounded-full font-display text-[13px] font-semibold text-white shadow-sm flex-1"
            style={{ background: "#0DB87E", padding: "8px 0" }}
          >
            Prestador
          </button>
        </div>
      </section>

      {/* Ganhos Resumo - Clicável */}
      <button
        type="button"
        onClick={() => navigate("/app/gerenciar")}
        className="mt-6 w-full rounded-[20px] flex items-center justify-between text-left transition-transform active:scale-95"
        style={{
          background: "#0B1B3E",
          padding: "20px",
          boxShadow: "0 4px 16px rgba(11,27,62,0.15)",
        }}
      >
        <div>
          <p className="font-sans text-[12px] uppercase text-white/60" style={{ letterSpacing: "1px" }}>
            Ganhos da semana
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-display text-[24px] font-bold text-white">R$ 0,00</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
          <Wallet size={24} color="#0DB87E" />
        </div>
      </button>

      {/* Serviços Configurados */}
      <section className="mt-8">
        <h2 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E", marginBottom: 12 }}>
          Meus Serviços Ativos
        </h2>
        <div className="flex flex-col gap-3">
          
          {hasMototaxi && (
            <div
              className="flex items-center w-full bg-white rounded-[20px] p-4 text-left"
              style={{ boxShadow: "0 2px 8px rgba(11,27,62,0.04)", border: "1px solid #EFF0F3" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#E6FAF4" }}>
                <Bike size={24} color="#0DB87E" />
              </div>
              <div className="ml-4 flex-1 cursor-pointer" onClick={() => handleServiceNavigate("/app/prestador/mototaxi/online")}>
                <h3 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E" }}>Mototaxi</h3>
                <p className="font-sans text-[13px]" style={{ color: "#5B6178", marginTop: 2 }}>Corridas e Entregas</p>
              </div>
              <button
                type="button"
                onClick={(e) => toggleService(e, 'mototaxi')}
                className="w-[52px] h-[28px] rounded-full relative transition-colors"
                style={{ background: activeServices.mototaxi ? "#0DB87E" : "#D8DBE5" }}
              >
                <span
                  className="block w-6 h-6 bg-white rounded-full absolute top-[2px] transition-transform"
                  style={{ transform: activeServices.mototaxi ? "translateX(24px)" : "translateX(2px)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
                />
              </button>
            </div>
          )}

          {hasAmbulante && (
            <div
              className="flex items-center w-full bg-white rounded-[20px] p-4 text-left"
              style={{ boxShadow: "0 2px 8px rgba(11,27,62,0.04)", border: "1px solid #EFF0F3" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#E6FAF4" }}>
                <ShoppingBag size={24} color="#0DB87E" />
              </div>
              <div className="ml-4 flex-1 cursor-pointer" onClick={() => handleServiceNavigate("/app/prestador/ambulantes/online")}>
                <h3 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E" }}>Ambulante</h3>
                <p className="font-sans text-[13px]" style={{ color: "#5B6178", marginTop: 2 }}>Vendas de produtos</p>
              </div>
              <button
                type="button"
                onClick={(e) => toggleService(e, 'ambulante')}
                className="w-[52px] h-[28px] rounded-full relative transition-colors"
                style={{ background: activeServices.ambulante ? "#0DB87E" : "#D8DBE5" }}
              >
                <span
                  className="block w-6 h-6 bg-white rounded-full absolute top-[2px] transition-transform"
                  style={{ transform: activeServices.ambulante ? "translateX(24px)" : "translateX(2px)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
                />
              </button>
            </div>
          )}

          {hasDiarista && (
            <div
              className="flex items-center w-full bg-white rounded-[20px] p-4 text-left"
              style={{ boxShadow: "0 2px 8px rgba(11,27,62,0.04)", border: "1px solid #EFF0F3" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#E6FAF4" }}>
                <Sparkles size={24} color="#0DB87E" />
              </div>
              <div className="ml-4 flex-1 cursor-pointer" onClick={() => handleServiceNavigate("/app/prestador/diaristas/agenda")}>
                <h3 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E" }}>Diarista</h3>
                <p className="font-sans text-[13px]" style={{ color: "#5B6178", marginTop: 2 }}>Limpeza e Faxina</p>
              </div>
              <button
                type="button"
                onClick={(e) => toggleService(e, 'diarista')}
                className="w-[52px] h-[28px] rounded-full relative transition-colors"
                style={{ background: activeServices.diarista ? "#0DB87E" : "#D8DBE5" }}
              >
                <span
                  className="block w-6 h-6 bg-white rounded-full absolute top-[2px] transition-transform"
                  style={{ transform: activeServices.diarista ? "translateX(24px)" : "translateX(2px)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
                />
              </button>
            </div>
          )}

          {hasCoco && (
            <div
              className="flex items-center w-full bg-white rounded-[20px] p-4 text-left"
              style={{ boxShadow: "0 2px 8px rgba(11,27,62,0.04)", border: "1px solid #EFF0F3" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#E6FAF4" }}>
                <Recycle size={24} color="#0DB87E" />
              </div>
              <div className="ml-4 flex-1 cursor-pointer" onClick={() => handleServiceNavigate("/app/prestador/coco/online")}>
                <h3 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E" }}>Côco & Cia</h3>
                <p className="font-sans text-[13px]" style={{ color: "#5B6178", marginTop: 2 }}>Coleta e Reciclagem</p>
              </div>
              <button
                type="button"
                onClick={(e) => toggleService(e, 'coco')}
                className="w-[52px] h-[28px] rounded-full relative transition-colors"
                style={{ background: activeServices.coco ? "#0DB87E" : "#D8DBE5" }}
              >
                <span
                  className="block w-6 h-6 bg-white rounded-full absolute top-[2px] transition-transform"
                  style={{ transform: activeServices.coco ? "translateX(24px)" : "translateX(2px)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
                />
              </button>
            </div>
          )}

          {!hasMototaxi && !hasAmbulante && !hasDiarista && !hasCoco && (
            <div className="text-center py-6">
              <p className="font-sans text-[14px]" style={{ color: "#9399AD" }}>Você ainda não configurou nenhum serviço.</p>
            </div>
          )}
        </div>
      </section>

      {/* Pedidos Recebidos Area */}
      {hasAnyActive && (
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <span
              className="block w-2.5 h-2.5 rounded-full"
              style={{ background: "#0DB87E", animation: "ubt-pulse-dot 1.4s ease-in-out infinite" }}
            />
            <h2 className="font-display text-[16px] font-bold" style={{ color: "#0B1B3E" }}>
              Recebendo Pedidos...
            </h2>
          </div>

          <div className="flex flex-col gap-3">
            {/* Ambulante Orders */}
            {activeServices.ambulante && pedidosAmbulante.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-[#0DB87E] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#0DB87E] text-white font-sans text-[10px] font-bold uppercase px-3 py-1 rounded-bl-xl">
                  Novo Pedido
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#E6FAF4] flex items-center justify-center text-[18px]">
                    {p.pedido_itens?.[0]?.emoji || '🛍️'}
                  </div>
                  <div>
                    <p className="font-display text-[15px] font-bold text-[#0B1B3E]">Venda Ambulante</p>
                    <p className="font-sans text-[12px] text-[#5B6178]">{p.pedido_itens?.length || 0} itens • {p.modalidade === 'delivery' ? 'Entrega' : 'Retirada'}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-display text-[16px] font-bold text-[#0DB87E]">R$ {p.total.toFixed(2)}</p>
                  </div>
                </div>
                
                {p.modalidade === 'delivery' && (
                  <div className="bg-[#F7F8FA] rounded-xl p-3 mb-3">
                    <p className="font-sans text-[12px] text-[#5B6178] flex items-center gap-1">
                      <MapPin size={14} color="#E84040"/> {p.delivery_address || "Endereço não informado"}
                    </p>
                    {p.delivery_referencia && (
                      <p className="font-sans text-[11px] text-[#0B1B3E] font-semibold mt-1">
                        Ref: {p.delivery_referencia}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleServiceNavigate(`/app/prestador/ambulantes/pedido/${p.id}`)}
                  className="w-full bg-[#0DB87E] text-white font-display font-bold text-[14px] py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} /> Aceitar Pedido
                </button>
              </div>
            ))}

            {/* Ambulante Placeholder */}
            {activeServices.ambulante && pedidosAmbulante.length === 0 && (
              <div className="bg-white rounded-2xl p-4 border border-[#EFF0F3] shadow-sm text-center">
                <ShoppingBag size={28} color="#9399AD" className="mx-auto mb-2 opacity-50" />
                <p className="font-sans text-[13px] text-[#5B6178]">Aguardando novos pedidos de Ambulante...</p>
              </div>
            )}

            {/* Mototaxi Placeholder */}
            {activeServices.mototaxi && (
              <div className="bg-white rounded-2xl p-4 border border-[#EFF0F3] shadow-sm text-center">
                <Bike size={28} color="#9399AD" className="mx-auto mb-2 opacity-50" />
                <p className="font-sans text-[13px] text-[#5B6178]">Aguardando chamados de Mototaxi na sua região...</p>
              </div>
            )}

            {/* Diarista Placeholder */}
            {activeServices.diarista && (
              <div className="bg-white rounded-2xl p-4 border border-[#EFF0F3] shadow-sm text-center">
                <Sparkles size={28} color="#9399AD" className="mx-auto mb-2 opacity-50" />
                <p className="font-sans text-[13px] text-[#5B6178]">Você será notificado se surgirem serviços de limpeza compatíveis.</p>
              </div>
            )}
            
            {/* Coco Placeholder */}
            {activeServices.coco && (
              <div className="bg-white rounded-2xl p-4 border border-[#EFF0F3] shadow-sm text-center">
                <Recycle size={28} color="#9399AD" className="mx-auto mb-2 opacity-50" />
                <p className="font-sans text-[13px] text-[#5B6178]">Aguardando rotas de coleta na região.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Adicionar Novo Serviço */}
      <section className="mt-8">
        <h2 className="font-display text-[14px] font-bold" style={{ color: "#9399AD", marginBottom: 12, textTransform: "uppercase", letterSpacing: "1px" }}>
          Mais Oportunidades
        </h2>
        <div className="flex flex-col gap-3">
          {!hasMototaxi && (
            <button type="button" onClick={() => handleServiceNavigate("/app/prestador/mototaxi/onboarding")} className="flex items-center w-full bg-transparent border-2 border-dashed border-[#D8DBE5] rounded-[20px] p-4 text-left">
              <div className="w-10 h-10 rounded-full bg-[#EFF0F3] flex items-center justify-center flex-shrink-0"><Bike size={20} color="#9399AD" /></div>
              <div className="ml-3 flex-1"><h3 className="font-display text-[15px] font-bold text-[#5B6178]">Mototaxi</h3><p className="font-sans text-[12px] text-[#9399AD]">Configurar serviço</p></div>
              <ChevronRight size={18} color="#D8DBE5" />
            </button>
          )}
          {!hasAmbulante && (
            <button type="button" onClick={() => handleServiceNavigate("/app/prestador/ambulantes/onboarding")} className="flex items-center w-full bg-transparent border-2 border-dashed border-[#D8DBE5] rounded-[20px] p-4 text-left">
              <div className="w-10 h-10 rounded-full bg-[#EFF0F3] flex items-center justify-center flex-shrink-0"><ShoppingBag size={20} color="#9399AD" /></div>
              <div className="ml-3 flex-1"><h3 className="font-display text-[15px] font-bold text-[#5B6178]">Ambulante</h3><p className="font-sans text-[12px] text-[#9399AD]">Configurar vendas</p></div>
              <ChevronRight size={18} color="#D8DBE5" />
            </button>
          )}
          {!hasDiarista && (
            <button type="button" onClick={() => handleServiceNavigate("/app/prestador/diaristas/onboarding")} className="flex items-center w-full bg-transparent border-2 border-dashed border-[#D8DBE5] rounded-[20px] p-4 text-left">
              <div className="w-10 h-10 rounded-full bg-[#EFF0F3] flex items-center justify-center flex-shrink-0"><Sparkles size={20} color="#9399AD" /></div>
              <div className="ml-3 flex-1"><h3 className="font-display text-[15px] font-bold text-[#5B6178]">Diarista</h3><p className="font-sans text-[12px] text-[#9399AD]">Configurar agenda</p></div>
              <ChevronRight size={18} color="#D8DBE5" />
            </button>
          )}
          {!hasCoco && (
            <button type="button" onClick={() => handleServiceNavigate("/app/prestador/coco/onboarding")} className="flex items-center w-full bg-transparent border-2 border-dashed border-[#D8DBE5] rounded-[20px] p-4 text-left">
              <div className="w-10 h-10 rounded-full bg-[#EFF0F3] flex items-center justify-center flex-shrink-0"><Recycle size={20} color="#9399AD" /></div>
              <div className="ml-3 flex-1"><h3 className="font-display text-[15px] font-bold text-[#5B6178]">Côco & Cia</h3><p className="font-sans text-[12px] text-[#9399AD]">Tornar-se coletor</p></div>
              <ChevronRight size={18} color="#D8DBE5" />
            </button>
          )}
        </div>
      </section>



      <style>{`
        @keyframes ubt-pulse-dot {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
};

export default PrestadorHome;
