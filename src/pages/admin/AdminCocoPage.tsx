import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Recycle,
  Scale,
  Users,
  Package,
  HeartHandshake,
  TrendingUp,
  Truck,
  MapPin,
  Calendar,
  BookOpen,
  QrCode,
  Settings,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import { Card, Pill } from "@/components/admin/ui";
import { supabase } from "@/lib/supabase";
import { getMaterial } from "@/mocks/cocoMateriais";

export default function AdminCocoPage() {
  const navigate = useNavigate();

  // Estados de dados operacionais
  const [pontos, setPontos] = useState<any[]>([]);
  const [caminhoes, setCaminhoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // KPIs (Prod Ready - Dados Reais ou Zerados)
  const [kgsPrevistos, setKgsPrevistos] = useState<number>(0);
  const [usuariosAtendidos, setUsuariosAtendidos] = useState<number>(0);
  const [doacoesRecebidas, setDoacoesRecebidas] = useState<number>(0);
  const [apadrinhamentosReais, setApadrinhamentosReais] = useState<number>(0);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Buscar pontos de descarte
        const { data: dataPontos } = await supabase
          .from("coco_pontos")
          .select("*")
          .order("created_at", { ascending: false });

        if (dataPontos && dataPontos.length > 0) {
          setPontos(dataPontos);
          
          // Calcular dados baseados no banco real
          const totalAtendidos = dataPontos.filter(p => p.status === "coletado").length;
          const totalDoacoes = dataPontos.length;
          
          // Estimar Kgs reais com base nos volumes cadastrados
          const somaKgs = dataPontos.reduce((acc, curr) => {
            const num = parseFloat(curr.quantidade_estimada) || 10;
            return acc + num;
          }, 0);

          setKgsPrevistos(Math.round(somaKgs));
          setUsuariosAtendidos(totalAtendidos);
          setDoacoesRecebidas(totalDoacoes);
        } else {
          setPontos([]);
          setKgsPrevistos(0);
          setUsuariosAtendidos(0);
          setDoacoesRecebidas(0);
        }

        // Buscar caminhões
        const { data: dataCaminhoes } = await supabase
          .from("coco_caminhoes")
          .select("*")
          .order("created_at", { ascending: false });

        if (dataCaminhoes && dataCaminhoes.length > 0) {
          setCaminhoes(dataCaminhoes);
        } else {
          setCaminhoes([]);
        }

        // Buscar apadrinhamentos / configurações se existirem
        const { data: dataConfig } = await supabase
          .from("coco_config")
          .select("*")
          .maybeSingle();

        if (dataConfig?.total_doacoes_reais) {
          setApadrinhamentosReais(Number(dataConfig.total_doacoes_reais) || 0);
        }
      } catch (err) {
        console.warn("Erro ao carregar métricas do dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const caminhoesOnline = caminhoes.filter((c) => c.is_online);
  const pontosAguardando = pontos.filter((p) => p.status === "aguardando" || !p.status);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header do Painel */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(13,184,126,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0DB87E"
              }}
            >
              <Recycle size={24} />
            </div>
            <div>
              <h1 style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                Côco & Cia · Dashboard de Indicadores
              </h1>
              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                Gestão e Monitoramento de Resíduos Sólidos e Reciclagem de Ubatuba
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/admin/coco/mapa-operacional")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0DB87E",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 16px",
              fontFamily: "Syne",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(13,184,126,0.25)"
            }}
          >
            <MapPin size={15} /> Ver Mapa Operacional
          </button>
        </div>
      </div>

      {/* Grid de 4 Cards de Métricas Principais (KPIs) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginBottom: 28 }}>
        {/* KPI 1: Kgs Previstos de Coleta */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
              Kgs Previstos de Coleta
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
              <Scale size={18} />
            </div>
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--admin-text)", marginBottom: 4 }}>
            {kgsPrevistos.toLocaleString("pt-BR")} <span style={{ fontSize: 16, fontWeight: 600, color: "var(--admin-subtle)" }}>kg</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
            <TrendingUp size={14} color="#0DB87E" /> Estimativa baseada em coletas cadastradas
          </div>
        </Card>

        {/* KPI 2: Usuários Atendidos */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
              Usuários Atendidos
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(43,110,232,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2B6EE8" }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--admin-text)", marginBottom: 4 }}>
            {usuariosAtendidos.toLocaleString("pt-BR")}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
            <CheckCircle2 size={14} color="#0DB87E" /> Cidadãos com descarte concluído
          </div>
        </Card>

        {/* KPI 3: Doações Recebidas (Volume/Qtd) */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
              Doações Recebidas (Volume)
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F5A623" }}>
              <Package size={18} />
            </div>
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--admin-text)", marginBottom: 4 }}>
            {doacoesRecebidas.toLocaleString("pt-BR")} <span style={{ fontSize: 16, fontWeight: 600, color: "var(--admin-subtle)" }}>volumes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
            <Clock size={14} color="#F5A623" /> {pontosAguardando.length} aguardando coleta
          </div>
        </Card>

        {/* KPI 4: Apadrinhamentos Recebidos (R$) */}
        <Card style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
              Apadrinhamentos Recebidos
            </span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(155,89,182,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9B59B6" }}>
              <HeartHandshake size={18} />
            </div>
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800, color: "var(--admin-text)", marginBottom: 4 }}>
            R$ {apadrinhamentosReais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0DB87E", fontFamily: "DM Sans" }}>
            <Sparkles size={14} /> Arrecadação via PIX Solidário
          </div>
        </Card>
      </div>

      {/* Grid de Seções Operacionais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Status da Frota e Operação Realtime */}
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Status da Frota em Trânsito
            </h3>
            <Pill bg={caminhoesOnline.length > 0 ? "rgba(13,184,126,0.15)" : "var(--admin-border)"} color={caminhoesOnline.length > 0 ? "#0DB87E" : "var(--admin-muted)"} size="sm">
              {caminhoesOnline.length} Online
            </Pill>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {caminhoes.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>
                Nenhum caminhão registrado no sistema.
              </div>
            ) : (
              caminhoes.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Truck size={18} color={c.is_online ? "#0DB87E" : "var(--admin-muted)"} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--admin-text)" }}>{c.apelido || "Caminhão Coletor"}</div>
                      <div style={{ fontSize: 11, color: "var(--admin-subtle)" }}>Placa: {c.plate || "Sem placa"}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.is_online ? "#0DB87E" : "var(--admin-muted)" }}>
                    {c.is_online ? "🟢 Ativo" : "⚪ Offline"}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => navigate("/admin/coco/frota")}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "10px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--admin-border)",
              color: "var(--admin-text)",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            Gerenciar Frota Completa <ArrowRight size={14} />
          </button>
        </Card>

        {/* Próximas Coletas e Pontos de Descarte Recentes */}
        <Card style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Descartes Recentes Notificados
            </h3>
            <Pill bg="rgba(43,110,232,0.15)" color="#2B6EE8" size="sm">
              {pontos.length} Total
            </Pill>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pontos.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans", fontSize: 13 }}>
                Nenhum ponto de descarte registrado no momento.
              </div>
            ) : (
              pontos.slice(0, 4).map((p) => {
                const mat = getMaterial(p.material || "plastico");
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{mat.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--admin-text)" }}>{p.address || "Endereço no mapa"}</div>
                        <div style={{ fontSize: 11, color: "var(--admin-subtle)" }}>Material: {mat.nome}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.status === "coletado" ? "#0DB87E" : "#F5A623" }}>
                      {p.status === "coletado" ? "Coletado" : "Aguardando"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <button
            onClick={() => navigate("/admin/coco/mapa-operacional")}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "10px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--admin-border)",
              color: "var(--admin-text)",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            Ver Fila de Despacho & Mapa <ArrowRight size={14} />
          </button>
        </Card>
      </div>
    </div>
  );
}
