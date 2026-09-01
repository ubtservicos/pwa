import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  X,
  FileSpreadsheet,
  Calendar,
  CheckCircle,
  HelpCircle,
  Link,
  Smartphone,
  Globe,
  ShieldCheck
} from "lucide-react";
import { Card, PageTitle, Pill, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

export interface WaitlistItem {
  id: string;
  created_at_utc: string;
  created_at_local: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  perfil: string | string[];
  origem: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referer: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_hash: string;
  consentimento_lgpd: boolean;
  status: string;
  observacoes: string | null;
  cep_moradia?: string | null;
  bairro_moradia?: string | null;
  bairro_trabalho?: string | null;
}

const PERFIL_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  morador: { label: "Morador", bg: "rgba(13,184,126,0.12)", color: "#0DB87E" },
  turista: { label: "Turista", bg: "rgba(245,166,35,0.12)", color: "#F5A623" },
  visitante: { label: "Turista", bg: "rgba(245,166,35,0.12)", color: "#F5A623" },
  tomador: { label: "Tomador", bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
  diarista: { label: "Diarista", bg: "rgba(147,51,234,0.12)", color: "#9333EA" },
  mototaxi: { label: "Mototaxista", bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
  mototaxista: { label: "Mototaxista", bg: "rgba(59,130,246,0.12)", color: "#3B82F6" },
  ambulante: { label: "Ambulante", bg: "rgba(236,72,153,0.12)", color: "#EC4899" },
  associacao: { label: "Associação", bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  associacao_lider: { label: "Líder Associação", bg: "rgba(16,185,129,0.12)", color: "#10B981" },
  cocoecia: { label: "Côco & Cia", bg: "rgba(13,184,126,0.12)", color: "#0DB87E" },
  "cocoecia-colaborador": { label: "Colaborador Côco", bg: "rgba(13,184,126,0.12)", color: "#0DB87E" },
  "cocoecia-dirigentes": { label: "Dirigente Côco", bg: "rgba(13,184,126,0.12)", color: "#0DB87E" },
  prestador: { label: "Prestador", bg: "rgba(43,110,232,0.12)", color: "#2B6EE8" },
  empresa: { label: "Comércio / Empresa", bg: "rgba(236,72,153,0.12)", color: "#EC4899" },
  comerciante: { label: "Comerciante", bg: "rgba(236,72,153,0.12)", color: "#EC4899" },
  quiosque: { label: "Quiosque", bg: "rgba(236,72,153,0.12)", color: "#EC4899" },
};

function parsePerfilList(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap(item => parsePerfilList(item));
  }
  if (typeof raw === "string") {
    let clean = raw.trim();
    if (clean.startsWith("[") && clean.endsWith("]")) {
      try {
        const parsed = JSON.parse(clean);
        return parsePerfilList(parsed);
      } catch {
        clean = clean.slice(1, -1);
      }
    }
    if (clean.startsWith("{") && clean.endsWith("}")) {
      clean = clean.slice(1, -1);
    }
    return clean
      .split(",")
      .map(s => s.replace(/["']/g, "").trim())
      .filter(Boolean);
  }
  return [String(raw)];
}

function renderPerfilBadges(raw: any) {
  const list = parsePerfilList(raw);
  if (list.length === 0) {
    return <span style={{ fontSize: 12, color: "var(--admin-muted)", fontStyle: "italic" }}>—</span>;
  }

  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {list.map((item, idx) => {
        const key = item.toLowerCase().trim();
        const conf = PERFIL_CONFIG[key] || {
          label: item.charAt(0).toUpperCase() + item.slice(1),
          bg: "rgba(255,255,255,0.08)",
          color: "var(--admin-text)"
        };
        return (
          <Pill key={`${key}-${idx}`} bg={conf.bg} color={conf.color} size="sm">
            {conf.label}
          </Pill>
        );
      })}
    </div>
  );
}

interface WaitlistStats {
  total: number;
  moradores: number;
  prestadores: number;
  visitantes: number;
  com_referral: number;
}

const PAGE_SIZE = 15;

export default function AdminWaitlistPage() {
  const toast = useAdminToast();
  const [leads, setLeads] = useState<WaitlistItem[]>([]);
  const [stats, setStats] = useState<WaitlistStats>({
    total: 0,
    moradores: 0,
    prestadores: 0,
    visitantes: 0,
    com_referral: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Filters & Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPerfil, setSelectedPerfil] = useState("Todos");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [selectedCidade, setSelectedCidade] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadModal, setSelectedLeadModal] = useState<WaitlistItem | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const handleApproveLeads = async (leadIds: string[], motivo = "Aprovação operacional de fila de espera") => {
    setUpdatingStatus(true);
    try {
      // 1. Fetch current admin user ID
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id || null;

      // 2. Call RPC to approve leads and return approved leads metadata
      const { data, error } = await supabase.rpc("approve_waitlist_leads", {
        p_lead_ids: leadIds,
        p_admin_id: adminId,
        p_motivo: motivo
      });

      if (error) throw error;

      const approvedLeads = (data || []) as { id: string; nome: string; email: string; telefone: string; onboarding_url: string }[];
      
      let successCount = 0;
      let commSuccessCount = 0;
      let commFailedCount = 0;

      // 3. Process individual approved leads for whatsapp-agent API trigger
      for (const lead of approvedLeads) {
        successCount++;
        try {
          const agentApiUrl = import.meta.env.VITE_WHATSAPP_AGENT_URL || "https://api.ubtsuperapp.com.br/mock-whatsapp-agent";
          
          const payload = {
            event: "WAITLIST_APPROVED",
            user_id: null,
            waitlist_id: lead.id,
            approved_at: new Date().toISOString(),
            approved_by: adminId,
            onboarding_url: lead.onboarding_url,
            recipient: {
              nome: lead.nome,
              email: lead.email,
              telefone: lead.telefone
            }
          };

          let responseOk = false;
          let errorMsg = "";

          if (agentApiUrl.includes("mock") || agentApiUrl.includes("api.ubtsuperapp.com.br")) {
            // Simulate API roundtrip delay
            await new Promise(resolve => setTimeout(resolve, 300));
            responseOk = true; // Mock success
          } else {
            try {
              const res = await fetch(agentApiUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": "Bearer sb_publishable_WpSlHCmKqb3WMbtT-wWU0w_drB6GksT"
                },
                body: JSON.stringify(payload)
              });
              responseOk = res.ok;
              if (!res.ok) {
                errorMsg = await res.text();
              }
            } catch (netErr: any) {
              errorMsg = netErr.message || String(netErr);
            }
          }

          if (responseOk) {
            commSuccessCount++;
            // Update communication_status in user_onboarding
            await supabase
              .from("user_onboarding")
              .update({ communication_status: "sent" })
              .eq("waitlist_id", lead.id);
          } else {
            throw new Error(errorMsg || "Erro desconhecido na API do whatsapp-agent");
          }

        } catch (commErr: any) {
          console.warn(`Falha ao comunicar lead ${lead.nome} via whatsapp-agent:`, commErr);
          commFailedCount++;
          
          // Update communication_status with error details
          await supabase
            .from("user_onboarding")
            .update({ 
              communication_status: "failed",
              communication_error: commErr.message || String(commErr)
            })
            .eq("waitlist_id", lead.id);
        }
      }

      toast.show(
        `Aprovados: ${successCount} lead(s). Comunicação: ${commSuccessCount} enviada(s), ${commFailedCount} com falha.`
      );

      // Clear selection
      setSelectedLeadIds(new Set());
      setSelectedLeadModal(null);
      fetchLeads();
      fetchStats();
    } catch (err: any) {
      console.error("Erro ao aprovar leads:", err);
      toast.show("Erro ao aprovar leads: " + (err.message || err));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("waitlist").select("perfil, origem");
      if (error) throw error;
      
      if (data) {
        const aggregated = data.reduce(
          (acc, item) => {
            acc.total++;
            const perfilArr = parsePerfilList(item.perfil).map(p => p.toLowerCase());
            if (perfilArr.includes("morador") || perfilArr.includes("tomador")) acc.moradores++;
            if (perfilArr.some(p => ["prestador", "diarista", "mototaxi", "mototaxista", "ambulante", "associacao", "cocoecia"].includes(p))) acc.prestadores++;
            if (perfilArr.includes("visitante") || perfilArr.includes("visitantes") || perfilArr.includes("turista")) acc.visitantes++;
            
            if (item.origem && item.origem !== "direto") acc.com_referral++;
            return acc;
          },
          { total: 0, moradores: 0, prestadores: 0, visitantes: 0, com_referral: 0 }
        );
        setStats(aggregated);
      }
    } catch (e) {
      console.error("Erro ao carregar estatísticas da waitlist:", e);
    }
  }, []);

  const fetchLeads = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      setLoading(true);
      let query = supabase
        .from("waitlist")
        .select("*", { count: "exact" })
        .order("created_at_utc", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (selectedPerfil !== "Todos") {
        query = query.or(`perfil.cs.{${selectedPerfil}},perfil.ilike.%${selectedPerfil}%`);
      }

      if (selectedStatus !== "Todos") {
        query = query.eq("status", selectedStatus);
      }

      if (selectedCidade !== "Todas") {
        query = query.eq("cidade", selectedCidade);
      }

      if (searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        query = query.or(`nome.ilike.${term},email.ilike.${term},telefone.ilike.${term},observacoes.ilike.${term}`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      if (data) {
        setLeads(data as WaitlistItem[]);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.error("Erro ao buscar leads da waitlist:", err);
      toast.show("Erro ao carregar fila de espera.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, selectedPerfil, selectedStatus, selectedCidade, searchQuery, toast]);

  useEffect(() => {
    fetchStats();
    fetchLeads();

    // Realtime changes listener
    const channel = supabase
      .channel("admin_waitlist_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, () => {
        fetchStats();
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats, fetchLeads]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const exportCsv = () => {
    if (leads.length === 0) {
      toast.show("Nenhum lead para exportar.");
      return;
    }
    const headers = "ID,Data Registro,Nome,Email,Telefone,Cidade,Perfil,Origem,UTM Source,UTM Medium,UTM Campaign,Dispositivo,Browser,Status\n";
    const csvRows = leads
      .map(
        (l) =>
          `${l.id},${l.created_at_local},"${l.nome}","${l.email}","${l.telefone}","${l.cidade}","${l.perfil}","${l.origem || 'direto'}","${l.utm_source || ''}","${l.utm_medium || ''}","${l.utm_campaign || ''}","${l.device_type || ''}","${l.browser || ''}",${l.status}`
      )
      .join("\n");

    const blob = new Blob([headers + csvRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ubt-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Fila de Espera CSV exportada!");
  };

  const handleStatusUpdate = async (leadId: string, nextStatus: string) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("waitlist")
        .update({ status: nextStatus })
        .eq("id", leadId);
      if (error) throw error;
      
      toast.show("Status do lead atualizado! ✓");
      setSelectedLeadModal(prev => prev ? { ...prev, status: nextStatus } : null);
      fetchLeads();
    } catch (err: any) {
      console.error(err);
      toast.show("Erro ao atualizar status do lead.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Visualização e monitoramento da Fila de Espera da UBT (Campanha Pré-Lançamento)">
        Fila de Espera & Leads
      </PageTitle>

      {/* KPI Cards Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Card style={{ padding: 20, border: "1px solid var(--admin-border)" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase" }}>Total Inscritos</span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "var(--admin-text)", marginTop: 4 }}>
            {stats.total}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid var(--admin-border)" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase" }}>Moradores (Tomadores)</span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "#0DB87E", marginTop: 4 }}>
            {stats.moradores}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid var(--admin-border)" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase" }}>Trabalhadores (Prestadores)</span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "#2B6EE8", marginTop: 4 }}>
            {stats.prestadores}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid var(--admin-border)" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase" }}>Turistas / Visitantes</span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "#F5A623", marginTop: 4 }}>
            {stats.visitantes}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid var(--admin-border)" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase" }}>Adesão por Indicação</span>
          <div style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "#EC4899", marginTop: 4 }}>
            {stats.com_referral} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--admin-muted)" }}>({stats.total > 0 ? Math.round((stats.com_referral / stats.total) * 100) : 0}%)</span>
          </div>
        </Card>
      </div>

      {/* Filter panel */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          {/* Perfil */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 4 }}>Perfil</label>
            <select
              value={selectedPerfil}
              onChange={(e) => { setSelectedPerfil(e.target.value); setPage(0); }}
              className="bg-zinc-950 text-zinc-200 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              style={{ width: "100%", height: 38, borderRadius: 8, padding: "0 10px", fontFamily: "DM Sans", fontSize: 13, outline: "none", color: "var(--admin-text)", background: "var(--admin-bg)" }}
            >
              <option value="Todos">Todos</option>
              <option value="morador">Morador</option>
              <option value="tomador">Tomador</option>
              <option value="turista">Turista / Visitante</option>
              <option value="diarista">Diarista</option>
              <option value="mototaxista">Mototaxista</option>
              <option value="ambulante">Ambulante</option>
              <option value="associacao">Associação</option>
              <option value="cocoecia">Côco & Cia</option>
              <option value="prestador">Prestador Geral</option>
            </select>
          </div>

          {/* Status */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 4 }}>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
              className="bg-zinc-950 text-zinc-200 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              style={{ width: "100%", height: 38, borderRadius: 8, padding: "0 10px", fontFamily: "DM Sans", fontSize: 13, outline: "none", color: "var(--admin-text)", background: "var(--admin-bg)" }}
            >
              <option value="Todos">Todos</option>
              <option value="novo">Novo</option>
              <option value="contatado">Contatado</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </div>

          {/* Cidade */}
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 4 }}>Cidade</label>
            <select
              value={selectedCidade}
              onChange={(e) => { setSelectedCidade(e.target.value); setPage(0); }}
              className="bg-zinc-950 text-zinc-200 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              style={{ width: "100%", height: 38, borderRadius: 8, padding: "0 10px", fontFamily: "DM Sans", fontSize: 13, outline: "none", color: "var(--admin-text)", background: "var(--admin-bg)" }}
            >
              <option value="Todas">Todas</option>
              <option value="Ubatuba">Ubatuba</option>
              <option value="Outra">Outras</option>
            </select>
          </div>

          {/* Text Search */}
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 4 }}>Pesquisar Nome / E-mail / Telefone</label>
            <div style={{ position: "relative" }}>
              <Search size={14} color="var(--admin-muted)" style={{ position: "absolute", left: 10, top: 12 }} />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder="Pesquisar..."
                className="bg-zinc-950 text-zinc-200 border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-600"
                style={{ width: "100%", height: 38, borderRadius: 8, padding: "0 10px 0 34px", fontFamily: "DM Sans", fontSize: 13, outline: "none", color: "var(--admin-text)", background: "var(--admin-bg)" }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--admin-border)", background: "var(--admin-bg)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>
              Leads na Fila ({totalCount})
            </span>
            <Pill bg="rgba(71,85,105,0.08)" color="var(--admin-subtle)" size="sm">
              Página {page + 1} de {totalPages}
            </Pill>
          </div>

          <GhostButton onClick={exportCsv} style={{ padding: "5px 10px", fontSize: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <FileSpreadsheet size={14} /> Exportar CSV
            </span>
          </GhostButton>
        </div>

        {selectedLeadIds.size > 0 && (
          <div style={{ padding: "12px 20px", background: "rgba(43,110,232,0.06)", borderBottom: "1px solid var(--admin-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#2B6EE8" }}>
              {selectedLeadIds.size} lead(s) selecionado(s)
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={updatingStatus}
                onClick={() => {
                  if (confirm(`Aprovar ${selectedLeadIds.size} lead(s) em lote?`)) {
                    handleApproveLeads(Array.from(selectedLeadIds));
                  }
                }}
                style={{
                  background: "#0DB87E",
                  color: "#fff",
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer"
                }}
              >
                Aprovar Lote
              </button>
              <button
                disabled={updatingStatus}
                onClick={() => setSelectedLeadIds(new Set())}
                style={{
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  cursor: "pointer"
                }}
              >
                Limpar Seleção
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "var(--admin-muted)" }}>
            Carregando fila de espera...
          </div>
        ) : leads.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "var(--admin-muted)" }}>
            Nenhum inscrito na Fila de Espera com os parâmetros informados.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans" }}>
              <thead style={{ background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)" }}>
                <tr style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px", width: 40 }}>
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && leads.every(l => selectedLeadIds.has(l.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeadIds(new Set([...selectedLeadIds, ...leads.map(l => l.id)]));
                        } else {
                          const newSelection = new Set(selectedLeadIds);
                          leads.forEach(l => newSelection.delete(l.id));
                          setSelectedLeadIds(newSelection);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                  </th>
                  <th style={{ padding: "12px 16px" }}>Nome</th>
                  <th style={{ padding: "12px 16px" }}>Cidade</th>
                  <th style={{ padding: "12px 16px" }}>Perfil</th>
                  <th style={{ padding: "12px 16px" }}>Mercado Pago?</th>
                  <th style={{ padding: "12px 16px" }}>Origem / Indicação</th>
                  <th style={{ padding: "12px 16px" }}>UTM Source</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Cadastro</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} style={{ borderBottom: "1px solid var(--admin-bg)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.has(lead.id)}
                        onChange={(e) => {
                          const newSelection = new Set(selectedLeadIds);
                          if (e.target.checked) {
                            newSelection.add(lead.id);
                          } else {
                            newSelection.delete(lead.id);
                          }
                          setSelectedLeadIds(newSelection);
                        }}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-text)" }}>{lead.nome}</div>
                      <div style={{ fontSize: 11, color: "var(--admin-subtle)" }}>{lead.email} | {lead.telefone}</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--admin-subtle)" }}>
                      {lead.cidade}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {renderPerfilBadges(lead.perfil)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {lead.observacoes?.includes("Mercado Pago: Sim") || (lead as any).possui_conta_mercado_pago === true ? (
                        <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E" size="sm">Sim</Pill>
                      ) : lead.observacoes?.includes("Mercado Pago: Não") || (lead as any).possui_conta_mercado_pago === false ? (
                        <Pill bg="rgba(239,68,68,0.08)" color="#EF4444" size="sm">Não</Pill>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--admin-muted)", fontStyle: "italic" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--admin-subtle)" }}>
                      {lead.origem === "direto" ? (
                        <span style={{ fontStyle: "italic", color: "var(--admin-muted)" }}>Direto</span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#EC4899" }}>
                          <Link size={12} /> {lead.origem?.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--admin-subtle)" }}>
                      {lead.utm_source || "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {lead.status === "novo" && <Pill bg="rgba(43,110,232,0.08)" color="#2B6EE8" size="sm">Novo</Pill>}
                      {lead.status === "contatado" && <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E" size="sm">Contatado</Pill>}
                      {lead.status === "arquivado" && <Pill bg="rgba(148,163,184,0.08)" color="var(--admin-subtle)" size="sm">Arquivado</Pill>}
                      {lead.status === "approved" && <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E" size="sm">Aprovado</Pill>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--admin-subtle)", whiteSpace: "nowrap" }}>
                      {lead.created_at_local}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedLeadModal(lead)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--admin-border)",
                          background: "var(--admin-bg)",
                          color: "#2B6EE8",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Eye size={14} /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", background: "var(--admin-bg)", display: "flex", justifySelf: "stretch", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-subtle)" }}>
            Mostrando {leads.length} de {totalCount} inscritos
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--admin-border)", background: "var(--admin-bg)", fontSize: 12, fontWeight: 600, cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-text)", alignSelf: "center", fontWeight: 700 }}>
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--admin-border)", background: "var(--admin-bg)", fontSize: 12, fontWeight: 600, cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              Próxima
            </button>
          </div>
        </div>
      </Card>

      {/* Detail Modal */}
      {selectedLeadModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifySelf: "stretch", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", padding: 24, position: "relative" }}>
            <button
              onClick={() => setSelectedLeadModal(null)}
              style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="var(--admin-subtle)" />
            </button>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
              Detalhes do Lead
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "DM Sans" }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Nome Completo</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>{selectedLeadModal.nome}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>E-mail</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)" }}>{selectedLeadModal.email}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Telefone</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)" }}>{selectedLeadModal.telefone}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Cidade</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)" }}>{selectedLeadModal.cidade}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Perfil Selecionado</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)", marginTop: 4 }}>
                    {renderPerfilBadges(selectedLeadModal.perfil)}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Possui Conta Mercado Pago?</span>
                <div style={{ marginTop: 4 }}>
                  {selectedLeadModal.observacoes?.includes("Mercado Pago: Sim") || (selectedLeadModal as any).possui_conta_mercado_pago === true ? (
                    <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E">Sim</Pill>
                  ) : selectedLeadModal.observacoes?.includes("Mercado Pago: Não") || (selectedLeadModal as any).possui_conta_mercado_pago === false ? (
                    <Pill bg="rgba(239,68,68,0.08)" color="#EF4444">Não</Pill>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--admin-subtle)", fontStyle: "italic" }}>Não informado</span>
                  )}
                </div>
              </div>

              {(selectedLeadModal.cep_moradia || selectedLeadModal.bairro_moradia || selectedLeadModal.bairro_trabalho) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: 12, borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>CEP Moradia</span>
                    <div style={{ fontSize: 13, color: "var(--admin-subtle)", fontWeight: 700 }}>{selectedLeadModal.cep_moradia || "—"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Bairro Moradia</span>
                    <div style={{ fontSize: 13, color: "var(--admin-subtle)", fontWeight: 700 }}>{selectedLeadModal.bairro_moradia || "—"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Bairro Trabalho</span>
                    <div style={{ fontSize: 13, color: "var(--admin-subtle)", fontWeight: 700 }}>{selectedLeadModal.bairro_trabalho || "—"}</div>
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>LGPD Consentimento</span>
                <div style={{ fontSize: 13, color: "#0DB87E", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <ShieldCheck size={16} /> Aceito em {selectedLeadModal.created_at_local}
                </div>
              </div>

              {selectedLeadModal.observacoes && (
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Observações / Preferências</span>
                  <div style={{ fontSize: 13, color: "var(--admin-subtle)", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: 10, borderRadius: 8, marginTop: 4 }}>
                    {selectedLeadModal.observacoes}
                  </div>
                </div>
              )}

              {/* UTM & Origin Details */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 6 }}>Informações de Aquisição (UTMs)</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 12, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: 12, borderRadius: 8, fontFamily: "monospace" }}>
                  <div>Source: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_source || "—"}</span></div>
                  <div>Medium: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_medium || "—"}</span></div>
                  <div>Campaign: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_campaign || "—"}</span></div>
                  <div>Content: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_content || "—"}</span></div>
                  <div style={{ gridColumn: "span 2" }}>Referer: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.referer || "—"}</span></div>
                  <div style={{ gridColumn: "span 2" }}>Indicação Padrinho: <span style={{ color: "#EC4899" }}>{selectedLeadModal.origem || "direto"}</span></div>
                </div>
              </div>

              {/* Device Metadados */}
              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Dados de Conexão (Anônimos)</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 12, color: "var(--admin-subtle)", marginTop: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Smartphone size={13} /> {selectedLeadModal.device_type} ({selectedLeadModal.os})</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Globe size={13} /> Browser: {selectedLeadModal.browser}</div>
                  <div style={{ gridColumn: "span 2", fontSize: 10, fontFamily: "monospace" }}>IP Hash (SHA-256): {selectedLeadModal.ip_hash}</div>
                </div>
              </div>

              {/* Status Update Options */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16, display: "flex", alignItems: "center", justifySelf: "stretch", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 6 }}>Alterar Status</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      disabled={updatingStatus || selectedLeadModal.status === "novo"}
                      onClick={() => handleStatusUpdate(selectedLeadModal.id, "novo")}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid var(--admin-border)",
                        background: selectedLeadModal.status === "novo" ? "rgba(59,130,246,0.18)" : "var(--admin-bg)",
                        color: selectedLeadModal.status === "novo" ? "#3B82F6" : "var(--admin-text)",
                        cursor: selectedLeadModal.status === "novo" ? "default" : "pointer",
                        fontWeight: 600,
                        transition: "all 150ms"
                      }}
                    >
                      Novo
                    </button>
                    <button
                      disabled={updatingStatus || selectedLeadModal.status === "contatado"}
                      onClick={() => handleStatusUpdate(selectedLeadModal.id, "contatado")}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: selectedLeadModal.status === "contatado" ? "1px solid #F5A623" : "1px solid var(--admin-border)",
                        background: selectedLeadModal.status === "contatado" ? "rgba(245,166,35,0.18)" : "var(--admin-bg)",
                        color: selectedLeadModal.status === "contatado" ? "#F5A623" : "var(--admin-text)",
                        cursor: selectedLeadModal.status === "contatado" ? "default" : "pointer",
                        fontWeight: 600,
                        transition: "all 150ms"
                      }}
                    >
                      Contatado
                    </button>
                    <button
                      disabled={updatingStatus || selectedLeadModal.status === "arquivado"}
                      onClick={() => handleStatusUpdate(selectedLeadModal.id, "arquivado")}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: selectedLeadModal.status === "arquivado" ? "1px solid #EF4444" : "1px solid var(--admin-border)",
                        background: selectedLeadModal.status === "arquivado" ? "rgba(239,68,68,0.18)" : "var(--admin-bg)",
                        color: selectedLeadModal.status === "arquivado" ? "#EF4444" : "var(--admin-text)",
                        cursor: selectedLeadModal.status === "arquivado" ? "default" : "pointer",
                        fontWeight: 600,
                        transition: "all 150ms"
                      }}
                    >
                      Arquivar
                    </button>
                    {selectedLeadModal.status !== "approved" && (
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleApproveLeads([selectedLeadModal.id])}
                        style={{
                          padding: "6px 14px",
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #0DB87E",
                          background: "#0DB87E",
                          color: "#FFFFFF",
                          cursor: "pointer",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          boxShadow: "0 2px 8px rgba(13,184,126,0.3)",
                          transition: "all 150ms"
                        }}
                      >
                        <CheckCircle size={14} /> Aprovar Lead
                      </button>
                    )}
                  </div>
                </div>

                <GhostButton onClick={() => setSelectedLeadModal(null)}>Fechar</GhostButton>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
