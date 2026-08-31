import { useState, useEffect } from "react";
import { 
  MapPin, 
  Truck, 
  Layers, 
  RefreshCw, 
  Sparkles,
  Info
} from "lucide-react";
import { Card, Pill } from "@/components/admin/ui";
import { supabase } from "@/lib/supabase";

export default function AdminCocoMapa() {
  const [pontos, setPontos] = useState<any[]>([]);
  const [caminhoes, setCaminhoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDados = async () => {
    setLoading(true);
    try {
      const { data: dataCaminhoes } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (dataCaminhoes) setCaminhoes(dataCaminhoes);

      const { data: dataPontos } = await supabase
        .from("coco_pontos")
        .select("*")
        .in("status", ["aguardando", "confirmado"])
        .order("created_at", { ascending: false });
      if (dataPontos) setPontos(dataPontos);
    } catch (e) {
      console.error("Erro ao carregar dados do mapa operacional:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDados();
  }, []);

  const caminhoesOnline = caminhoes.filter(c => c.is_online);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
              <MapPin size={20} />
            </div>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
              Mapa Operacional & Rotas
            </h1>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
            Visão em tempo real das coletas pendentes e monitoramento da frota de veículos em Ubatuba.
          </p>
        </div>

        <button
          onClick={fetchDados}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--admin-surface)",
            color: "var(--admin-text)",
            border: "1px solid var(--admin-border)",
            borderRadius: 10,
            padding: "10px 16px",
            fontFamily: "DM Sans",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer"
          }}
        >
          <RefreshCw size={15} /> Atualizar Rotas
        </button>
      </div>

      {/* Resumo Rápido */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
              <Truck size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--admin-muted)", fontFamily: "DM Sans" }}>Caminhões Ativos</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-text)", fontFamily: "Syne" }}>
                {caminhoesOnline.length} / {caminhoes.length}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(43,110,232,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2B6EE8" }}>
              <Layers size={20} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--admin-muted)", fontFamily: "DM Sans" }}>Pontos de Descarte</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--admin-text)", fontFamily: "Syne" }}>
                {pontos.length} aguardando
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Placeholder do Mapa (Isolado e Seguro) */}
      <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 450, marginBottom: 24 }}>
        <div className="w-full h-[450px] bg-slate-800 flex flex-col items-center justify-center font-bold text-slate-400 rounded-lg border border-slate-700 p-6 text-center gap-3">
          <MapPin size={36} className="text-slate-500" />
          <span style={{ fontSize: 16, color: "#E2E8F0" }}>Mapa de Operações Temporariamente Desativado (Aguardando Dados)</span>
          <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 400, maxWidth: 460 }}>
            O módulo geográfico está isolado para auditoria operacional. Os caminhões e pontos de coleta continuam operando normalmente via filas de despachos.
          </span>
        </div>
      </Card>

      {/* Lista de Pontos de Coleta Pendentes */}
      <Card style={{ padding: 20 }}>
        <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 16px 0" }}>
          Descartes em Espera por Coleta
        </h3>
        {pontos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Nenhum ponto de descarte pendente no momento.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {pontos.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: "14px",
                  borderRadius: 10,
                  border: "1px solid var(--admin-border)",
                  background: "var(--admin-bg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--admin-text)" }}>{p.address || "Endereço não informado"}</span>
                  <Pill bg="rgba(13,184,126,0.15)" color="#0DB87E" size="sm">
                    {p.material || "Reciclável"}
                  </Pill>
                </div>
                {p.quantidade_estimada && (
                  <div style={{ fontSize: 12, color: "var(--admin-subtle)" }}>
                    📦 Qtd: {p.quantidade_estimada}
                  </div>
                )}
                {p.local_armazenamento && (
                  <div style={{ fontSize: 12, color: "var(--admin-subtle)" }}>
                    📍 Local: {p.local_armazenamento}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
