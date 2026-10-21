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
  ShieldCheck,
  XCircle,
  Copy,
  Check,
  Loader2
} from "lucide-react";
import { Card, PageTitle, Pill, GhostButton } from "@/components/admin/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { getAppOrigin } from "@/lib/appUrl";
import { maskCPF } from "@/utils/masks";

export interface WaitlistItem {
  id: string;
  created_at_utc: string;
  created_at_local: string;
  nome: string;
  cpf?: string | null;
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
  referral_code?: string | null;
  user_id?: string | null;
}

interface WaitlistStats {
  total: number;
  moradores: number;
  prestadores: number;
  visitantes: number;
  com_referral: number;
}

const PAGE_SIZE = 15;

const extractPraiasFromObservacoes = (obs: string | null): string | null => {
  if (!obs) return null;
  const praiasMatch = obs.match(/Praias:\s*([^|]+)/i);
  if (praiasMatch && praiasMatch[1]?.trim()) {
    return praiasMatch[1].trim();
  }
  const partsWithoutBairros = obs
    .split("|")
    .map((p) => p.trim())
    .filter((p) => !p.toLowerCase().startsWith("bairro:") && !p.toLowerCase().startsWith("bairros:"))
    .join(" | ")
    .trim();
  return partsWithoutBairros.length > 0 ? partsWithoutBairros : null;
};

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
  const [selectedStatus, setSelectedStatus] = useState("pendentes");
  const [selectedCidade, setSelectedCidade] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadModal, setSelectedLeadModal] = useState<WaitlistItem | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Estados para edição do código de indicação (Vanity Slug) no modal de detalhes
  const [customSlug, setCustomSlug] = useState("");
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "saved">("idle");
  const [slugError, setSlugError] = useState("");

  useEffect(() => {
    if (selectedLeadModal) {
      setCustomSlug(selectedLeadModal.referral_code || "");
      setSlugStatus("idle");
      setSlugError("");
    }
  }, [selectedLeadModal?.id, selectedLeadModal?.referral_code]);

  const handleSaveReferralSlug = async () => {
    if (!selectedLeadModal) return;
    const cleanSlug = customSlug.trim().toLowerCase();

    if (!cleanSlug) {
      setSlugError("Informe o código de indicação desejado.");
      return;
    }

    if (cleanSlug.length < 3 || cleanSlug.length > 30) {
      setSlugError("O código deve ter entre 3 e 30 caracteres.");
      return;
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleanSlug)) {
      setSlugError("Use apenas letras minúsculas, números e hífens.");
      return;
    }

    setIsSavingSlug(true);
    setSlugError("");

    try {
      // 1. Validação de unicidade contra usuarios
      let usersCheck = supabase
        .from("usuarios")
        .select("id, email")
        .ilike("referral_code", cleanSlug);

      if (selectedLeadModal.user_id) {
        usersCheck = usersCheck.neq("id", selectedLeadModal.user_id);
      }

      const { data: existingUser, error: errUserCheck } = await usersCheck.maybeSingle();
      if (errUserCheck && errUserCheck.code !== "PGRST116") throw errUserCheck;

      if (existingUser) {
        const isSameEmail = selectedLeadModal.email && 
          existingUser.email?.toLowerCase() === selectedLeadModal.email.toLowerCase();

        if (!isSameEmail) {
          setSlugError("Este código já está em uso por outro usuário.");
          setIsSavingSlug(false);
          return;
        }
      }

      // 2. Validação de unicidade contra outros registros da waitlist
      const { data: existingWl, error: errWlCheck } = await supabase
        .from("waitlist")
        .select("id")
        .ilike("referral_code", cleanSlug)
        .neq("id", selectedLeadModal.id)
        .maybeSingle();

      if (errWlCheck && errWlCheck.code !== "PGRST116") throw errWlCheck;

      if (existingWl) {
        setSlugError("Este código já está em uso na lista de espera.");
        setIsSavingSlug(false);
        return;
      }

      // 3. Persistência direta em public.waitlist (usando lead.id atual)
      const { error: updWlErr } = await supabase
        .from("waitlist")
        .update({ referral_code: cleanSlug })
        .eq("id", selectedLeadModal.id);

      if (updWlErr) throw updWlErr;

      // 4. Persistência em public.usuarios se o e-mail ou user_id já existir
      if (selectedLeadModal.user_id) {
        await supabase
          .from("usuarios")
          .update({ referral_code: cleanSlug })
          .eq("id", selectedLeadModal.user_id);
      }
      if (selectedLeadModal.email) {
        await supabase
          .from("usuarios")
          .update({ referral_code: cleanSlug })
          .ilike("email", selectedLeadModal.email.trim().toLowerCase());
      }

      // 5. Atualização reativa dos estados locais
      setSelectedLeadModal((prev) => (prev ? { ...prev, referral_code: cleanSlug } : null));
      setLeads((prev) =>
        prev.map((l) => (l.id === selectedLeadModal.id ? { ...l, referral_code: cleanSlug } : l))
      );

      setSlugStatus("saved");
      toast.show("Código de indicação atualizado com sucesso! ✓");
      setTimeout(() => setSlugStatus("idle"), 3000);
    } catch (err: any) {
      console.error("Erro ao salvar código de indicação:", err);
      setSlugError(err.message || "Erro ao salvar código de indicação.");
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleCopyLink = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(type);
      toast.show("Link copiado para a área de transferência! ✓");
      setTimeout(() => setCopiedLink(null), 2500);
    } catch (err) {
      console.error("Erro ao copiar link:", err);
      toast.show("Erro ao copiar link.");
    }
  };

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedLeadModal) {
        setSelectedLeadModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLeadModal]);

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
      
      // Log generated onboarding URLs
      approvedLeads.forEach(lead => {
        console.log(`✅ Link de Onboarding Gerado: ${getAppOrigin()}/onboarding?token=${lead.id}`);
      });
      if (approvedLeads.length === 0 && leadIds.length > 0) {
        leadIds.forEach(id => {
          console.log(`✅ Link de Onboarding Gerado: ${getAppOrigin()}/onboarding?token=${id}`);
        });
      }
      
      let successCount = 0;
      let commSuccessCount = 0;
      let commFailedCount = 0;

      // 3. Process individual approved leads for whatsapp-agent API trigger
      for (const lead of approvedLeads) {
        successCount++;
        try {
          const agentApiUrl = String(import.meta.env.VITE_WHATSAPP_AGENT_URL || "").trim();
          if (!agentApiUrl) {
            throw new Error("VITE_WHATSAPP_AGENT_URL não configurada.");
          }
          
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

          try {
            const publicApiKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
            const res = await fetch(agentApiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(publicApiKey ? { "Authorization": `Bearer ${publicApiKey}` } : {}),
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
            const perfilArr = Array.isArray(item.perfil) ? item.perfil : [item.perfil];
            if (perfilArr.includes("morador")) acc.moradores++;
            if (perfilArr.includes("prestador")) acc.prestadores++;
            if (perfilArr.includes("visitante") || perfilArr.includes("visitantes")) acc.visitantes++;
            
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
        query = query.cs("perfil", [selectedPerfil]);
      }

      if (selectedStatus === "pendentes") {
        query = query.neq("status", "approved").neq("status", "aprovado");
      } else if (selectedStatus === "approved" || selectedStatus === "aprovado") {
        query = query.in("status", ["approved", "aprovado"]);
      } else if (selectedStatus !== "Todos") {
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
              <option value="morador">Morador / Tomador</option>
              <option value="diarista">Diarista</option>
              <option value="mototaxista">Mototaxista</option>
              <option value="ambulante">Ambulante</option>
              <option value="associacao">Associação</option>
              <option value="prestador">Trabalhar (Prestador - Legado)</option>
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
              <option value="pendentes">Pendentes (Não-Aprovados)</option>
              <option value="novo">Novo</option>
              <option value="contatado">Contatado</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="arquivado">Arquivado</option>
              <option value="approved">Aprovados</option>
              <option value="Todos">Todos os Status</option>
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
                      {(() => {
                        const perfilArr = Array.isArray(lead.perfil) ? lead.perfil : [lead.perfil];
                        return (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {perfilArr.includes("morador") && <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E" size="sm">Morador</Pill>}
                            {perfilArr.includes("diarista") && <Pill bg="rgba(147,51,234,0.08)" color="#9333EA" size="sm">Diarista</Pill>}
                            {perfilArr.includes("mototaxista") && <Pill bg="rgba(59,130,246,0.08)" color="#3B82F6" size="sm">Mototaxista</Pill>}
                            {perfilArr.includes("ambulante") && <Pill bg="rgba(236,72,153,0.08)" color="#EC4899" size="sm">Ambulante</Pill>}
                            {perfilArr.includes("associacao") && <Pill bg="rgba(16,185,129,0.08)" color="#10B981" size="sm">Associação</Pill>}
                            {perfilArr.includes("prestador") && <Pill bg="rgba(43,110,232,0.08)" color="#2B6EE8" size="sm">Prestador</Pill>}
                            {perfilArr.includes("visitante") && <Pill bg="rgba(245,166,35,0.08)" color="#F5A623" size="sm">Turista</Pill>}
                            {perfilArr.includes("empresa") && <Pill bg="rgba(236,72,153,0.08)" color="#EC4899" size="sm">Empresa</Pill>}
                          </div>
                        );
                      })()}
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
                      {lead.status === "rejeitado" && <Pill bg="rgba(239,68,68,0.08)" color="#EF4444" size="sm">Rejeitado</Pill>}
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
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedLeadModal(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.70)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", padding: 24, position: "relative" }}
          >
            <button
              onClick={() => setSelectedLeadModal(null)}
              style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="var(--admin-subtle)" />
            </button>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px" }}>
              Detalhes do Fundador
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "DM Sans" }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Nome Completo</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>{selectedLeadModal.nome}</div>
              </div>

              {/* Grid 2 colunas com distribuição exata */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Linha 1: CPF | E-mail */}
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>CPF</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)", fontWeight: 500 }}>
                    {selectedLeadModal.cpf ? maskCPF(selectedLeadModal.cpf) : "—"}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>E-mail</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)" }}>{selectedLeadModal.email}</div>
                </div>

                {/* Linha 2: Telefone | Cidade */}
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Telefone</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)" }}>{selectedLeadModal.telefone}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Cidade</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)" }}>{selectedLeadModal.cidade}</div>
                </div>

                {/* Linha 3: Perfil Selecionado | Possui Conta Mercado Pago? */}
                <div>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Perfil Selecionado</span>
                  <div style={{ fontSize: 14, color: "var(--admin-subtle)", display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    {(() => {
                      const perfilArr = Array.isArray(selectedLeadModal.perfil) ? selectedLeadModal.perfil : [selectedLeadModal.perfil];
                      return (
                        <>
                          {perfilArr.includes("morador") && <Pill bg="rgba(13,184,126,0.08)" color="#0DB87E">Morador</Pill>}
                          {perfilArr.includes("diarista") && <Pill bg="rgba(147,51,234,0.08)" color="#9333EA">Diarista</Pill>}
                          {perfilArr.includes("mototaxista") && <Pill bg="rgba(59,130,246,0.08)" color="#3B82F6">Mototaxista</Pill>}
                          {perfilArr.includes("ambulante") && <Pill bg="rgba(236,72,153,0.08)" color="#EC4899">Ambulante</Pill>}
                          {perfilArr.includes("associacao") && <Pill bg="rgba(16,185,129,0.08)" color="#10B981">Associação</Pill>}
                          {perfilArr.includes("prestador") && <Pill bg="rgba(43,110,232,0.08)" color="#2B6EE8">Prestador</Pill>}
                          {perfilArr.includes("visitante") && <Pill bg="rgba(245,166,35,0.08)" color="#F5A623">Turista</Pill>}
                          {perfilArr.includes("empresa") && <Pill bg="rgba(236,72,153,0.08)" color="#EC4899">Empresa</Pill>}
                        </>
                      );
                    })()}
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

              {/* Observações / Preferências (Parsed para exibir apenas Praias) */}
              {(() => {
                const praias = extractPraiasFromObservacoes(selectedLeadModal.observacoes);
                if (!praias) return null;
                return (
                  <div>
                    <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>Praias que frequenta</span>
                    <div style={{ fontSize: 13, color: "var(--admin-subtle)", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: 10, borderRadius: 8, marginTop: 4 }}>
                      {praias}
                    </div>
                  </div>
                );
              })()}

              {/* Status Update Options - 4 Equal Buttons (25% width each) */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 8 }}>
                  Alterar Status
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, width: "100%" }}>
                  {/* 1. Novo (Neutro) */}
                  <button
                    disabled={updatingStatus || selectedLeadModal.status === "novo"}
                    onClick={() => handleStatusUpdate(selectedLeadModal.id, "novo")}
                    style={{
                      padding: "8px 4px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid var(--admin-border)",
                      background: selectedLeadModal.status === "novo" ? "rgba(148,163,184,0.2)" : "var(--admin-bg)",
                      color: "var(--admin-text)",
                      cursor: selectedLeadModal.status === "novo" ? "default" : "pointer",
                      fontWeight: 600,
                      opacity: selectedLeadModal.status === "novo" ? 0.7 : 1,
                      transition: "all 0.15s ease",
                      width: "100%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    Novo
                  </button>

                  {/* 2. Contatado (Outline / Ghost) */}
                  <button
                    disabled={updatingStatus || selectedLeadModal.status === "contatado"}
                    onClick={() => handleStatusUpdate(selectedLeadModal.id, "contatado")}
                    style={{
                      padding: "8px 4px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #3B82F6",
                      background: selectedLeadModal.status === "contatado" ? "rgba(59,130,246,0.15)" : "transparent",
                      color: "#3B82F6",
                      cursor: selectedLeadModal.status === "contatado" ? "default" : "pointer",
                      fontWeight: 600,
                      opacity: selectedLeadModal.status === "contatado" ? 0.7 : 1,
                      transition: "all 0.15s ease",
                      width: "100%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    Contatado
                  </button>

                  {/* 3. Rejeitar (Destructive / Red) */}
                  <button
                    disabled={updatingStatus || selectedLeadModal.status === "rejeitado" || selectedLeadModal.status === "arquivado"}
                    onClick={() => handleStatusUpdate(selectedLeadModal.id, "rejeitado")}
                    style={{
                      padding: "8px 4px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #EF4444",
                      background: (selectedLeadModal.status === "rejeitado" || selectedLeadModal.status === "arquivado") ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.08)",
                      color: "#EF4444",
                      cursor: (selectedLeadModal.status === "rejeitado" || selectedLeadModal.status === "arquivado") ? "default" : "pointer",
                      fontWeight: 600,
                      opacity: (selectedLeadModal.status === "rejeitado" || selectedLeadModal.status === "arquivado") ? 0.7 : 1,
                      transition: "all 0.15s ease",
                      width: "100%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    Rejeitar
                  </button>

                  {/* 4. Aprovar Lead (Success / Green) */}
                  <button
                    type="button"
                    disabled={updatingStatus || selectedLeadModal.status === "approved"}
                    onClick={() => handleApproveLeads([selectedLeadModal.id])}
                    style={{
                      padding: "8px 4px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid #0DB87E",
                      background: selectedLeadModal.status === "approved" ? "rgba(13,184,126,0.2)" : "#0DB87E",
                      color: selectedLeadModal.status === "approved" ? "#0DB87E" : "#FFFFFF",
                      cursor: selectedLeadModal.status === "approved" ? "default" : "pointer",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      opacity: selectedLeadModal.status === "approved" ? 0.7 : 1,
                      transition: "all 0.15s ease",
                      width: "100%",
                    }}
                  >
                    <CheckCircle size={13} /> {selectedLeadModal.status === "approved" ? "Aprovado" : "Aprovar Lead"}
                  </button>
                </div>
              </div>

              {/* Links de Acesso e Indicação */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
                  Links de Acesso e Indicação
                </div>
                
                {/* Link de Onboarding */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                    Link de Onboarding:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      readOnly
                      type="text"
                      value={`${getAppOrigin()}/onboarding?token=${selectedLeadModal.id}`}
                      style={{
                        flex: 1,
                        background: "var(--admin-bg)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "var(--admin-text)",
                        outline: "none",
                        cursor: "text",
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(`${getAppOrigin()}/onboarding?token=${selectedLeadModal.id}`, "onboarding")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--admin-border)",
                        background: copiedLink === "onboarding" ? "rgba(13,184,126,0.15)" : "var(--admin-surface)",
                        color: copiedLink === "onboarding" ? "#0DB87E" : "var(--admin-text)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {copiedLink === "onboarding" ? (
                        <>
                          <Check size={13} color="#0DB87E" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Código de Indicação Personalizado (Vanity Slug) */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                    Código de Indicação Personalizado (Vanity Slug):
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="text"
                      placeholder="ex: pousada-brisa"
                      value={customSlug}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                        setCustomSlug(val);
                        setSlugStatus("idle");
                        setSlugError("");
                      }}
                      style={{
                        flex: 1,
                        background: "var(--admin-bg)",
                        border: slugError ? "1px solid #E84040" : "1px solid var(--admin-border)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "var(--admin-text)",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      disabled={isSavingSlug || !customSlug.trim()}
                      onClick={handleSaveReferralSlug}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--admin-border)",
                        background: slugStatus === "saved" ? "rgba(13,184,126,0.15)" : "#0DB87E",
                        color: slugStatus === "saved" ? "#0DB87E" : "#0E0F12",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isSavingSlug || !customSlug.trim() ? "not-allowed" : "pointer",
                        opacity: isSavingSlug || !customSlug.trim() ? 0.6 : 1,
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isSavingSlug ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> Salvando...
                        </>
                      ) : slugStatus === "saved" ? (
                        <>
                          <Check size={13} color="#0DB87E" /> Salvo!
                        </>
                      ) : (
                        "Salvar Slug"
                      )}
                    </button>
                  </div>
                  {slugError && (
                    <div style={{ fontSize: 11, color: "#E84040", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>⚠</span> {slugError}
                    </div>
                  )}
                </div>

                {/* Link Padrinho/Madrinha */}
                <div>
                  <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                    Link Padrinho/Madrinha:
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      readOnly
                      type="text"
                      value={`${getAppOrigin()}/cadastro?ref=${selectedLeadModal.referral_code || selectedLeadModal.id}`}
                      style={{
                        flex: 1,
                        background: "var(--admin-bg)",
                        border: "1px solid var(--admin-border)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "monospace",
                        color: "var(--admin-text)",
                        outline: "none",
                        cursor: "text",
                      }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(`${getAppOrigin()}/cadastro?ref=${selectedLeadModal.referral_code || selectedLeadModal.id}`, "padrinho")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--admin-border)",
                        background: copiedLink === "padrinho" ? "rgba(13,184,126,0.15)" : "var(--admin-surface)",
                        color: copiedLink === "padrinho" ? "#0DB87E" : "var(--admin-text)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {copiedLink === "padrinho" ? (
                        <>
                          <Check size={13} color="#0DB87E" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Atualização Cadastral via WhatsApp */}
                {(() => {
                  const telLimpo = (selectedLeadModal.telefone || "").replace(/\D/g, "");
                  const linkAtualizacao = `${getAppOrigin()}/atualizacao-cadastral?tel=${telLimpo}`;
                  const firstName = selectedLeadModal.nome ? selectedLeadModal.nome.trim().split(" ")[0] : "Fundador(a)";
                  const waMsg = `Olá, ${firstName}! Aqui é da equipe UBT Serviços. Estamos nos preparativos finais de aprovação do seu cadastro de Fundador em Ubatuba. Para liberar seu acesso e link de comissões, conclua seus dados pendentes e crie sua senha neste link seguro: ${linkAtualizacao}`;
                  const formattedPhone = telLimpo.length >= 10 && !telLimpo.startsWith("55") ? `55${telLimpo}` : telLimpo;
                  const waLink = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(waMsg)}`;

                  return (
                    <div>
                      <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                        Atualização Cadastral via WhatsApp:
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          readOnly
                          type="text"
                          value={linkAtualizacao}
                          style={{
                            flex: 1,
                            background: "var(--admin-bg)",
                            border: "1px solid var(--admin-border)",
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: "var(--admin-text)",
                            outline: "none",
                            cursor: "text",
                          }}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyLink(linkAtualizacao, "atualizacao")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--admin-border)",
                            background: copiedLink === "atualizacao" ? "rgba(13,184,126,0.15)" : "var(--admin-surface)",
                            color: copiedLink === "atualizacao" ? "#0DB87E" : "var(--admin-text)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {copiedLink === "atualizacao" ? (
                            <>
                              <Check size={13} color="#0DB87E" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy size={13} /> Copiar
                            </>
                          )}
                        </button>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "#25D366",
                            color: "#000000",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          <span>Enviar WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* LGPD Consentimento - Reposicionado no final do card (após os botões de status) */}
              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600 }}>LGPD Consentimento</span>
                <div style={{ fontSize: 12, color: "#0DB87E", display: "flex", alignItems: "center", gap: 4 }}>
                  <ShieldCheck size={14} /> Aceito em {selectedLeadModal.created_at_local}
                </div>
              </div>

              {/* Telemetria & Aquisição Accordion (Abaixo do bloco ALTERAR STATUS e LGPD, fechado por padrão) */}
              <Accordion type="multiple" className="w-full">
                {/* UTM & Origin Details */}
                <AccordionItem value="utms" className="border-t border-zinc-800">
                  <AccordionTrigger className="text-xs uppercase font-bold text-zinc-400 py-3 hover:no-underline hover:text-zinc-200">
                    Informações de Aquisição (UTMs)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 12, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: 12, borderRadius: 8, fontFamily: "monospace" }}>
                      <div>Source: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_source || "—"}</span></div>
                      <div>Medium: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_medium || "—"}</span></div>
                      <div>Campaign: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_campaign || "—"}</span></div>
                      <div>Content: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.utm_content || "—"}</span></div>
                      <div style={{ gridColumn: "span 2" }}>Referer: <span style={{ color: "var(--admin-text)" }}>{selectedLeadModal.referer || "—"}</span></div>
                      <div style={{ gridColumn: "span 2" }}>Indicação Padrinho: <span style={{ color: "#EC4899" }}>{selectedLeadModal.origem || "direto"}</span></div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Device Metadados */}
                <AccordionItem value="telemetry" className="border-t border-zinc-800">
                  <AccordionTrigger className="text-xs uppercase font-bold text-zinc-400 py-3 hover:no-underline hover:text-zinc-200">
                    Dados de Conexão (Anônimos)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 12, color: "var(--admin-subtle)", marginTop: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Smartphone size={13} /> {selectedLeadModal.device_type} ({selectedLeadModal.os})</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Globe size={13} /> Browser: {selectedLeadModal.browser}</div>
                      <div style={{ gridColumn: "span 2", fontSize: 10, fontFamily: "monospace" }}>IP Hash (SHA-256): {selectedLeadModal.ip_hash}</div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Modal Footer (Fechar) */}
              <div style={{ borderTop: "1px solid var(--admin-border)", marginTop: 8, paddingTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <GhostButton onClick={() => setSelectedLeadModal(null)}>Fechar</GhostButton>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
