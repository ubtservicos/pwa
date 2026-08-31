import React, { useState, useEffect } from "react";
import { 
  Truck, 
  Plus, 
  Search, 
  Check, 
  X, 
  ShieldAlert, 
  Trash2, 
  ArrowLeft, 
  DollarSign, 
  MapPin, 
  Layers,
  Settings,
  Edit3
} from "lucide-react";
import { Card, PrimaryButton, GhostButton, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

const BAIRROS_UBATUBA = [
  "Centro",
  "Itaguá",
  "Praia Grande",
  "Toninhas",
  "Enseada",
  "Perequê-Açu",
  "Maranduba",
  "Ubatumirim",
  "Estufa I e II",
  "Ipiranguinha",
  "Tamoios",
  "Taquaral"
];

export default function AdminCocoFrota() {
  const toast = useAdminToast();
  const navigate = useNavigate();

  const [caminhoes, setCaminhoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "online" | "pending" | "approved">("todos");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [plate, setPlate] = useState("");
  const [apelido, setApelido] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [roleSolicitada, setRoleSolicitada] = useState("cocoecia-colaborador");
  const [selectedBairros, setSelectedBairros] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchCaminhoes = async () => {
    try {
      const { data, error } = await supabase
        .from("coco_caminhoes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setCaminhoes(data);
    } catch (err: any) {
      console.warn("Erro ao buscar frota:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaminhoes();

    const channel = supabase
      .channel("admin-frota-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coco_caminhoes" },
        () => fetchCaminhoes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateCaminhao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !apelido.trim()) {
      toast.show("Informe a placa e o apelido do veículo.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("coco_caminhoes")
        .insert({
          plate: plate.trim().toUpperCase(),
          apelido: apelido.trim(),
          pix_key: pixKey.trim() || null,
          role_solicitada: roleSolicitada,
          areas_atendidas: selectedBairros.length > 0 ? selectedBairros : ["Centro", "Itaguá"],
          status_aprovacao: "approved",
          is_online: false,
          collections_today: 0,
          total_collections: 0,
        })
        .select()
        .single();

      if (error) throw error;

      toast.show(`Caminhão "${apelido}" cadastrado com sucesso!`);
      setIsModalOpen(false);
      setPlate("");
      setApelido("");
      setPixKey("");
      setSelectedBairros([]);
      fetchCaminhoes();
    } catch (err: any) {
      toast.show(`Erro ao cadastrar caminhão: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOnline = async (id: string, currentOnline: boolean, apelido: string) => {
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({ is_online: !currentOnline })
        .eq("id", id);
      if (error) throw error;
      toast.show(`Caminhão "${apelido}" agora está ${!currentOnline ? "ONLINE 🟢" : "OFFLINE ⚪"}.`);
      fetchCaminhoes();
    } catch (err: any) {
      toast.show(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleDeleteCaminhao = async (id: string, apelido: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o caminhão "${apelido}" da frota?`)) return;
    try {
      const { error } = await supabase.from("coco_caminhoes").delete().eq("id", id);
      if (error) throw error;
      toast.show(`Caminhão "${apelido}" removido da frota.`);
      fetchCaminhoes();
    } catch (err: any) {
      toast.show(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleAprovar = async (id: string, prestadorId: string, apelido: string, role?: string) => {
    const finalRole = role || "cocoecia-colaborador";
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({ status_aprovacao: "approved" })
        .eq("id", id);
      if (error) throw error;

      if (prestadorId) {
        await supabase.from("usuarios").update({ role: finalRole }).eq("id", prestadorId);
        await supabase.from("profiles").update({ role: finalRole }).eq("id", prestadorId);
      }
      toast.show(`Caminhão "${apelido}" aprovado com sucesso!`);
      fetchCaminhoes();
    } catch (err: any) {
      toast.show(`Erro ao aprovar: ${err.message}`);
    }
  };

  const filteredCaminhoes = caminhoes.filter((c) => {
    const matchesSearch = 
      c.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.apelido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.areas_atendidas?.some((a: string) => a.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === "online") return c.is_online && c.status_aprovacao === "approved";
    if (statusFilter === "pending") return c.status_aprovacao === "pending";
    if (statusFilter === "approved") return c.status_aprovacao === "approved";
    return true;
  });

  return (
    <div style={{ padding: 32 }}>
      {/* Header & Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/admin/coco")}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "var(--admin-card-bg)",
              border: "1px solid var(--admin-border)",
              color: "var(--admin-text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
            title="Voltar ao Painel"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Gestão de Frota & Motoristas
            </h1>
            <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
              Monitore os veículos da Côco & Cia, status em tempo real e cadastre novos operadores.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "#0DB87E",
              color: "white",
              border: "none",
              fontFamily: "Syne",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(13,184,126,0.25)"
            }}
          >
            <Plus size={16} /> Cadastrar Caminhão / Motorista
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20 }}>
        {/* Search */}
        <div style={{ position: "relative", maxWidth: 360, width: "100%" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, apelido ou bairro..."
            style={{
              width: "100%",
              background: "var(--admin-card-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              height: 40,
              padding: "0 14px 0 38px",
              fontFamily: "DM Sans",
              fontSize: 13,
              color: "var(--admin-text)",
              outline: "none"
            }}
          />
          <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
        </div>

        {/* Status Filters */}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "todos", label: "Todos" },
            { id: "online", label: "🟢 Online" },
            { id: "approved", label: "Aprovados" },
            { id: "pending", label: "⏳ Pendentes" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: statusFilter === f.id ? "#0DB87E" : "var(--admin-border)",
                background: statusFilter === f.id ? "rgba(13,184,126,0.12)" : "transparent",
                color: statusFilter === f.id ? "#0DB87E" : "var(--admin-subtle)",
                fontFamily: "DM Sans",
                fontSize: 12,
                fontWeight: statusFilter === f.id ? 700 : 500,
                cursor: "pointer"
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet Table Card */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-subtle)", fontSize: 12, textTransform: "uppercase" }}>
              <th style={{ padding: "16px 20px" }}>Veículo / Motorista</th>
              <th style={{ padding: "16px 20px" }}>Placa</th>
              <th style={{ padding: "16px 20px" }}>Áreas de Atuação</th>
              <th style={{ padding: "16px 20px" }}>Chave PIX</th>
              <th style={{ padding: "16px 20px" }}>Coletas Hoje</th>
              <th style={{ padding: "16px 20px" }}>Status Operacional</th>
              <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--admin-muted)" }}>
                  Carregando veículos da frota...
                </td>
              </tr>
            ) : filteredCaminhoes.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "var(--admin-muted)" }}>
                  Nenhum caminhão encontrado para este filtro.
                </td>
              </tr>
            ) : (
              filteredCaminhoes.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(13,184,126,0.12)", color: "#0DB87E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Truck size={18} />
                      </div>
                      <div>
                        <div style={{ fontFamily: "Syne", fontWeight: 700, color: "var(--admin-text)", fontSize: 14 }}>
                          {c.apelido}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--admin-subtle)" }}>
                          {c.role_solicitada === "cocoecia-dirigentes" ? "💼 Dirigente" : "🚚 Colaborador"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: "16px 20px" }}>
                    <span style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: "4px 8px", borderRadius: 6, fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "var(--admin-text)" }}>
                      {c.plate}
                    </span>
                  </td>

                  <td style={{ padding: "16px 20px", maxWidth: 200 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {c.areas_atendidas && c.areas_atendidas.length > 0 ? (
                        c.areas_atendidas.map((a: string) => (
                          <span key={a} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--admin-border)", padding: "2px 6px", borderRadius: 4, fontSize: 11, color: "var(--admin-subtle)" }}>
                            {a}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "var(--admin-muted)", fontSize: 11 }}>Todas as regiões</span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: "16px 20px", color: "var(--admin-subtle)", fontFamily: "monospace", fontSize: 12 }}>
                    {c.pix_key || <span style={{ color: "var(--admin-muted)" }}>Não cadastrada</span>}
                  </td>

                  <td style={{ padding: "16px 20px", fontWeight: 700, color: "var(--admin-text)" }}>
                    {c.collections_today || 0} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--admin-subtle)" }}>({c.total_collections || 0} total)</span>
                  </td>

                  <td style={{ padding: "16px 20px" }}>
                    {c.status_aprovacao === "pending" ? (
                      <Pill bg="rgba(245,166,35,0.15)" color="#F5A623" size="sm">
                        ⏳ Aprovação Pendente
                      </Pill>
                    ) : (
                      <button
                        onClick={() => handleToggleOnline(c.id, c.is_online, c.apelido)}
                        style={{
                          border: "none",
                          background: c.is_online ? "rgba(13,184,126,0.15)" : "var(--admin-border)",
                          color: c.is_online ? "#0DB87E" : "var(--admin-muted)",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        {c.is_online ? "🟢 Online no Mapa" : "⚪ Offline"}
                      </button>
                    )}
                  </td>

                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      {c.status_aprovacao === "pending" && (
                        <button
                          onClick={() => handleAprovar(c.id, c.prestador_id, c.apelido, c.role_solicitada)}
                          style={{
                            background: "#0DB87E",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          Aprovar
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteCaminhao(c.id, c.apelido)}
                        style={{ background: "transparent", border: "none", color: "#E84040", cursor: "pointer", padding: 6 }}
                        title="Remover Caminhão"
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

      {/* MODAL: CADASTRAR NOVO CAMINHÃO */}
      {isModalOpen && (
        <div style={modalBackdropStyle} onClick={() => setIsModalOpen(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Truck size={20} color="#0DB87E" />
                <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                  Cadastrar Novo Caminhão / Motorista
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCaminhao} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Placa do Veículo *</label>
                <input
                  type="text"
                  required
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="Ex: ABC-1234 ou BRA2E19"
                  style={{ ...inputStyle, textTransform: "uppercase" }}
                />
              </div>

              <div>
                <label style={labelStyle}>Apelido do Veículo / Nome do Motorista *</label>
                <input
                  type="text"
                  required
                  value={apelido}
                  onChange={(e) => setApelido(e.target.value)}
                  placeholder="Ex: Caminhão 01 - Zé do Coco"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Chave PIX do Motorista (opcional)</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Chave para repasse direto de doações"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Função Operacional</label>
                <select
                  value={roleSolicitada}
                  onChange={(e) => setRoleSolicitada(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  <option value="cocoecia-colaborador">🚚 Colaborador / Motorista de Coleta</option>
                  <option value="cocoecia-dirigentes">💼 Dirigente / Coordenador</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Bairros Atendidos (Escala Inicial)</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 130, overflowY: "auto", padding: 4 }}>
                  {BAIRROS_UBATUBA.map((b) => {
                    const sel = selectedBairros.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          if (sel) {
                            setSelectedBairros(selectedBairros.filter((x) => x !== b));
                          } else {
                            setSelectedBairros([...selectedBairros, b]);
                          }
                        }}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid",
                          borderColor: sel ? "#0DB87E" : "var(--admin-border)",
                          background: sel ? "rgba(13,184,126,0.15)" : "var(--admin-bg)",
                          color: sel ? "#0DB87E" : "var(--admin-subtle)",
                          fontSize: 11,
                          cursor: "pointer",
                          textAlign: "left"
                        }}
                      >
                        {sel ? "✓ " : "+ "} {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ ...ghostBtnStyle, flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ ...primaryBtnStyle, flex: 1 }}
                >
                  {submitting ? "Cadastrando..." : "Cadastrar Veículo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  height: 42,
  padding: "0 14px",
  fontFamily: "DM Sans",
  fontSize: 14,
  color: "var(--admin-text)",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontFamily: "DM Sans",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--admin-subtle)",
  marginBottom: 6,
};

const modalBackdropStyle = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16
};

const modalBoxStyle = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 20,
  padding: 24,
  maxWidth: 500,
  width: "100%",
  boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "var(--admin-muted)",
  cursor: "pointer",
  padding: 4
};

const primaryBtnStyle = {
  background: "#0DB87E",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "12px 18px",
  fontFamily: "Syne",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const ghostBtnStyle = {
  background: "transparent",
  color: "var(--admin-subtle)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  padding: "12px 18px",
  fontFamily: "Syne",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
