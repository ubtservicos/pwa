import { useState, useEffect } from "react";
import { 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  Clock, 
  Check, 
  X, 
  MapPin 
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

export interface AgendaBairro {
  id: string;
  bairro_nome: string;
  dia_semana: string;
  horario_inicio: string;
  horario_fim: string;
  is_active: boolean;
}

const DIAS_SEMANA = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
];

export default function AdminCocoAgenda() {
  const toast = useAdminToast();
  const [agendas, setAgendas] = useState<AgendaBairro[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgenda, setEditingAgenda] = useState<AgendaBairro | null>(null);
  const [agendaBairroNome, setAgendaBairroNome] = useState("");
  const [agendaDiaSemana, setAgendaDiaSemana] = useState("Segunda-feira");
  const [agendaHoraInicio, setAgendaHoraInicio] = useState("08:00");
  const [agendaHoraFim, setAgendaHoraFim] = useState("12:00");
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAgendas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coco_agenda_bairros")
        .select("*")
        .order("bairro_nome", { ascending: true });

      if (!error && data && data.length > 0) {
        setAgendas(data);
      }
    } catch (e) {
      console.warn("Offline fallback para escala de bairros:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgendas();
  }, []);

  const handleOpenAgendaModal = (agenda?: AgendaBairro) => {
    if (agenda) {
      setEditingAgenda(agenda);
      setAgendaBairroNome(agenda.bairro_nome);
      setAgendaDiaSemana(agenda.dia_semana);
      setAgendaHoraInicio(agenda.horario_inicio);
      setAgendaHoraFim(agenda.horario_fim);
    } else {
      setEditingAgenda(null);
      setAgendaBairroNome("");
      setAgendaDiaSemana("Segunda-feira");
      setAgendaHoraInicio("08:00");
      setAgendaHoraFim("12:00");
    }
    setIsAgendaModalOpen(true);
  };

  const handleSaveAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaBairroNome.trim()) {
      toast.show("Informe o nome do bairro.");
      return;
    }

    setSaving(true);
    try {
      if (editingAgenda) {
        // Atualizar
        const { error } = await supabase
          .from("coco_agenda_bairros")
          .update({
            bairro_nome: agendaBairroNome,
            dia_semana: agendaDiaSemana,
            horario_inicio: agendaHoraInicio,
            horario_fim: agendaHoraFim
          })
          .eq("id", editingAgenda.id);

        if (error) throw error;
        toast.show("Escala do bairro atualizada com sucesso!");
      } else {
        // Inserir
        const { error } = await supabase
          .from("coco_agenda_bairros")
          .insert([{
            bairro_nome: agendaBairroNome,
            dia_semana: agendaDiaSemana,
            horario_inicio: agendaHoraInicio,
            horario_fim: agendaHoraFim,
            is_active: true
          }]);

        if (error) throw error;
        toast.show("Bairro adicionado à escala de coleta!");
      }

      setIsAgendaModalOpen(false);
      fetchAgendas();
    } catch (err: any) {
      // Fallback local
      if (editingAgenda) {
        setAgendas(prev => prev.map(a => a.id === editingAgenda.id ? {
          ...a,
          bairro_nome: agendaBairroNome,
          dia_semana: agendaDiaSemana,
          horario_inicio: agendaHoraInicio,
          horario_fim: agendaHoraFim
        } : a));
      } else {
        setAgendas(prev => [...prev, {
          id: `local-${Date.now()}`,
          bairro_nome: agendaBairroNome,
          dia_semana: agendaDiaSemana,
          horario_inicio: agendaHoraInicio,
          horario_fim: agendaHoraFim,
          is_active: true
        }]);
      }
      toast.show("Escala salva localmente.");
      setIsAgendaModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAgendaActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("coco_agenda_bairros")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      toast.show("Status da rota atualizado!");
      fetchAgendas();
    } catch {
      setAgendas(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
      toast.show("Status atualizado localmente.");
    }
  };

  const handleDeleteAgenda = async (id: string, bairroNome: string) => {
    if (!window.confirm(`Tem certeza que deseja remover "${bairroNome}" da rota de coleta?`)) return;

    try {
      const { error } = await supabase
        .from("coco_agenda_bairros")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.show("Bairro removido da escala.");
      fetchAgendas();
    } catch {
      setAgendas(prev => prev.filter(a => a.id !== id));
      toast.show("Bairro removido localmente.");
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
              <Calendar size={20} />
            </div>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
              Escala de Coleta por Bairros (Rotas Semanais)
            </h1>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
            Define os dias e horários em que os caminhões atendem cada região de Ubatuba para a trava geográfica do cidadão.
          </p>
        </div>

        <button
          onClick={() => handleOpenAgendaModal()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0DB87E",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontFamily: "Syne",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(13,184,126,0.3)"
          }}
        >
          <Plus size={16} /> Adicionar Bairro
        </button>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-subtle)", fontSize: 12, textTransform: "uppercase" }}>
              <th style={{ padding: "16px 20px" }}>Bairro de Ubatuba</th>
              <th style={{ padding: "16px 20px" }}>Dia da Semana</th>
              <th style={{ padding: "16px 20px" }}>Horário de Coleta</th>
              <th style={{ padding: "16px 20px" }}>Status</th>
              <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {agendas.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px 20px", textAlign: "center", color: "var(--admin-muted)" }}>
                  Nenhum bairro cadastrado na rota.
                </td>
              </tr>
            ) : (
              agendas.map((ag) => (
                <tr key={ag.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                  <td style={{ padding: "16px 20px", fontWeight: 700, color: "var(--admin-text)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <MapPin size={15} color="#0DB87E" />
                      {ag.bairro_nome}
                    </div>
                  </td>
                  <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(13,184,126,0.1)", color: "#0DB87E", padding: "4px 10px", borderRadius: 8, fontWeight: 600, fontSize: 12 }}>
                      <Calendar size={13} /> {ag.dia_semana}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Clock size={14} color="var(--admin-muted)" /> {ag.horario_inicio} às {ag.horario_fim}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <button
                      onClick={() => handleToggleAgendaActive(ag.id, ag.is_active)}
                      style={{
                        border: "none",
                        background: ag.is_active ? "rgba(13,184,126,0.15)" : "var(--admin-border)",
                        color: ag.is_active ? "#0DB87E" : "var(--admin-muted)",
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      {ag.is_active ? "🟢 Ativo na Rota" : "⚪ Pausado"}
                    </button>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      <button
                        onClick={() => handleOpenAgendaModal(ag)}
                        style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 6 }}
                        title="Editar Bairro"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteAgenda(ag.id, ag.bairro_nome)}
                        style={{ background: "transparent", border: "none", color: "#E84040", cursor: "pointer", padding: 6 }}
                        title="Remover Bairro"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Modal de Bairro */}
      {isAgendaModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: 16, width: "100%", maxWidth: 440, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                {editingAgenda ? "Editar Escala do Bairro" : "Adicionar Bairro à Escala"}
              </h3>
              <button onClick={() => setIsAgendaModalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAgenda} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Nome do Bairro (Ubatuba) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Itaguá, Perequê-Açu, Toninhas"
                  value={agendaBairroNome}
                  onChange={(e) => setAgendaBairroNome(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Dia da Semana de Coleta *
                </label>
                <select
                  value={agendaDiaSemana}
                  onChange={(e) => setAgendaDiaSemana(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia} value={dia}>{dia}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                    Horário Início
                  </label>
                  <input
                    type="time"
                    required
                    value={agendaHoraInicio}
                    onChange={(e) => setAgendaHoraInicio(e.target.value)}
                    style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                    Horário Término
                  </label>
                  <input
                    type="time"
                    required
                    value={agendaHoraFim}
                    onChange={(e) => setAgendaHoraFim(e.target.value)}
                    style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                <GhostButton type="button" onClick={() => setIsAgendaModalOpen(false)}>
                  Cancelar
                </GhostButton>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? "Salvando..." : (editingAgenda ? "Salvar Alterações" : "Adicionar Bairro")}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
