import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bike,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Gift,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, Pill, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

const formatBR = (n: number) =>
  "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ExecutiveDashboardData {
  saude: {
    sistema_online: boolean;
    edge_functions: boolean;
    realtime: boolean;
    banco_acessivel: boolean;
    fila_notificacoes: number;
    fila_pagamentos: number;
    ultima_sincronizacao: string;
    tempo_medio_resposta_ms: number;
  };
  kpis_dia: {
    gmv: number;
    receita_ubt: number;
    pedidos: number;
    pagamentos_aprovados: number;
    pagamentos_recusados: number;
    payouts_realizados: number;
    reembolsos: number;
    cancelamentos: number;
  };
  operacao: {
    mototaxi: { requested: number; completed: number; avg_duration_min: number; cancelled: number };
    diaristas: { agendamentos: number; concluidos: number; pendentes: number };
    ambulantes: { pedidos: number; entregues: number; pendentes: number };
    coco: { solicitacoes: number; coletas_concluidas: number; veiculos_ativos: number };
  };
  usuarios: {
    novos_usuarios: number;
    prestadores: number;
    tomadores: number;
    kyc_pendentes: number;
    kyc_aprovados_hoje: number;
    usuarios_bloqueados: number;
  };
  financeiro: {
    gmv_total: number;
    ticket_medio: number;
    split_total: number;
    saldo_aguardando_payout: number;
    chargebacks: number;
    disputas: number;
  };
  alertas: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    count: number;
  }>;
  tendencias: Array<{
    day: string;
    gmv: number;
    cadastros: number;
    pedidos: number;
    pwa_installs: number;
    conversao: number;
  }>;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [adminRole, setAdminRole] = useState<string>("admin");

  const setKyc = async (id: string, status: "approved" | "rejected") => {
    try {
      const newRole = status === "approved" ? "prestador" : "tomador";
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", id);

      if (error) throw error;

      logAdminAction({
        acao: status === "approved" ? "kyc_approved" : "kyc_rejected",
        categoria: "KYC",
        modulo: "BackOffice Dashboard",
        entidade: "usuarios",
        registroId: id,
        valorAnterior: { role: "tomador" },
        valorNovo: { role: newRole },
        resultado: "sucesso",
        criticidade: status === "approved" ? "INFO" : "MEDIA",
        metadata: { status }
      });

      // Assuming state management logic exists for users
      toast.show(status === "approved" ? "KYC aprovado! Papel atualizado para Prestador." : "KYC reprovado.");
    } catch (e) {
      console.error("Erro ao atualizar KYC no dashboard:", e);
      toast.show("Erro ao atualizar status do KYC.");
    }
  };

  const loadDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const { data: rpcData, error } = await supabase.rpc("get_executive_dashboard_kpis");
      if (error) throw error;
      if (rpcData) {
        setData(rpcData as ExecutiveDashboardData);
        setLastRefreshedAt(new Date());
      }
    } catch (err: any) {
      console.error("Erro ao carregar Dashboard Executivo:", err);
      toast.show("Erro ao sincronizar Centro de Controle.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboardData();

    // Verification of active admin role
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.role) {
        setAdminRole(user.user_metadata.role);
      }
    });

    // Auto-refresh interval (30 seconds)
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    // Realtime channel listener for live operational tables
    const channel = supabase
      .channel("executive_dashboard_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "mototaxi_corridas" }, () => loadDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => loadDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "diarista_agendamentos" }, () => loadDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => loadDashboardData())
      .on("postgres_changes", { event: "*", schema: "public", table: "usuarios" }, () => loadDashboardData())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  if (loading || !data) {
    return (
      <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <RefreshCw size={32} className="animate-spin text-emerald-500 mb-4" />
        <p style={{ fontFamily: "DM Sans", color: "#64748B", fontSize: 14 }}>
          Carregando Centro de Controle Operacional UBT...
        </p>
      </div>
    );
  }

  const { saude, kpis_dia, operacao, usuarios, financeiro, alertas, tendencias } = data;

  return (
    <div style={{ padding: 32 }}>
      {/* Header & Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Centro de Controle Operacional
            </h1>
            <Pill bg="rgba(13,184,126,0.12)" color="#0DB87E" size="sm">
              Live Realtime
            </Pill>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", marginTop: 4 }}>
            Dashboard Executivo principal do BackOffice · UBT SuperApp v1.0
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8" }}>
            Atualizado: {lastRefreshedAt.toLocaleTimeString("pt-BR")}
          </span>
          <GhostButton onClick={() => loadDashboardData(true)} disabled={refreshing}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Atualizando..." : "Atualizar (30s)"}
            </span>
          </GhostButton>
        </div>
      </div>

      {/* BLOCO 6: ALERTAS CRÍTICOS (Se existirem) */}
      {alertas && alertas.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#E84040", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldAlert size={16} /> Alertas Críticos Operacionais
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertas.map((alert) => (
              <div
                key={alert.id}
                style={{
                  background: alert.severity === "critical" ? "rgba(232,64,64,0.08)" : "rgba(245,166,35,0.08)",
                  border: `1px solid ${alert.severity === "critical" ? "rgba(232,64,64,0.25)" : "rgba(245,166,35,0.25)"}`,
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertTriangle size={18} color={alert.severity === "critical" ? "#E84040" : "#F5A623"} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: alert.severity === "critical" ? "#E84040" : "#D97706" }}>
                    {alert.message}
                  </span>
                </div>
                <Pill bg={alert.severity === "critical" ? "rgba(232,64,64,0.15)" : "rgba(245,166,35,0.15)"} color={alert.severity === "critical" ? "#E84040" : "#D97706"} size="sm">
                  {alert.count} ocorrências
                </Pill>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLOCO 1: SAÚDE DA PLATAFORMA */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          Bloco 1 — Saúde da Plataforma
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
          {[
            { label: "Sistema Online", ok: saude.sistema_online, sub: "Operação normal" },
            { label: "Edge Functions", ok: saude.edge_functions, sub: "Serverless ativas" },
            { label: "Realtime Conectado", ok: saude.realtime, sub: "WebSockets online" },
            { label: "Banco Acessível", ok: saude.banco_acessivel, sub: "PostgreSQL Supabase" },
          ].map((item) => (
            <Card key={item.label} style={{ padding: 16, border: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#334155" }}>{item.label}</span>
                {item.ok ? <CheckCircle2 size={18} color="#0DB87E" /> : <XCircle size={18} color="#E84040" />}
              </div>
              <p style={{ fontFamily: "DM Sans", fontSize: 11, color: item.ok ? "#0DB87E" : "#E84040", marginTop: 4, margin: 0 }}>
                {item.sub}
              </p>
            </Card>
          ))}

          <Card style={{ padding: 16, border: "1px solid #E2E8F0" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Fila Notificações</span>
            <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{saude.fila_notificacoes} pendentes</div>
          </Card>

          <Card style={{ padding: 16, border: "1px solid #E2E8F0" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Fila Pagamentos</span>
            <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{saude.fila_pagamentos} pendentes</div>
          </Card>

          <Card style={{ padding: 16, border: "1px solid #E2E8F0" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>Tempo Resposta Média</span>
            <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#0DB87E", marginTop: 2 }}>{saude.tempo_medio_resposta_ms} ms</div>
          </Card>
        </div>
      </div>

      {/* BLOCO 2: KPIS DO DIA */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          Bloco 2 — KPIs do Dia
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {[
            { label: "GMV do Dia", val: formatBR(kpis_dia.gmv), color: "#2B6EE8" },
            { label: "Receita UBT (4%)", val: formatBR(kpis_dia.receita_ubt), color: "#0DB87E" },
            { label: "Pedidos do Dia", val: kpis_dia.pedidos, color: "#0F172A" },
            { label: "Aprovados", val: kpis_dia.pagamentos_aprovados, color: "#0DB87E" },
            { label: "Recusados", val: kpis_dia.pagamentos_recusados, color: "#E84040" },
            { label: "Payouts Realizados", val: kpis_dia.payouts_realizados, color: "#9B59B6" },
            { label: "Reembolsos", val: kpis_dia.reembolsos, color: "#F5A623" },
            { label: "Cancelamentos", val: kpis_dia.cancelamentos, color: "#64748B" },
          ].map((k) => (
            <Card key={k.label} style={{ padding: 16, border: "1px solid #E2E8F0" }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" }}>{k.label}</div>
              <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.val}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* BLOCO 3: OPERAÇÃO POR VERTICAL */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          Bloco 3 — Operação por Vertical
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {/* Mototáxi */}
          <Card onClick={() => navigate("/admin/operacoes")} style={{ padding: 20, border: "1px solid #E2E8F0", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Bike size={18} color="#2B6EE8" />
              <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Mototáxi</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, fontFamily: "DM Sans" }}>
              <div>Solicitadas: <strong>{operacao.mototaxi.requested}</strong></div>
              <div>Concluídas: <strong style={{ color: "#0DB87E" }}>{operacao.mototaxi.completed}</strong></div>
              <div>Tempo Médio: <strong>{operacao.mototaxi.avg_duration_min}m</strong></div>
              <div>Canceladas: <strong style={{ color: "#E84040" }}>{operacao.mototaxi.cancelled}</strong></div>
            </div>
          </Card>

          {/* Diaristas */}
          <Card onClick={() => navigate("/admin/diaristas")} style={{ padding: 20, border: "1px solid #E2E8F0", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={18} color="#9B59B6" />
              <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Diaristas</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, fontFamily: "DM Sans" }}>
              <div>Agendamentos: <strong>{operacao.diaristas.agendamentos}</strong></div>
              <div>Concluídos: <strong style={{ color: "#0DB87E" }}>{operacao.diaristas.concluidos}</strong></div>
              <div style={{ gridColumn: "span 2" }}>Pendentes: <strong style={{ color: "#F5A623" }}>{operacao.diaristas.pendentes}</strong></div>
            </div>
          </Card>

          {/* Ambulantes */}
          <Card onClick={() => navigate("/admin/clientes")} style={{ padding: 20, border: "1px solid #E2E8F0", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShoppingBag size={18} color="#F5A623" />
              <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Ambulantes</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, fontFamily: "DM Sans" }}>
              <div>Pedidos: <strong>{operacao.ambulantes.pedidos}</strong></div>
              <div>Entregues: <strong style={{ color: "#0DB87E" }}>{operacao.ambulantes.entregues}</strong></div>
              <div style={{ gridColumn: "span 2" }}>Pendentes: <strong style={{ color: "#F5A623" }}>{operacao.ambulantes.pendentes}</strong></div>
            </div>
          </Card>

          {/* Côco & Cia */}
          <Card onClick={() => navigate("/admin/coco")} style={{ padding: 20, border: "1px solid #E2E8F0", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Building2 size={18} color="#0DB87E" />
              <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Côco & Cia</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, fontFamily: "DM Sans" }}>
              <div>Solicitações: <strong>{operacao.coco.solicitacoes}</strong></div>
              <div>Coletas: <strong style={{ color: "#0DB87E" }}>{operacao.coco.coletas_concluidas}</strong></div>
              <div style={{ gridColumn: "span 2" }}>Veículos Ativos: <strong>{operacao.coco.veiculos_ativos}</strong></div>
            </div>
          </Card>
        </div>
      </div>

      {/* BLOCO 4 & 5: USUÁRIOS E FINANCEIRO */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 28 }}>
        {/* BLOCO 4: USUÁRIOS */}
        <Card style={{ padding: 24, border: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>
              Bloco 4 — Usuários
            </h2>
            <GhostButton onClick={() => navigate("/admin/clientes")} style={{ padding: "4px 8px", fontSize: 12 }}>
              Gerenciar →
            </GhostButton>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontFamily: "DM Sans" }}>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Novos (7d)</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{usuarios.novos_usuarios}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Prestadores</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0DB87E" }}>{usuarios.prestadores}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Tomadores</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#2B6EE8" }}>{usuarios.tomadores}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>KYC Pendentes</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#F5A623" }}>{usuarios.kyc_pendentes}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>KYC Aprovados Hoje</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0DB87E" }}>{usuarios.kyc_aprovados_hoje}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Bloqueados</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#E84040" }}>{usuarios.usuarios_bloqueados}</div>
            </div>
          </div>
        </Card>

        {/* BLOCO 5: FINANCEIRO */}
        <Card style={{ padding: 24, border: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>
              Bloco 5 — Financeiro
            </h2>
            <GhostButton onClick={() => navigate("/admin/financeiro")} style={{ padding: "4px 8px", fontSize: 12 }}>
              Demonstrativo →
            </GhostButton>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontFamily: "DM Sans" }}>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>GMV Total</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#2B6EE8" }}>{formatBR(financeiro.gmv_total)}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Ticket Médio</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0DB87E" }}>{formatBR(financeiro.ticket_medio)}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Split Retido (4%)</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F5A623" }}>{formatBR(financeiro.split_total)}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Saldo Aguardando Payout</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#9B59B6" }}>{formatBR(financeiro.saldo_aguardando_payout)}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Chargebacks</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E84040" }}>{financeiro.chargebacks}</div>
            </div>
            <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Disputas Abertas</span>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E84040" }}>{financeiro.disputas}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* BLOCO 7: TENDÊNCIAS (ÚLTIMOS 7 DIAS) */}
      <div>
        <h2 style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
          Bloco 7 — Tendências dos Últimos 7 Dias
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          {tendencias.map((t, idx) => (
            <Card key={idx} style={{ padding: 14, border: "1px solid #E2E8F0", textAlign: "center" }}>
              <span style={{ fontFamily: "Syne", fontSize: 13, fontWeight: 700, color: "#0DB87E", display: "block", marginBottom: 6 }}>
                {t.day}
              </span>
              <div style={{ fontFamily: "DM Sans", fontSize: 11, color: "#64748B", display: "flex", flexDirection: "column", gap: 4 }}>
                <div>GMV: <strong style={{ color: "#0F172A" }}>{formatBR(t.gmv).split(",")[0]}</strong></div>
                <div>Novos: <strong>{t.cadastros}</strong></div>
                <div>Pedidos: <strong>{t.pedidos}</strong></div>
                <div>Installs: <strong>{t.pwa_installs}</strong></div>
                <div>Conv: <strong style={{ color: "#0DB87E" }}>{t.conversao}%</strong></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
