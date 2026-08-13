import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import { MOCK_DIARISTAS } from "@/mocks/diaristasMock";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Switch } from "@/components/ui/switch"; // Assuming a switch component exists or we can just use a custom toggle
import { MATERIAIS_PADRAO } from "@/mocks/diaristasMateriais";
import { haversineKm, formatDist } from "@/utils/geo";

type Filtro = "todas" | "feminino" | "top" | "preco";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todas", label: "Todas" },
    { key: "top", label: "⭐ Mais bem avaliadas" },
  { key: "preco", label: "💰 Menor preço" },
];

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;
const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"];

const DiaristasBuscaPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [diaristas, setDiaristas] = useState<any[]>([]);
  const [soMulheres, setSoMulheres] = useState(false);
  const [mockSexoFeminino, setMockSexoFeminino] = useState(false); // Para testes

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('diarista_perfis').select('*');
      if (data) {
        // Map data to match mock format roughly
        const formatted = data.map(d => ({
          uid: d.user_id,
          nome: d.nome || "Diarista",
          sexo: d.sexo,
          valorPorM2: Number(d.valor_por_m2),
          minimoM2: Number(d.minimo_m2),
          rating: Number(d.rating) || 5,
          totalServicos: Number(d.total_servicos) || 0,
          bairro: d.endereco || "Centro",
          location: { lat: -23.432, lng: -45.083 }, // Mock location for dist
          materiais: d.materiais || [],
          disponibilidade: d.disponibilidade || {},
          horarios: d.horarios_por_dia ? Object.values(d.horarios_por_dia)[0] : []
        }));
        setDiaristas(formatted);
      }
    }
    load();
  }, []);

  const isMulher = user?.sexo === "feminino" || mockSexoFeminino;

  const filtered = useMemo(() => {
    return diaristas.filter((d) => {
      if (soMulheres && d.sexo !== "feminino") return false;
            if (busca) {
        const q = busca.toLowerCase();
        return d.nome.toLowerCase().includes(q) || d.bairro.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => {
      if (filtro === "top") return b.rating - a.rating;
      if (filtro === "preco") return a.valorPorM2 - b.valorPorM2;
      return 0;
    });
  }, [filtro, busca, diaristas, soMulheres]);

  return (
    <div style={{ background: "#09090B", minHeight: "100svh", paddingBottom: 96 }}>
      <header style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/app/home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={22} color="white" />
        </button>
        <h1 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>Diaristas</h1>
      </header>

      <div style={{ padding: "14px 24px 0", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
        {FILTROS.map((f) => {
          const active = filtro === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                background: active ? "#00FF66" : "rgba(255,255,255,0.06)",
                border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
                color: active ? "#09090B" : "rgba(255,255,255,0.55)",
                fontFamily: "DM Sans", fontSize: 13, fontWeight: active ? 600 : 400,
                borderRadius: 999, padding: "7px 16px", flexShrink: 0, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      
      {isMulher && (
        <div style={{ padding: "14px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>👩</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: "white" }}>Mostrar só mulheres</span>
          </div>
          <div 
            onClick={() => setSoMulheres(!soMulheres)}
            style={{ width: 44, height: 24, borderRadius: 12, background: soMulheres ? "#00FF66" : "rgba(255,255,255,0.2)", position: "relative", cursor: "pointer", transition: "0.2s" }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "white", position: "absolute", top: 2, left: soMulheres ? 22 : 2, transition: "0.2s" }} />
          </div>
        </div>
      )}

      {/* Botão de DEBUG para simular o sexo do Tomador */}
      <div style={{ padding: "0 24px", marginTop: 12 }}>
        <button onClick={() => setMockSexoFeminino(!mockSexoFeminino)} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", padding: "4px 8px", borderRadius: 4, fontSize: 10 }}>
          [DEBUG] Simular Tomador: {isMulher ? "Mulher" : "Homem"}
        </button>
      </div>

      <div style={{ margin: "10px 24px 0", display: "flex", alignItems: "center", gap: 10, background: "#18181B", border: "1px solid #27272A", borderRadius: 12, height: 48, padding: "0 14px" }}>
        <Search size={16} color="rgba(255,255,255,0.40)" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou bairro..."
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontFamily: "DM Sans", fontSize: 14 }}
        />
      </div>

      <div style={{ padding: "14px 24px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <Sparkles size={40} color="rgba(255,255,255,0.20)" style={{ margin: "0 auto" }} />
            <p style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "white", marginTop: 12 }}>Nenhuma diarista encontrada.</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Tente outro filtro.</p>
          </div>
        )}
        {filtered.map((d) => (
          <div
            key={d.uid}
            onClick={() => navigate(`/app/diaristas/${d.uid}`)}
            style={{ background: "#18181B", border: "1px solid #27272A", borderRadius: 16, padding: 16, cursor: "pointer" }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: "rgba(0,255,102,0.15)", border: "2px solid rgba(0,255,102,0.30)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#00FF66" }}>
                  {d.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "white" }}>{d.nome}</span>
                  {d.sexo === "feminino" && (
                    <span style={{ background: "rgba(155,89,182,0.15)", border: "1px solid rgba(155,89,182,0.30)", borderRadius: 999, padding: "2px 8px", fontFamily: "DM Sans", fontSize: 10, color: "#9B59B6", whiteSpace: "nowrap" }}>
                      👩 Feminino
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.50)", marginTop: 2 }}>
                  {d.bairro} · {formatDist(haversineKm(-23.432, -45.083, d.location.lat, d.location.lng))}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                  {Array.from({ length: Math.round(d.rating) }).map((_, i) => (
                    <span key={i} style={{ color: "#F5A623", fontSize: 12 }}>★</span>
                  ))}
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "white", marginLeft: 2 }}>{d.rating}</span>
                  <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                    ({d.totalServicos} serviços)
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8 }}>
              <div>
                <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0DB87E" }}>
                  R$ {d.valorPorM2.toFixed(2)}/m²
                </span>
                <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.45)", marginLeft: 4 }}>
                  (mín. {d.minimoM2}m²)
                </span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {DIAS.map((dia, i) => {
                  const ok = d.disponibilidade[dia];
                  return (
                    <div key={dia} style={{
                      width: 22, height: 22, borderRadius: 999,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: ok ? "rgba(13,184,126,0.20)" : "rgba(255,255,255,0.04)",
                    }}>
                      <span style={{ fontFamily: "DM Sans", fontSize: 10, fontWeight: 600, color: ok ? "#0DB87E" : "rgba(255,255,255,0.25)" }}>
                        {LETRAS[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              {d.materiais.map((mId) => {
                const m = MATERIAIS_PADRAO.find((x) => x.id === mId);
                return m ? <span key={mId} style={{ fontSize: 14 }}>{m.emoji}</span> : null;
              })}
              <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.40)", marginLeft: 2 }}>
                Materiais incluídos
              </span>
            </div>
          </div>
        ))}
      </div>

      
    </div>
  );
};

export default DiaristasBuscaPage;
