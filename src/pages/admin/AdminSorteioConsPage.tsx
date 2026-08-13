import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Star, Award, CheckCircle, AlertCircle } from "lucide-react";
import { Card, Avatar, Pill, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface ConsumerParticipant {
  id: string;
  name: string;
  role: string;
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

export default function AdminSorteioConsPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [participants, setParticipants] = useState<ConsumerParticipant[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [splitCons, setSplitCons] = useState(1.5);

  // Lottery draw state
  const [winner, setWinner] = useState<ConsumerParticipant | null>(null);
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
            if (parsed.premioConsumidor !== undefined) {
              currentSplit = Number(parsed.premioConsumidor);
            }
          } catch (e) {
            console.error(e);
          }
        }

        // Fetch from Supabase
        const { data: dbSplitConfig, error: dbSplitError } = await supabase
          .from("split_config")
          .select("premio_consumidor_pct")
          .eq("id", 1)
          .single();

        if (!dbSplitError && dbSplitConfig) {
          currentSplit = Number(dbSplitConfig.premio_consumidor_pct);
        }
        setSplitCons(currentSplit);

        const { data: dbUsers, error: errUsers } = await supabase.from("usuarios").select("*");
        if (errUsers) throw errUsers;

        const { data: dbPedidos, error: errPedidos } = await supabase.from("pedidos").select("*");
        if (errPedidos) throw errPedidos;

        const validStatuses = ["confirmed", "completed", "rating"];
        const confirmedPedidos = dbPedidos || [];

        // Total volume from DB + baseline R$ 54.200,00
        const dbVol = confirmedPedidos
          .filter(p => validStatuses.includes(p.status))
          .reduce((acc, p) => acc + Number(p.total || 0), 0);
        setTotalVolume(54200.00 + dbVol);

        const mapped: ConsumerParticipant[] = (dbUsers || [])
          .map((u: any) => {
            // All users are consumers
            const completed = confirmedPedidos.filter(
              p => p.tomador_id === u.id && validStatuses.includes(p.status)
            ).length;

            // Consumer baseline of 5 tickets + completed orders count multiplied by tickets per ride (1 ticket per 0.5% prize split)
            const ticketsPerRide = Math.floor(currentSplit / 0.5);
            const ticketsCount = 5 + completed * ticketsPerRide;

            return {
              id: u.id,
              name: u.nome,
              role: u.role,
              completedRides: completed,
              tickets: ticketsCount,
            };
          });

        setParticipants(mapped);
      } catch (err) {
        console.error("Erro ao carregar dados do Sorteio 1/11:", err);
        toast.show("Erro ao carregar dados do sorteio.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const totalTickets = participants.reduce((acc, p) => acc + p.tickets, 0);
  const prizePool = totalVolume * (splitCons / 100); // % customizada destinada ao prêmio

  // Simulating lottery draw
  const handleDraw = () => {
    if (participants.length === 0) {
      toast.show("Nenhum participante habilitado para o sorteio.");
      return;
    }
    setIsDrawing(true);
    setWinner(null);

    // Build the tickets pool
    const pool: ConsumerParticipant[] = [];
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
            Sorteio Consumidor (1/11)
          </h1>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", marginTop: 4 }}>
            Sorteio especial realizado no dia 1º de novembro beneficiando consumidores e passageiros ativos.
            <br />
            <span style={{ fontSize: 13, color: "#E84040", fontWeight: 500, display: "inline-block", marginTop: 6 }}>
              Regra de Tickets: Cada consumidor recebe 5 tickets de base. Conforme o Split de Pagamentos ({splitCons}%), o consumidor recebe {Math.floor(splitCons / 0.5)} tickets a cada transação/serviço tomado (1 ticket a cada 0,5% destinado ao prêmio).
            </span>
          </p>
        </div>

        <PrimaryButton
          onClick={handleDraw}
          disabled={isDrawing || participants.length === 0}
          style={{
            background: "#E84040",
            border: "1px solid #c0392b",
            padding: "12px 24px",
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Star size={18} />
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
            {getNextDrawDateAndDays(10).formattedDate}
          </div>
          <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "#E84040", marginTop: 4, fontWeight: 600 }}>
            {getNextDrawDateAndDays(10).daysRemaining} dias restantes
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
            {participants.length} consumidores cadastrados
          </div>
        </Card>
      </div>

      {/* Drawing state display */}
      {isDrawing && winner && (
        <Card style={{ padding: 32, textAlign: "center", border: "2px dashed #E84040", background: "#fff5f5", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Award className="animate-spin" size={40} color="#E84040" />
          </div>
          <div style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#E84040" }}>
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
          Consumidores Habilitados
        </h2>

        {/* Search */}
        <div style={{ position: "relative", width: 260 }}>
          <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar consumidor..."
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
            Nenhum consumidor habilitado encontrado.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--admin-bg)" }}>
                <tr>
                  {["Consumidor", "Papel", "Corridas Realizadas", `Tickets Habilitados (5 Base + ${Math.floor(splitCons / 0.5)} p/ transação)`, "Chances"].map((h) => (
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
                        <Pill bg="rgba(43, 110, 232, 0.10)" color="#2B6EE8" size="sm">
                          {p.role === "admin" ? "Admin" : (p.role.startsWith("cocoecia") ? "Côco & Cia" : "Tomador")}
                        </Pill>
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
              border: "3px solid #E84040",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ padding: 16, borderRadius: "50%", background: "rgba(232, 64, 64, 0.12)", color: "#E84040" }}>
                <Star size={48} />
              </div>
            </div>

            <h2 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 8px" }}>
              Ganhador do Sorteio!
            </h2>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", marginBottom: 24 }}>
              O consumidor abaixo foi contemplado no sorteio do Prêmio Consumidor 1/11!
            </p>

            <Card style={{ padding: 20, background: "#fff5f5", border: "1px solid rgba(232, 64, 64, 0.2)", marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Avatar name={winner.name} />
                <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)" }}>
                  {winner.name}
                </div>
                <Pill bg="rgba(43, 110, 232, 0.15)" color="#2B6EE8" size="sm">
                  {winner.role === "admin" ? "Admin" : (winner.role.startsWith("cocoecia") ? "Côco & Cia" : "Tomador")}
                </Pill>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(232, 64, 64, 0.15)", marginTop: 16, paddingTop: 12 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>Prêmio Acumulado</span>
                <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0DB87E" }}>
                  {formatBR(prizePool)}
                </span>
              </div>
            </Card>

            <PrimaryButton
              onClick={() => setShowWinnerModal(false)}
              style={{ width: "100%", background: "#E84040", border: "1px solid #c0392b" }}
            >
              Fechar e Finalizar
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
