import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MapPin, 
  Recycle, 
  Truck, 
  Check, 
  X, 
  ShieldAlert, 
  Calendar, 
  BookOpen, 
  QrCode, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Download, 
  ExternalLink,
  Sparkles,
  Clock,
  Layers,
  Settings
} from "lucide-react";
import { Card, PrimaryButton, GhostButton, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getMaterial, MATERIAIS_COCO } from "@/mocks/cocoMateriais";
import { QRCodeCanvas } from "qrcode.react";

type AdminTab = "visao_geral" | "agenda_bairros" | "dicas_materiais" | "captacao";

interface AgendaBairro {
  id: string;
  bairro_nome: string;
  dia_semana: string;
  horario_inicio: string;
  horario_fim: string;
  is_active: boolean;
}

interface DicaMaterial {
  id: string;
  material_id: string;
  titulo?: string;
  conteudo_html: string;
}

const DIAS_SEMANA = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
];

export default function AdminCocoPage() {
  const toast = useAdminToast();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("visao_geral");

  // Frota e Pontos
  const [caminhoes, setCaminhoes] = useState<any[]>([]);
  const [pontos, setPontos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState(() => {
    try {
      return localStorage.getItem("coco_pix_fallback") || "coco@pix.com.br";
    } catch {
      return "coco@pix.com.br";
    }
  });

  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(null);

  // Agenda Bairros state
  const [agendas, setAgendas] = useState<AgendaBairro[]>([]);
  const [editingAgenda, setEditingAgenda] = useState<AgendaBairro | null>(null);
  const [agendaBairroNome, setAgendaBairroNome] = useState("");
  const [agendaDiaSemana, setAgendaDiaSemana] = useState("Segunda-feira");
  const [agendaHoraInicio, setAgendaHoraInicio] = useState("08:00");
  const [agendaHoraFim, setAgendaHoraFim] = useState("12:00");
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);

  // Dicas Materiais state
  const [dicas, setDicas] = useState<DicaMaterial[]>([]);
  const [editingDica, setEditingDica] = useState<DicaMaterial | null>(null);
  const [dicaMaterialId, setDicaMaterialId] = useState("plastico");
  const [dicaTitulo, setDicaTitulo] = useState("");
  const [dicaHtml, setDicaHtml] = useState("");
  const [isDicaModalOpen, setIsDicaModalOpen] = useState(false);

  // Captação QR Code ref
  const qrRef = useRef<HTMLDivElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const referralUserId = user?.uid || "entidade-cocoecia-oficial";
  const referralLink = `${window.location.origin}/cadastro?ref=${referralUserId}`;

  const fetchDados = async () => {
    try {
      // 1. Caminhões
      const { data: dataCaminhoes, error: errC } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (errC) throw errC;
      if (dataCaminhoes) setCaminhoes(dataCaminhoes);

      // 2. Pontos
      const { data: dataPontos, error: errP } = await supabase
        .from("coco_pontos")
        .select("*")
        .in("status", ["aguardando", "confirmado"])
        .order("created_at", { ascending: false });
      if (errP) throw errP;
      if (dataPontos) setPontos(dataPontos);

      // 3. Agenda
      const { data: dataAgenda, error: errA } = await supabase
        .from("coco_agenda_bairros")
        .select("*")
        .order("bairro_nome", { ascending: true });
      if (errA) throw errA;
      if (dataAgenda) setAgendas(dataAgenda);

      // 4. Dicas
      const { data: dataDicas, error: errD } = await supabase
        .from("coco_dicas_materiais")
        .select("*")
        .order("material_id", { ascending: true });
      if (errD) throw errD;
      if (dataDicas) setDicas(dataDicas);

    } catch (error: any) {
      console.error("Erro ao carregar dados do admin:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();

    // Inscrever canais realtime
    const channelCaminhoes = supabase
      .channel("admin-realtime-caminhoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "coco_caminhoes" }, () => fetchDados())
      .subscribe();

    const channelPontos = supabase
      .channel("admin-realtime-pontos")
      .on("postgres_changes", { event: "*", schema: "public", table: "coco_pontos" }, () => fetchDados())
      .subscribe();

    const channelAgenda = supabase
      .channel("admin-realtime-agenda")
      .on("postgres_changes", { event: "*", schema: "public", table: "coco_agenda_bairros" }, () => fetchDados())
      .subscribe();

    return () => {
      supabase.removeChannel(channelCaminhoes);
      supabase.removeChannel(channelPontos);
      supabase.removeChannel(channelAgenda);
    };
  }, []);

  const salvarPixFallback = () => {
    try {
      localStorage.setItem("coco_pix_fallback", pixKey);
      toast.show("Chave Pix de contingência atualizada!");
    } catch {
      toast.show("Erro ao salvar Pix");
    }
  };

  const aprovarCaminhao = async (caminhaoId: string, prestadorId: string, apelido: string, roleSolicitada?: string) => {
    const finalRole = roleSolicitada || "cocoecia-colaborador";
    try {
      const { error: errorC } = await supabase
        .from("coco_caminhoes")
        .update({ status_aprovacao: "approved" })
        .eq("id", caminhaoId);

      if (errorC) throw errorC;

      if (prestadorId) {
        await supabase.from("usuarios").update({ role: finalRole }).eq("id", prestadorId);
        await supabase.from("profiles").update({ role: finalRole }).eq("id", prestadorId);
      }

      toast.show(`Caminhão "${apelido}" aprovado com sucesso!`);
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao aprovar: ${err.message}`);
    }
  };

  const rejeitarCaminhao = async (caminhaoId: string, apelido: string) => {
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({ status_aprovacao: "rejected" })
        .eq("id", caminhaoId);

      if (error) throw error;
      toast.show(`Caminhão "${apelido}" rejeitado.`);
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao rejeitar: ${err.message}`);
    }
  };

  // --- CRUD AGENDA DE BAIRROS ---
  const handleOpenAgendaModal = (item?: AgendaBairro) => {
    if (item) {
      setEditingAgenda(item);
      setAgendaBairroNome(item.bairro_nome);
      setAgendaDiaSemana(item.dia_semana);
      setAgendaHoraInicio(item.horario_inicio);
      setAgendaHoraFim(item.horario_fim);
    } else {
      setEditingAgenda(null);
      setAgendaBairroNome("");
      setAgendaDiaSemana("Segunda-feira");
      setAgendaHoraInicio("08:00");
      setAgendaHoraFim("12:00");
    }
    setIsAgendaModalOpen(true);
  };

  const handleSaveAgenda = async () => {
    if (!agendaBairroNome.trim()) {
      toast.show("Informe o nome do bairro.");
      return;
    }

    try {
      if (editingAgenda) {
        const { error } = await supabase
          .from("coco_agenda_bairros")
          .update({
            bairro_nome: agendaBairroNome.trim(),
            dia_semana: agendaDiaSemana,
            horario_inicio: agendaHoraInicio,
            horario_fim: agendaHoraFim,
          })
          .eq("id", editingAgenda.id);
        if (error) throw error;
        toast.show("Agenda de coleta atualizada!");
      } else {
        const { error } = await supabase
          .from("coco_agenda_bairros")
          .insert({
            bairro_nome: agendaBairroNome.trim(),
            dia_semana: agendaDiaSemana,
            horario_inicio: agendaHoraInicio,
            horario_fim: agendaHoraFim,
            is_active: true,
          });
        if (error) throw error;
        toast.show("Novo bairro adicionado à rota!");
      }
      setIsAgendaModalOpen(false);
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao salvar agenda: ${err.message}`);
    }
  };

  const handleDeleteAgenda = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja remover ${nome} da agenda de coleta?`)) return;
    try {
      const { error } = await supabase.from("coco_agenda_bairros").delete().eq("id", id);
      if (error) throw error;
      toast.show(`Bairro ${nome} removido.`);
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleToggleAgendaActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from("coco_agenda_bairros")
        .update({ is_active: !current })
        .eq("id", id);
      if (error) throw error;
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao alterar status: ${err.message}`);
    }
  };

  // --- CRUD DICAS MATERIAIS ---
  const handleOpenDicaModal = (item?: DicaMaterial) => {
    if (item) {
      setEditingDica(item);
      setDicaMaterialId(item.material_id);
      setDicaTitulo(item.titulo || "");
      setDicaHtml(item.conteudo_html);
    } else {
      setEditingDica(null);
      setDicaMaterialId("plastico");
      setDicaTitulo("");
      setDicaHtml("");
    }
    setIsDicaModalOpen(true);
  };

  const handleSaveDica = async () => {
    if (!dicaHtml.trim()) {
      toast.show("Preencha o conteúdo informativo.");
      return;
    }

    try {
      if (editingDica) {
        const { error } = await supabase
          .from("coco_dicas_materiais")
          .update({
            material_id: dicaMaterialId,
            titulo: dicaTitulo.trim() || `Como descartar ${dicaMaterialId}`,
            conteudo_html: dicaHtml,
          })
          .eq("id", editingDica.id);
        if (error) throw error;
        toast.show("Manual de descarte atualizado!");
      } else {
        const { error } = await supabase
          .from("coco_dicas_materiais")
          .insert({
            material_id: dicaMaterialId,
            titulo: dicaTitulo.trim() || `Como descartar ${dicaMaterialId}`,
            conteudo_html: dicaHtml,
          });
        if (error) throw error;
        toast.show("Novo manual de descarte cadastrado!");
      }
      setIsDicaModalOpen(false);
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao salvar dica: ${err.message}`);
    }
  };

  const handleDeleteDica = async (id: string) => {
    if (!window.confirm("Deseja remover este manual informativo?")) return;
    try {
      const { error } = await supabase.from("coco_dicas_materiais").delete().eq("id", id);
      if (error) throw error;
      toast.show("Manual removido.");
      fetchDados();
    } catch (err: any) {
      toast.show(`Erro ao excluir: ${err.message}`);
    }
  };

  // --- CAPTAÇÃO QR CODE DOWNLOAD & COPY ---
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      toast.show("Link de apadrinhamento copiado!");
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      toast.show("Erro ao copiar link");
    }
  };

  const handleDownloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) {
      toast.show("Erro ao gerar imagem do QR Code");
      return;
    }
    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `qrcode_captacao_cocoecia_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.show("QR Code baixado com sucesso!");
  };

  const caminhoesPendentes = caminhoes.filter((c) => c.status_aprovacao === "pending");
  const caminhoesAprovados = caminhoes.filter((c) => c.status_aprovacao === "approved");
  const caminhoesOnline = caminhoesAprovados.filter((c) => c.is_online);

  return (
    <div style={{ padding: 32 }}>
      <style>{`
        @keyframes adminPulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
        .admin-pulse-active {
          animation: adminPulse 1.6s infinite ease-in-out;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(13,184,126,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Recycle size={24} color="#0DB87E" />
          </div>
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Côco & Cia — Centro de Gestão Logística
            </h1>
            <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
              Controle de frota, agenda de rotas, manuais educativos e captação de parceiros.
            </p>
          </div>
        </div>

        {/* Tab Navigation & Subroutes */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--admin-card-bg)", padding: 4, borderRadius: 12, border: "1px solid var(--admin-border)" }}>
            {[
              { id: "visao_geral", label: "Mapa & Frota", icon: Layers },
              { id: "agenda_bairros", label: "Agenda de Bairros", icon: Calendar },
              { id: "dicas_materiais", label: "Manuais & Dicas", icon: BookOpen },
              { id: "captacao", label: "Captação & QR Code", icon: QrCode },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as AdminTab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: active ? "#0DB87E" : "transparent",
                    color: active ? "white" : "var(--admin-subtle)",
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => navigate("/admin/coco/frota")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-card-bg)",
              color: "var(--admin-text)",
              fontFamily: "DM Sans",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Truck size={16} color="#0DB87E" /> Frota
          </button>

          <button
            onClick={() => navigate("/admin/coco/config")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-card-bg)",
              color: "var(--admin-text)",
              fontFamily: "DM Sans",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Settings size={16} /> Configurações
          </button>
        </div>
      </div>

      {/* TAB 1: VISÃO GERAL & FROTA */}
      {activeTab === "visao_geral" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) 1fr", gap: 24 }}>
          {/* Coluna da Esquerda (Controle e Listas) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            {/* Card de Configuração Pix Fallback */}
            <Card style={{ padding: 24 }}>
              <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Chave Pix de Contingência</div>
              <div style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", marginTop: 4 }}>
                Usada como chave de doação caso nenhum coletor esteja ativo no momento.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <input
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  style={inputStyle}
                />
                <PrimaryButton onClick={salvarPixFallback}>Salvar</PrimaryButton>
              </div>
            </Card>

            {/* Card de Solicitações Pendentes (Aprovações) */}
            <Card style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "var(--admin-text)", display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldAlert size={18} color="#F5A623" />
                  Aprovações Pendentes
                </div>
                <Pill bg={caminhoesPendentes.length > 0 ? "rgba(245,166,35,0.15)" : "var(--admin-bg)"} color={caminhoesPendentes.length > 0 ? "#F5A623" : "var(--admin-muted)"} size="sm">
                  {caminhoesPendentes.length}
                </Pill>
              </div>

              {loading ? (
                <div style={loadingStyle}>Carregando...</div>
              ) : caminhoesPendentes.length === 0 ? (
                <div style={emptyCardStyle}>
                  <span style={{ fontSize: 24, marginBottom: 6 }}>🌱</span>
                  <p style={{ margin: 0, fontWeight: 600 }}>Tudo em dia!</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--admin-muted)", marginTop: 2 }}>Nenhuma solicitação pendente no momento.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {caminhoesPendentes.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: "var(--admin-bg)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 12,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                            {c.apelido}
                          </span>
                          <span style={{ background: "#E2E8F0", fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "var(--admin-text)", borderRadius: 6, padding: "2px 6px" }}>
                            {c.plate}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0", fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>
                          <strong>Função:</strong> {c.role_solicitada === "cocoecia-dirigentes" ? "💼 Dirigente" : "🚚 Colaborador"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>
                          <strong>Bairros:</strong> {c.areas_atendidas?.join(", ") || "Nenhum"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>
                          <strong>Pix:</strong> {c.pix_key || "Não informada (Colaborador)"}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => aprovarCaminhao(c.id, c.prestador_id, c.apelido, c.role_solicitada)}
                          style={{
                            flex: 1,
                            height: 32,
                            background: "#0DB87E",
                            color: "white",
                            border: "none",
                            borderRadius: 8,
                            fontFamily: "DM Sans",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          <Check size={14} /> Aprovar
                        </button>
                        <button
                          onClick={() => rejeitarCaminhao(c.id, c.apelido)}
                          style={{
                            height: 32,
                            padding: "0 10px",
                            background: "transparent",
                            color: "#E84040",
                            border: "1px solid #E84040",
                            borderRadius: 8,
                            fontFamily: "DM Sans",
                            fontSize: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4
                          }}
                        >
                          <X size={14} /> Rejeitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Card de Caminhões Aprovados */}
            <Card style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>Veículos da Frota</div>
                <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                  {caminhoesAprovados.length}
                </Pill>
              </div>

              {caminhoesAprovados.length === 0 ? (
                <div style={emptyCardStyle}>
                  <p style={{ margin: 0 }}>Nenhum caminhão cadastrado na frota.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {caminhoesAprovados.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        background: "var(--admin-bg)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 12,
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative" }}>
                          <Truck size={20} color={c.is_online ? "#0DB87E" : "var(--admin-muted)"} />
                          {c.is_online && (
                            <span className="admin-pulse-active" style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, background: "#0DB87E", borderRadius: "50%" }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontFamily: "Syne", fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>
                            {c.apelido}
                          </div>
                          <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "var(--admin-subtle)" }}>
                            {c.plate} · {c.collections_today || 0} coletas hoje
                          </div>
                        </div>
                      </div>
                      <Pill bg={c.is_online ? "rgba(13,184,126,0.15)" : "var(--admin-border)"} color={c.is_online ? "#0DB87E" : "var(--admin-muted)"} size="sm">
                        {c.is_online ? "Online" : "Offline"}
                      </Pill>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Coluna da Direita (Mapa Operacional) */}
          <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 400 }}>
            <div className="w-full h-[400px] bg-slate-800 flex items-center justify-center font-bold text-slate-400 rounded-lg border border-slate-700">
              Mapa de Operações Temporariamente Desativado (Aguardando Dados)
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: AGENDA DE BAIRROS (CRUD) */}
      {activeTab === "agenda_bairros" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                Escala de Coleta por Bairros (Rotas Semanais)
              </h2>
              <p style={{ margin: "4px 0 0", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                Define os dias e horários em que os caminhões atendem cada região de Ubatuba para a trava geográfica do cidadão.
              </p>
            </div>
            <button
              onClick={() => handleOpenAgendaModal()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#0DB87E",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              <Plus size={16} /> Adicionar Bairro
            </button>
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-subtle)", fontSize: 12, textTransform: "uppercase" }}>
                  <th style={{ padding: "16px 20px" }}>Bairro</th>
                  <th style={{ padding: "16px 20px" }}>Dia da Semana</th>
                  <th style={{ padding: "16px 20px" }}>Horário de Coleta</th>
                  <th style={{ padding: "16px 20px" }}>Status</th>
                  <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {agendas.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px 20px", textAlign: "center", color: "var(--admin-muted)" }}>
                      Nenhum bairro cadastrado na rota.
                    </td>
                  </tr>
                ) : (
                  agendas.map((ag) => (
                    <tr key={ag.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                      <td style={{ padding: "16px 20px", fontWeight: 700, color: "var(--admin-text)" }}>
                        {ag.bairro_nome}
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(13,184,126,0.1)", color: "#0DB87E", padding: "4px 10px", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>
                          <Calendar size={13} /> {ag.dia_semana}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Clock size={14} color="var(--admin-muted)" /> {ag.horario_inicio} às {ag.horario_fim}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <button
                          onClick={() => handleToggleAgendaActive(ag.id, ag.is_active)}
                          style={{
                            border: "none",
                            background: ag.is_active ? "rgba(13,184,126,0.15)" : "var(--admin-border)",
                            color: ag.is_active ? "#0DB87E" : "var(--admin-muted)",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          {ag.is_active ? "🟢 Ativo na Rota" : "⚪ Pausado"}
                        </button>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            onClick={() => handleOpenAgendaModal(ag)}
                            style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 6 }}
                            title="Editar Bairro"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAgenda(ag.id, ag.bairro_nome)}
                            style={{ background: "transparent", border: "none", color: "#E84040", cursor: "pointer", padding: 6 }}
                            title="Remover Bairro"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* TAB 3: DICAS & MANUAIS EDUCATIVOS (CRUD) */}
      {activeTab === "dicas_materiais" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                Manuais Educativos de Descarte
              </h2>
              <p style={{ margin: "4px 0 0", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                Orientações exibidas no aplicativo dos cidadãos para separação e higienização correta dos recicláveis.
              </p>
            </div>
            <button
              onClick={() => handleOpenDicaModal()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#0DB87E",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              <Plus size={16} /> Nova Dica / Manual
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
            {dicas.map((dica) => {
              const mat = getMaterial(dica.material_id);
              return (
                <Card key={dica.id} style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 28, background: `${mat.cor}15`, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {mat.emoji}
                        </span>
                        <div>
                          <span style={{ fontSize: 11, fontMono: "monospace", textTransform: "uppercase", color: mat.cor, fontWeight: 700 }}>
                            {dica.material_id}
                          </span>
                          <h3 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                            {dica.titulo || `Como descartar ${dica.material_id}`}
                          </h3>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => handleOpenDicaModal(dica)}
                          style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 4 }}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteDica(dica.id)}
                          style={{ background: "transparent", border: "none", color: "#E84040", cursor: "pointer", padding: 4 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--admin-subtle)",
                        background: "var(--admin-bg)",
                        padding: 12,
                        borderRadius: 10,
                        border: "1px solid var(--admin-border)"
                      }}
                      dangerouslySetInnerHTML={{ __html: dica.conteudo_html }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: CAPTAÇÃO & QR CODE DE AFILIAÇÃO (Req 7) */}
      {activeTab === "captacao" && (
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <Card style={{ padding: 36, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(13,184,126,0.12)", color: "#0DB87E", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <QrCode size={36} />
            </div>

            <h2 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              QR Code Oficial de Apadrinhamento & Captação
            </h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", marginTop: 6, maxWidth: 540, margin: "6px auto 28px" }}>
              Imprima este QR Code ou compartilhe o link direto em panfletos, adesivos para caminhões e quiosques parceiros. Todo usuário ou coletor cadastrado por ele será vinculado à Côco & Cia.
            </p>

            {/* QR Code Container */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div
                ref={qrRef}
                style={{
                  background: "white",
                  padding: 24,
                  borderRadius: 24,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                  border: "4px solid #0DB87E",
                  display: "inline-block"
                }}
              >
                <QRCodeCanvas
                  value={referralLink}
                  size={240}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "/favicon.ico",
                    x: undefined,
                    y: undefined,
                    height: 38,
                    width: 38,
                    excavate: true,
                  }}
                />
              </div>
            </div>

            {/* Referral Link Box */}
            <div style={{ display: "flex", gap: 10, maxWidth: 580, margin: "0 auto 24px" }}>
              <input
                readOnly
                value={referralLink}
                style={{
                  flex: 1,
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 12,
                  padding: "0 16px",
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: "var(--admin-text)",
                  outline: "none"
                }}
              />
              <button
                onClick={handleCopyLink}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: copiedLink ? "#0C9562" : "#0DB87E",
                  color: "white",
                  border: "none",
                  borderRadius: 12,
                  padding: "0 20px",
                  height: 46,
                  fontFamily: "Syne",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "background 0.2s"
                }}
              >
                {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedLink ? "Copiado!" : "Copiar Link"}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
              <button
                onClick={handleDownloadQr}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--admin-text)",
                  color: "var(--admin-card-bg)",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 24px",
                  fontFamily: "Syne",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                <Download size={18} /> Baixar QR Code (PNG)
              </button>

              <button
                onClick={() => window.open(referralLink, "_blank")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "transparent",
                  color: "var(--admin-text)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 12,
                  padding: "12px 24px",
                  fontFamily: "Syne",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                <ExternalLink size={18} /> Testar Cadastro
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL DE AGENDA DE BAIRRO */}
      {isAgendaModalOpen && (
        <div style={modalBackdropStyle} onClick={() => setIsAgendaModalOpen(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                {editingAgenda ? "Editar Bairro da Agenda" : "Novo Bairro na Escala"}
              </h3>
              <button onClick={() => setIsAgendaModalOpen(false)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Nome do Bairro</label>
                <input
                  value={agendaBairroNome}
                  onChange={(e) => setAgendaBairroNome(e.target.value)}
                  placeholder="Ex: Praia Grande, Centro, Toninhas..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Dia da Semana</label>
                <select
                  value={agendaDiaSemana}
                  onChange={(e) => setAgendaDiaSemana(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia} value={dia}>{dia}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Horário Início</label>
                  <input
                    type="time"
                    value={agendaHoraInicio}
                    onChange={(e) => setAgendaHoraInicio(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Horário Fim</label>
                  <input
                    type="time"
                    value={agendaHoraFim}
                    onChange={(e) => setAgendaHoraFim(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  onClick={() => setIsAgendaModalOpen(false)}
                  style={{ ...ghostBtnStyle, flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAgenda}
                  style={{ ...primaryBtnStyle, flex: 1 }}
                >
                  Salvar Rota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DICA MATERIAL */}
      {isDicaModalOpen && (
        <div style={modalBackdropStyle} onClick={() => setIsDicaModalOpen(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                {editingDica ? "Editar Manual de Descarte" : "Novo Manual de Descarte"}
              </h3>
              <button onClick={() => setIsDicaModalOpen(false)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Categoria do Material</label>
                <select
                  value={dicaMaterialId}
                  onChange={(e) => setDicaMaterialId(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  {MATERIAIS_COCO.map((m) => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Título do Manual</label>
                <input
                  value={dicaTitulo}
                  onChange={(e) => setDicaTitulo(e.target.value)}
                  placeholder="Ex: Como descartar garrafas e potes de vidro"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Conteúdo Informativo (HTML / Texto)</label>
                <textarea
                  rows={6}
                  value={dicaHtml}
                  onChange={(e) => setDicaHtml(e.target.value)}
                  placeholder="<p>Instruções claras para o cidadão...</p>"
                  style={{
                    ...inputStyle,
                    height: "auto",
                    padding: 12,
                    fontFamily: "monospace",
                    fontSize: 13,
                    width: "100%",
                    resize: "vertical"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  onClick={() => setIsDicaModalOpen(false)}
                  style={{ ...ghostBtnStyle, flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveDica}
                  style={{ ...primaryBtnStyle, flex: 1 }}
                >
                  Salvar Manual
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  height: 42,
  padding: "0 14px",
  fontFamily: "DM Sans",
  fontSize: 14,
  color: "var(--admin-text)",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontFamily: "DM Sans",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--admin-subtle)",
  marginBottom: 6,
};

const loadingStyle = {
  fontFamily: "DM Sans",
  fontSize: 14,
  color: "var(--admin-muted)",
  textAlign: "center" as const,
  padding: "24px 0",
};

const emptyCardStyle = {
  border: "2px dashed var(--admin-border)",
  borderRadius: 12,
  padding: "20px 14px",
  textAlign: "center" as const,
  fontFamily: "DM Sans",
  fontSize: 13,
  color: "var(--admin-subtle)",
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "center"
};

const mapOverlayStyle = {
  position: "absolute" as const,
  bottom: 0,
  left: 0,
  right: 0,
  background: "rgba(255, 255, 255, 0.92)",
  backdropFilter: "blur(4px)",
  borderTop: "1px solid #E2E8F0",
  padding: "10px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontFamily: "DM Sans",
  fontSize: 13,
  zIndex: 1000
};

const modalBackdropStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16
};

const modalBoxStyle = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 20,
  padding: 24,
  maxWidth: 480,
  width: "100%",
  boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "var(--admin-muted)",
  cursor: "pointer",
  padding: 4
};

const primaryBtnStyle = {
  background: "#0DB87E",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 18px",
  fontFamily: "Syne",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const ghostBtnStyle = {
  background: "transparent",
  color: "var(--admin-subtle)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  padding: "12px 18px",
  fontFamily: "Syne",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
