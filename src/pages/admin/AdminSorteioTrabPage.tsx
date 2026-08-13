import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Gift, Award, CheckCircle, AlertCircle } from "lucide-react";
import { Card, Avatar, Pill, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface WorkerParticipant {
  id: string;
  name: string;
  role: string;
  categories: string[];
  completedRides: number;
  tickets: number;
}

const formatBR = (n: number) =>
  "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

export default function AdminSorteioTrabPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [participants, setParticipants] = useState<WorkerParticipant[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [splitTrab, setSplitTrab] = useState(1.5);

  // Lottery draw state
  const [winner, setWinner] = useState<WorkerParticipant | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        let currentSplit = 1.5;
        const savedSplit = localStorage.getItem("ubt_split_config");
        if (savedSplit) {
          try {
            const parsed = JSON.parse(savedSplit);
            if (parsed.premioTrabalhador !== undefined) {
              currentSplit = Number(parsed.premioTrabalhador);
            }
          } catch (e) {
            console.error(e);
          }
        }

        // Fetch from Supabase
        const { data: dbSplitConfig, error: dbSplitError } = await supabase
          .from("split_config")
          .select("premio_trabalhador_pct")
          .eq("id", 1)
          .single();

        if (!dbSplitError && dbSplitConfig) {
          currentSplit = Number(dbSplitConfig.premio_trabalhador_pct);
        }
        setSplitTrab(currentSplit);

        const { data: dbUsers, error: errUsers } = await supabase.from("usuarios").select("*");
        if (errUsers) throw errUsers;

        const { data: dbPedidos, error: errPedidos } = await supabase.from("pedidos").select("*");
        if (errPedidos) throw errPedidos;

        const { data: diaristas } = await supabase.from("diarista_perfis").select("user_id");
        const diaristasSet = new Set(diaristas?.map(d => d.user_id) || []);

        const { data: caminhoes } = await supabase.from("coco_caminhoes").select("prestador_id");
        const caminhoesSet = new Set(caminhoes?.map(c => c.prestador_id) || []);

        const validStatuses = ["confirmed", "completed", "rating"];
        const confirmedPedidos = dbPedidos || [];

        // Total volume from DB + baseline R$ 54.200,00
        const dbVol = confirmedPedidos
          .filter(p => validStatuses.includes(p.status))
          .reduce((acc, p) => acc + Number(p.total || 0), 0);
        setTotalVolume(54200.00 + dbVol);

        const mapped: WorkerParticipant[] = (dbUsers || [])
          .map((u: any) => {
            const isColab = u.role === "cocoecia-colaborador" || u.role === "cocoecia-dirigentes" || u.role === "cocoecia";
            const isDiarista = diaristasSet.has(u.id);
            const isWorker = u.role === "prestador" || isColab || isDiarista;

            if (!isWorker) return null;

            const categories: string[] = [];
            if (isColab) categories.push("Reciclagem");
            if (isDiarista) categories.push("Diarista");
            if (caminhoesSet.has(u.id)) categories.push("Reciclagem");
            if (u.role === "prestador" && !isColab && !isDiarista) categories.push("Mototaxi");
            if (categories.length === 0) categories.push("Geral");

            const completed = confirmedPedidos.filter(
              p => p.prestador_id === u.id && validStatuses.includes(p.status)
            ).length;

            // Worker baseline of 8 tickets + completed orders count multiplied by tickets per ride (1 ticket per 0.5% prize split)
            const ticketsPerRide = Math.floor(currentSplit / 0.5);
            const ticketsCount = 8 + completed * ticketsPerRide;

            return {
              id: u.id,
              name: u.nome,
              role: u.role,
              categories,
              completedRides: completed,
              tickets: ticketsCount,
            };
          })
          .filter((x): x is WorkerParticipant => x !== null);

        setParticipants(mapped);
      } catch (err) {
        console.error("Erro ao carregar dados do Sorteio 1/5:", err);
        toast.show("Erro ao carregar dados do sorteio.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const totalTickets = participants.reduce((acc, p) => acc + p.tickets, 0);
  const prizePool = totalVolume * (splitTrab / 100); // % customizada destinada ao prêmio

  // Simulating lottery draw
  const handleDraw = () => {
    if (participants.length === 0) {
      toast.show("Nenhum participante habilitado para o sorteio.");
      return;
    }
    setIsDrawing(true);
    setWinner(null);

    // Build the tickets pool
    const pool: WorkerParticipant[] = [];
    participants.forEach((p) => {
      for (let i = 0; i < p.tickets; i++) {
        pool.push(p);
      }
    });

    // Animate sorting effect for 2 seconds
    let counter = 0;
    const interval = setInterval(() => {
      const tempWinner = pool[Math.floor(Math.random() * pool.length)];
      setWinner(tempWinner);
      counter++;
      if (counter > 15) {
        clearInterval(interval);
        // Final draw
        const finalWinner = pool[Math.floor(Math.random() * pool.length)];
        setWinner(finalWinner);
        setIsDrawing(false);
        setShowWinnerModal(true);
      }
    }, 120);
  };

  const filtered = participants.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ fontFamily: "DM Sans", color: "var(--admin-muted)" }}>Carregando dados do sorteio...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      {/* Back Button */}
      <button
        onClick={() => navigate("/admin")}
        style={{
          background: "none",
          border: "none",
          color: "var(--admin-subtle)",
          fontFamily: "DM Sans",
          fontSize: 14,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginBottom: 24,
          transition: "color 150ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--admin-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--admin-subtle)")}
      >
        <ArrowLeft size={16} /> Voltar para o Dashboard
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24, marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 26, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
            Sorteio Prêmio Trabalhador (1/5)
          </h1>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", marginTop: 4 }}>
            Sorteio especial realizado no dia 1º de maio (dia do trabalhador) beneficiando prestadores de serviços ativos.
            <br />
            <span style={{ fontSize: 13, color: "#9B59B6", fontWeight: 500, display: "inline-block", marginTop: 6 }}>
              Regra de Tickets: Cada trabalhador recebe 8 tickets de base. Conforme o Split de Pagamentos ({splitTrab}%), o trabalhador recebe {Math.floor(splitTrab / 0.5)} tickets a cada transação/serviço prestado (1 ticket a cada 0,5% destinado ao prêmio).
            </span>
          </p>
        </div>

        <PrimaryButton
          onClick={handleDraw}
          disabled={isDrawing || participants.length === 0}
          style={{
            background: "#9B59B6",
            border: "1px solid #8e44ad",
            padding: "12px 24px",
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Gift size={18} />
          {isDrawing ? "Sorteando..." : "Realizar Sorteio"}
        </PrimaryButton>
      </div>

      {/* Sorteio Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 32 }}>
        <Card style={{ padding: 20, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            Data do Sorteio
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "var(--admin-text)", marginTop: 8 }}>
            {getNextDrawDateAndDays(4).formattedDate}
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "#9B59B6", marginTop: 4, fontWeight: 600 }}>
            {getNextDrawDateAndDays(4).daysRemaining} dias restantes
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            Acumulado Prêmio (1.5%)
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0DB87E", marginTop: 8 }}>
            {formatBR(prizePool)}
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-muted)", marginTop: 4 }}>
            Volume plat: {formatBR(totalVolume)}
          </div>
        </Card>

        <Card style={{ padding: 20, border: "1px solid var(--admin-border)", background: "var(--admin-bg)" }}>
          <div style={{ fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
            Tickets Habilitados
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "var(--admin-text)", marginTop: 8 }}>
            {totalTickets}
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "var(--admin-muted)", marginTop: 4 }}>
            {participants.length} trabalhadores cadastrados
          </div>
        </Card>
      </div>

      {/* Drawing state display */}
      {isDrawing && winner && (
        <Card style={{ padding: 32, textAlign: "center", border: "2px dashed #9B59B6", background: "#fcf6ff", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Award className="animate-spin" size={40} color="#9B59B6" />
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#9B59B6" }}>
            Sorteando Ganhador...
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 18, fontWeight: 600, color: "var(--admin-text)", marginTop: 8 }}>
            {winner.name}
          </div>
        </Card>
      )}

      {/* Participants list */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
          Trabalhadores Habilitados
        </h2>

        {/* Search */}
        <div style={{ position: "relative", width: 260 }}>
          <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar trabalhador..."
            style={{
              width: "100%",
              height: 40,
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "0 14px 0 38px",
              fontFamily: "DM Sans",
              fontSize: 14,
              color: "var(--admin-text)",
              outline: "none",
            }}
          />
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Nenhum trabalhador habilitado encontrado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--admin-bg)" }}>
                <tr>
                  {["Trabalhador", "Categorias", "Serviços Prestados", `Tickets Habilitados (8 Base + ${Math.floor(splitTrab / 0.5)} p/ transação)`, "Chances"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 20px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--admin-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const chance = totalTickets > 0 ? ((p.tickets / totalTickets) * 100).toFixed(2) : "0.00";
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--admin-border)", transition: "background 100ms" }}>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={p.name} />
                          <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", fontWeight: 500 }}>
                            {p.name}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {p.categories.map((c) => (
                            <Pill key={c} bg="rgba(155, 89, 182, 0.10)" color="#9B59B6" size="sm">
                              {c}
                            </Pill>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)" }}>
                        {p.completedRides}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", fontWeight: 600 }}>
                        {p.tickets}
                      </td>
                      <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, color: "#0DB87E", fontWeight: 600 }}>
                        {chance}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Winner Celebration Modal */}
      {showWinnerModal && winner && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              background: "var(--admin-bg)",
              borderRadius: 16,
              padding: 32,
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              position: "relative",
              margin: "auto",
              border: "3px solid #9B59B6",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ padding: 16, borderRadius: "50%", background: "rgba(155, 89, 182, 0.15)", color: "#9B59B6" }}>
                <Gift size={48} />
              </div>
            </div>

            <h2 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 8px" }}>
              Ganhador do Sorteio!
            </h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", marginBottom: 24 }}>
              O prestador abaixo foi contemplado no sorteio do Prêmio Trabalhador 1/5!
            </p>

            <Card style={{ padding: 20, background: "#fcf6ff", border: "1px solid rgba(155, 89, 182, 0.2)", marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Avatar name={winner.name} />
                <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)" }}>
                  {winner.name}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  {winner.categories.map((c) => (
                    <Pill key={c} bg="rgba(155, 89, 182, 0.12)" color="#9B59B6" size="sm">
                      {c}
                    </Pill>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(155, 89, 182, 0.15)", marginTop: 16, paddingTop: 12 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>Prêmio Acumulado</span>
                <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0DB87E" }}>
                  {formatBR(prizePool)}
                </span>
              </div>
            </Card>

            <PrimaryButton
              onClick={() => setShowWinnerModal(false)}
              style={{ width: "100%", background: "#9B59B6", border: "1px solid #8e44ad" }}
            >
              Fechar e Finalizar
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
