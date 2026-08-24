import React, { useState, useEffect } from "react";
import { AssociacaoLayout } from "../../layouts/AssociacaoLayout";
import { Users, DollarSign, Award, ArrowUpRight, Calendar, BarChart2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatBRL } from "../../utils/ride";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

type TimeFilter = "hoje" | "semana" | "mes" | "personalizado";

export default function AssociacaoDashboard() {
  const [stats, setStats] = useState({
    activeMembersCount: 0,
    totalRepasseAmount: 0.0,
    pendingMembersCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("mes");

  // Load from database with mock fallback
  useEffect(() => {
    async function loadStats() {
      try {
        const { data: members, error: mError } = await supabase
          .from("associacao_membros")
          .select("status");

        if (mError) throw mError;

        const active = members?.filter((m) => m.status === "active").length || 0;
        const pending = members?.filter((m) => m.status === "pending").length || 0;

        const activeCount = active;
        const pendingCount = pending;
        const { data: receitas } = await supabase.from("pagamentos_split").select("entity_amount").eq("status", "approved");
        const revenue = receitas?.reduce((acc, curr) => acc + Number(curr.entity_amount), 0) || 0;

        setStats({
          activeMembersCount: activeCount,
          totalRepasseAmount: revenue,
          pendingMembersCount: pendingCount,
        });
      } catch (e) {
        console.error(e);
        setStats({
          activeMembersCount: 0,
          totalRepasseAmount: 0,
          pendingMembersCount: 0,
        });
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  // Chart data — returns empty until real data pipeline is connected
  const getChartData = () => {
    // TODO: Query pagamentos_split grouped by date range for real chart data
    return [] as { name: string; repasses: number; valor: number }[];
  };

  const cardData = [
    {
      title: "Filiados Ativos",
      value: stats.activeMembersCount,
      change: "+12% este mês",
      icon: Users,
      iconColor: "text-[#00FF66]",
      bg: "bg-[#18181B]",
    },
    {
      title: "Repasses Recebidos",
      value: formatBRL(stats.totalRepasseAmount),
      change: "+8.4% vs anterior",
      icon: DollarSign,
      iconColor: "text-[#00FF66]",
      bg: "bg-[#18181B]",
    },
    {
      title: "Solicitações Pendentes",
      value: stats.pendingMembersCount,
      change: "Análise na central",
      icon: Award,
      iconColor: stats.pendingMembersCount > 0 ? "text-yellow-400" : "text-white/40",
      bg: "bg-[#18181B]",
    },
  ];

  return (
    <AssociacaoLayout>
      <div className="flex flex-col gap-6">
        {/* Intro Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800 }} className="margin-0">
              Visão Geral
            </h1>
            <p className="text-white/60 text-sm margin-0 mt-1">
              Painel institucional de monitoria e transparência de repasses.
            </p>
          </div>

          {/* Time Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-[#18181B] border border-[#27272A] p-1 rounded-xl">
            {([
              { key: "hoje", label: "Hoje" },
              { key: "semana", label: "Semana" },
              { key: "mes", label: "Mês" },
              { key: "personalizado", label: "Histórico" }
            ] as const).map(({ key, label }) => {
              const active = timeFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setTimeFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? "bg-[#00FF66] text-[#09090B]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cardData.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={i}
                className={`${card.bg} border border-[#27272A] rounded-2xl p-6 flex flex-col justify-between transition-all hover:border-[#00FF66]/30 group`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                      {card.title}
                    </span>
                    <h3 className="text-3xl font-bold mt-2 font-display text-white">
                      {card.value}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-xl bg-[#09090B] border border-[#27272A] ${card.iconColor}`}>
                    <Icon size={20} />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white/60">{card.change}</span>
                  <ArrowUpRight size={14} className="text-white/30 group-hover:text-[#00FF66] transition-colors" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recharts Chart Container */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 size={18} className="text-[#00FF66]" />
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="margin-0 text-white">
              Crescimento de Repasses (B2B Split)
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  stroke="rgba(255, 255, 255, 0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255, 255, 255, 0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R$${val}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#18181B",
                    borderColor: "#27272A",
                    borderRadius: "12px",
                    color: "#fff",
                    fontFamily: "DM Sans",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "rgba(255, 255, 255, 0.03)" }}
                  formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, "Valor Recebido"]}
                />
                <Bar dataKey="valor" fill="#00FF66" radius={[6, 6, 0, 0]} barSize={timeFilter === "hoje" ? 40 : 30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Middle container: History & Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Repasses */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="margin-0 mb-4 text-white">
              Histórico de Payouts (Últimas Transações)
            </h3>
            <div className="flex flex-col gap-4">
              {[
                { date: "Hoje", desc: "Repasse de Corridas (Mototáxi)", value: "R$ 48,20" },
                { date: "Ontem", desc: "Repasse de Corridas (Mototáxi)", value: "R$ 112,50" },
                { date: "11 Ago", desc: "Repasse de Serviços (Diaristas)", value: "R$ 180,00" },
                { date: "10 Ago", desc: "Repasse de Vendas (Ambulantes)", value: "R$ 94,10" },
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-[#09090B]/60 border border-[#27272A]/50">
                  <div>
                    <p className="text-xs text-white/40 font-medium margin-0">{item.date}</p>
                    <p className="text-sm font-semibold text-white/80 margin-0 mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-sm font-bold text-[#00FF66]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Institutional Showcase */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="margin-0 mb-2 text-white">
                Como Funciona o Split?
              </h3>
              <p className="text-sm text-white/60 leading-relaxed margin-0">
                A plataforma UBT repassa automaticamente uma parcela de cada transação realizada pelos filiados da sua entidade diretamente para a carteira da associação. 
                Isso garante receita recorrente e transparência sem a necessidade de cobrança de mensalidades manuais.
              </p>
            </div>
            <div className="p-4 bg-[#09090B] border border-[#27272A] rounded-xl mt-4 flex items-center gap-3">
              <span className="text-xs text-white/40 font-medium block">
                Fórmula de Repasse: 1% do valor das transações operacionais de prestadores vinculados.
              </span>
            </div>
          </div>
        </div>
      </div>
    </AssociacaoLayout>
  );
}

