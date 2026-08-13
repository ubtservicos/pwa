import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { User, Building2, Users, Gift, Star, Heart, AlertCircle, AlertTriangle } from "lucide-react";
import { Card, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

type SplitKey = "prestador" | "ubt" | "comunidade" | "premioTrabalhador" | "premioConsumidor" | "padrinho";

const SPLIT_CONFIG: { key: SplitKey; label: string; Icon: any; color: string }[] = [
  { key: "prestador", label: "Prestador", Icon: User, color: "#0DB87E" },
  { key: "ubt", label: "UBT", Icon: Building2, color: "#F5A623" },
  { key: "comunidade", label: "Comunidade", Icon: Users, color: "#2B6EE8" },
  { key: "premioTrabalhador", label: "Prêmio Trabalhador", Icon: Gift, color: "#9B59B6" },
  { key: "premioConsumidor", label: "Prêmio Consumidor", Icon: Star, color: "#E84040" },
  { key: "padrinho", label: "Padrinho/Madrinha", Icon: Heart, color: "#0DB87E" },
];

const formatBR = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AdminSplitPage() {
  const toast = useAdminToast();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get("highlight");

  const [split, setSplit] = useState<Record<SplitKey, number>>({
    prestador: 90,
    ubt: 5,
    comunidade: 2,
    premioTrabalhador: 1,
    premioConsumidor: 1,
    padrinho: 1,
  });
  const [pixKeys, setPixKeys] = useState<Record<string, string>>({
    ubt: "12.345.678/0001-90",
    comunidade: "",
    premioTrabalhador: "",
    premioConsumidor: "",
    padrinho: "",
  });
  const [pixTypes, setPixTypes] = useState<Record<string, string>>({
    ubt: "cnpj",
    comunidade: "cnpj",
    premioTrabalhador: "aleatoria",
    premioConsumidor: "aleatoria",
    padrinho: "cpf",
  });

  const [totalTrabalhadorTickets, setTotalTrabalhadorTickets] = useState(0);
  const [totalConsumidorTickets, setTotalConsumidorTickets] = useState(0);
  const [totalDbVolume, setTotalDbVolume] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    // Read from localStorage on mount as basic fallback
    const savedSplit = localStorage.getItem("ubt_split_config");
    if (savedSplit) {
      try {
        setSplit(JSON.parse(savedSplit));
      } catch (e) {
        console.error(e);
      }
    }
    const savedPixKeys = localStorage.getItem("ubt_pix_keys");
    if (savedPixKeys) {
      try {
        setPixKeys(JSON.parse(savedPixKeys));
      } catch (e) {
        console.error(e);
      }
    }
    const savedPixTypes = localStorage.getItem("ubt_pix_types");
    if (savedPixTypes) {
      try {
        setPixTypes(JSON.parse(savedPixTypes));
      } catch (e) {
        console.error(e);
      }
    }

    const fetchData = async () => {
      try {
        let trabSplit = 1.5;
        let consSplit = 1.5;

        // Fetch primary split_config from Supabase
        const { data: dbSplitConfig, error: dbSplitError } = await supabase
          .from("split_config")
          .select("*")
          .eq("id", 1)
          .single();

        if (!dbSplitError && dbSplitConfig) {
          const loadedSplit = {
            prestador: Number(dbSplitConfig.prestador_pct),
            ubt: Number(dbSplitConfig.ubt_pct),
            comunidade: Number(dbSplitConfig.comunidade_pct),
            premioTrabalhador: Number(dbSplitConfig.premio_trabalhador_pct),
            premioConsumidor: Number(dbSplitConfig.premio_consumidor_pct),
            padrinho: Number(dbSplitConfig.padrinho_pct),
          };
          setSplit(loadedSplit);
          trabSplit = loadedSplit.premioTrabalhador;
          consSplit = loadedSplit.premioConsumidor;
        } else if (savedSplit) {
          try {
            const parsed = JSON.parse(savedSplit);
            if (parsed.premioTrabalhador !== undefined) trabSplit = Number(parsed.premioTrabalhador);
            if (parsed.premioConsumidor !== undefined) consSplit = Number(parsed.premioConsumidor);
          } catch (e) {
            console.error(e);
          }
        }

        const ticketsPerRideTrab = Math.floor(trabSplit / 0.5);
        const ticketsPerRideCons = Math.floor(consSplit / 0.5);

        const { data: dbUsers } = await supabase.from("usuarios").select("id, role");
        const { data: dbPedidos } = await supabase.from("pedidos").select("total, status, tomador_id, prestador_id");
        
        // diarista_perfis
        const { data: diaristas } = await supabase.from("diarista_perfis").select("user_id");
        const diaristasSet = new Set(diaristas?.map(d => d.user_id) || []);

        // coco_caminhoes
        const { data: caminhoes } = await supabase.from("coco_caminhoes").select("prestador_id");
        const caminhoesSet = new Set(caminhoes?.map(c => c.prestador_id) || []);

        const validStatuses = ["confirmed", "completed", "rating"];
        const confirmedPedidos = dbPedidos || [];

        // Calculate total tickets
        let workerTickets = 0;
        let consumerTickets = 0;

        if (dbUsers) {
          dbUsers.forEach((u: any) => {
            const isColab = u.role === "cocoecia-colaborador" || u.role === "cocoecia-dirigentes" || u.role === "cocoecia";
            const isDiarista = diaristasSet.has(u.id);
            const isWorker = u.role === "prestador" || isColab || isDiarista;

            // Worker tickets
            if (isWorker) {
              const ordersCount = confirmedPedidos.filter(p => p.prestador_id === u.id && validStatuses.includes(p.status)).length;
              workerTickets += (ordersCount * ticketsPerRideTrab) + 8;
            }

            // Consumer tickets
            const ordersCountTomador = confirmedPedidos.filter(p => p.tomador_id === u.id && validStatuses.includes(p.status)).length;
            consumerTickets += (ordersCountTomador * ticketsPerRideCons) + 5;
          });
        }

        // Calculate volume
        const dbVol = confirmedPedidos
          .filter(p => validStatuses.includes(p.status))
          .reduce((acc, p) => acc + Number(p.total || 0), 0);

        setTotalTrabalhadorTickets(workerTickets);
        setTotalConsumidorTickets(consumerTickets);
        setTotalDbVolume(dbVol);
      } catch (err) {
        console.error("Erro ao carregar dados do split/sorteio:", err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const getNextDrawDateAndDays = (targetMonth: number) => {
    const now = new Date();
    let targetYear = now.getFullYear();
    if (now.getMonth() > targetMonth || (now.getMonth() === targetMonth && now.getDate() > 1)) {
      targetYear += 1;
    }
    const targetDate = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const diffTime = targetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      formattedDate: `01/` + String(targetMonth + 1).padStart(2, '0') + `/` + targetYear,
      daysRemaining: diffDays,
    };
  };

  const total = Object.values(split).reduce((a, v) => a + v, 0);
  const ok = Math.abs(total - 100) < 0.001;

  const baseVolume = 54200.00;
  const totalVolumeCalculated = baseVolume + totalDbVolume;
  const destinado1_5 = totalVolumeCalculated * (split.premioTrabalhador / 100);
  const destinado1_11 = totalVolumeCalculated * (split.premioConsumidor / 100);

  const handleSave = async () => {
    try {
      // 1. Update primary split_config table
      const { error: splitError } = await supabase
        .from("split_config")
        .update({
          prestador_pct: split.prestador,
          ubt_pct: split.ubt,
          comunidade_pct: split.comunidade,
          premio_trabalhador_pct: split.premioTrabalhador,
          premio_consumidor_pct: split.premioConsumidor,
          padrinho_pct: split.padrinho,
          updated_at: new Date().toISOString()
        })
        .eq("id", 1);

      if (splitError) throw splitError;

      // 2. Sync with system_settings table (authenticated admins only via RLS)
      await Promise.all([
        supabase
          .from("system_settings")
          .update({ valor: split.ubt / 100 })
          .eq("chave", "taxa_ubt"),
        supabase
          .from("system_settings")
          .update({ valor: split.premioConsumidor / 100 })
          .eq("chave", "premio_consumidor"),
        supabase
          .from("system_settings")
          .update({ valor: split.premioTrabalhador / 100 })
          .eq("chave", "premio_prestador"),
        supabase
          .from("system_settings")
          .update({ valor: split.comunidade / 100 })
          .eq("chave", "percentual_associacao")
      ]);

      localStorage.setItem("ubt_split_config", JSON.stringify(split));
      localStorage.setItem("ubt_pix_keys", JSON.stringify(pixKeys));
      localStorage.setItem("ubt_pix_types", JSON.stringify(pixTypes));
      toast.show("Configurações financeiras sincronizadas com o banco de dados!");
    } catch (err: any) {
      console.error("Erro ao salvar configuração no banco:", err);
      toast.show("Erro ao salvar no banco: " + (err.message || err));
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>Configuração da Taxa de Serviço</h1>
      <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", marginTop: 8 }}>
        Define como a taxa de serviço de cada transação é dividida entre as contas beneficiárias.
      </p>

      <Card style={{ padding: 28, marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {SPLIT_CONFIG.map((s, idx) => (
            <div
              key={s.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: idx < SPLIT_CONFIG.length - 1 ? "1px solid #E2E8F0" : "none",
              }}
            >
              <s.Icon size={16} color={s.color} />
              <div style={{ flex: 1, fontFamily: "DM Sans", fontSize: 15, fontWeight: 500, color: "var(--admin-text)" }}>{s.label}</div>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={split[s.key]}
                onChange={(e) => setSplit((sp) => ({ ...sp, [s.key]: Number(e.target.value) }))}
                style={{
                  width: 78,
                  textAlign: "right",
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--admin-text)",
                  background: "var(--admin-bg)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 8,
                  padding: "7px 10px",
                  outline: "none",
                }}
              />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-muted)" }}>%</span>
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-muted)", minWidth: 86, textAlign: "right", marginRight: 16 }}>
                ≈ R$ {((40 * split[s.key]) / 100).toFixed(2)}
              </span>
              
              {/* PIX Key Input for required items */}
              {s.key !== "prestador" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    value={pixTypes[s.key] || "cnpj"}
                    onChange={(e) => setPixTypes((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      color: "var(--admin-text)",
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="cnpj">CNPJ</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="celular">Celular</option>
                    <option value="aleatoria">Aleatória</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Chave PIX..."
                    value={pixKeys[s.key] || ""}
                    onChange={(e) => setPixKeys((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    style={{
                      width: 180,
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      color: "var(--admin-text)",
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      outline: "none",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 20, height: 12, borderRadius: 999, overflow: "hidden", display: "flex", background: "var(--admin-bg)" }}>
          {SPLIT_CONFIG.map((s) => (
            <div
              key={s.key}
              style={{ width: `${(split[s.key] / Math.max(total, 100)) * 100}%`, background: s.color, transition: "width 300ms" }}
            />
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 600, color: ok ? "var(--admin-text)" : "#E84040" }}>
            Total: {total.toFixed(1)}%
          </span>
          {!ok && (
            <>
              <AlertCircle size={16} color="#E84040" />
              <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#E84040" }}>Deve somar exatamente 100%.</span>
            </>
          )}
        </div>

        <div
          style={{
            background: "rgba(245,166,35,0.08)",
            border: "1px solid rgba(245,166,35,0.30)",
            borderRadius: 10,
            padding: 14,
            display: "flex",
            gap: 10,
            marginTop: 16,
          }}
        >
          <AlertTriangle size={16} color="#F5A623" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
            Atenção: estas configurações afetam todas as novas transações imediatamente. Transações já realizadas não são alteradas.
          </span>
        </div>

        <PrimaryButton
          disabled={!ok}
          onClick={handleSave}
          style={{ width: "100%", marginTop: 20, padding: "12px 18px", fontSize: 14 }}
        >
          Salvar configuração
        </PrimaryButton>
      </Card>
    </div>
  );
}
