import { useState, useEffect } from "react";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Truck, 
  MapPin, 
  Phone, 
  X, 
  Search 
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

export interface ColaboradorCoco {
  id: string;
  nome: string;
  veiculo: string;
  bairro_atuacao: string;
  telefone?: string;
  is_ativo: boolean;
  created_at?: string;
}

const BAIRROS_UBATUBA = [
  "Centro",
  "Itaguá",
  "Perequê-Açu",
  "Praia Grande",
  "Tenório",
  "Toninhas",
  "Enseada",
  "Maranduba",
  "Ubatumirim",
  "Estufa I",
  "Estufa II"
];

export default function AdminCocoColaboradores() {
  const toast = useAdminToast();
  const [colaboradores, setColaboradores] = useState<ColaboradorCoco[]>(() => {
    try {
      const stored = localStorage.getItem("coco_colaboradores_local");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColab, setEditingColab] = useState<ColaboradorCoco | null>(null);

  // Form State
  const [nome, setNome] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [bairroAtuacao, setBairroAtuacao] = useState(BAIRROS_UBATUBA[0]);
  const [telefone, setTelefone] = useState("");
  const [isAtivo, setIsAtivo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Carregar dados de fallback / supabase
  useEffect(() => {
    const fetchColaboradores = async () => {
      try {
        const { data, error } = await supabase
          .from("coco_colaboradores")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setColaboradores(data);
          localStorage.setItem("coco_colaboradores_local", JSON.stringify(data));
        }
      } catch {
        // Fallback silencioso para dados locais
      }
    };
    fetchColaboradores();
  }, []);

  const saveLocal = (updated: ColaboradorCoco[]) => {
    setColaboradores(updated);
    try {
      localStorage.setItem("coco_colaboradores_local", JSON.stringify(updated));
    } catch {}
  };

  const handleOpenModal = (colab?: ColaboradorCoco) => {
    if (colab) {
      setEditingColab(colab);
      setNome(colab.nome);
      setVeiculo(colab.veiculo);
      setBairroAtuacao(colab.bairro_atuacao);
      setTelefone(colab.telefone || "");
      setIsAtivo(colab.is_ativo);
    } else {
      setEditingColab(null);
      setNome("");
      setVeiculo("");
      setBairroAtuacao(BAIRROS_UBATUBA[0]);
      setTelefone("");
      setIsAtivo(true);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.show("Informe o nome do colaborador.");
      return;
    }
    if (!veiculo.trim()) {
      toast.show("Informe o veículo do colaborador.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingColab) {
        // Atualizar
        const payload: ColaboradorCoco = {
          ...editingColab,
          nome,
          veiculo,
          bairro_atuacao: bairroAtuacao,
          telefone,
          is_ativo: isAtivo,
        };

        const updated = colaboradores.map((c) => (c.id === editingColab.id ? payload : c));
        saveLocal(updated);

        await supabase
          .from("coco_colaboradores")
          .update({
            nome,
            veiculo,
            bairro_atuacao: bairroAtuacao,
            telefone,
            is_ativo: isAtivo,
          })
          .eq("id", editingColab.id);

        toast.show("Colaborador atualizado com sucesso!");
      } else {
        // Criar novo
        const newColab: ColaboradorCoco = {
          id: `colab-${Date.now()}`,
          nome,
          veiculo,
          bairro_atuacao: bairroAtuacao,
          telefone,
          is_ativo: isAtivo,
          created_at: new Date().toISOString(),
        };

        const updated = [newColab, ...colaboradores];
        saveLocal(updated);

        await supabase
          .from("coco_colaboradores")
          .insert([{
            nome,
            veiculo,
            bairro_atuacao: bairroAtuacao,
            telefone,
            is_ativo: isAtivo,
          }]);

        toast.show("Colaborador cadastrado com sucesso!");
      }

      setIsModalOpen(false);
    } catch (err: any) {
      toast.show(`Salvo localmente. (${err.message || "Offline"})`);
      setIsModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const updated = colaboradores.map((c) => (c.id === id ? { ...c, is_ativo: !currentStatus } : c));
    saveLocal(updated);

    try {
      await supabase
        .from("coco_colaboradores")
        .update({ is_ativo: !currentStatus })
        .eq("id", id);
      toast.show("Status do colaborador alterado!");
    } catch {
      toast.show("Status alterado localmente.");
    }
  };

  const handleDelete = async (id: string, nomeColab: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o colaborador "${nomeColab}"?`)) return;

    const updated = colaboradores.filter((c) => c.id !== id);
    saveLocal(updated);

    try {
      await supabase.from("coco_colaboradores").delete().eq("id", id);
      toast.show("Colaborador removido.");
    } catch {
      toast.show("Colaborador removido localmente.");
    }
  };

  const filtered = colaboradores.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.veiculo.toLowerCase().includes(search.toLowerCase()) ||
    c.bairro_atuacao.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
              <Users size={20} />
            </div>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
              Colaboradores Autorizados para Coleta
            </h1>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
            Gerencie motoristas, catadores credenciados e operadores de veículos autorizados pela Côco & Cia.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
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
          <Plus size={16} /> Cadastrar Novo Colaborador
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <Card style={{ padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Search size={18} color="var(--admin-muted)" />
        <input
          type="text"
          placeholder="Buscar por nome, veículo ou bairro de atuação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "DM Sans",
            fontSize: 14,
            color: "var(--admin-text)"
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ background: "transparent", border: "none", color: "var(--admin-muted)", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        )}
      </Card>

      {/* Tabela de Colaboradores */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-subtle)", fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "16px 20px" }}>Colaborador</th>
                <th style={{ padding: "16px 20px" }}>Veículo Vinculado</th>
                <th style={{ padding: "16px 20px" }}>Bairro de Atuação</th>
                <th style={{ padding: "16px 20px" }}>Telefone</th>
                <th style={{ padding: "16px 20px" }}>Status</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 20px", textAlign: "center", color: "var(--admin-muted)" }}>
                    {search ? "Nenhum colaborador encontrado para essa busca." : "Nenhum colaborador cadastrado ainda."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.is_ativo ? "rgba(13,184,126,0.15)" : "var(--admin-border)", display: "flex", alignItems: "center", justifyContent: "center", color: c.is_ativo ? "#0DB87E" : "var(--admin-muted)", fontWeight: 700, fontSize: 14 }}>
                          {c.nome.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--admin-text)" }}>{c.nome}</div>
                          <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>ID: {c.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                        <Truck size={15} color="var(--admin-muted)" /> {c.veiculo}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <MapPin size={14} color="#0DB87E" /> {c.bairro_atuacao}
                      </span>
                    </td>
                    <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                      {c.telefone ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Phone size={13} color="var(--admin-muted)" /> {c.telefone}
                        </span>
                      ) : (
                        <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>Não informado</span>
                      )}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      <button
                        onClick={() => handleToggleStatus(c.id, c.is_ativo)}
                        style={{
                          border: "none",
                          background: c.is_ativo ? "rgba(13,184,126,0.15)" : "var(--admin-border)",
                          color: c.is_ativo ? "#0DB87E" : "var(--admin-muted)",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "opacity 150ms"
                        }}
                      >
                        {c.is_ativo ? "🟢 Ativo" : "⚪ Inativo"}
                      </button>
                    </td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button
                          onClick={() => handleOpenModal(c)}
                          style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 6 }}
                          title="Editar Colaborador"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.nome)}
                          style={{ background: "transparent", border: "none", color: "#E84040", cursor: "pointer", padding: 6 }}
                          title="Remover Colaborador"
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
        </div>
      </Card>

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: 16, width: "100%", maxWidth: 480, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                {editingColab ? "Editar Colaborador" : "Novo Colaborador Autorizado"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Santos"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Veículo Utilizado *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Caminhão Coletor 01 / Triciclo / Carrinho"
                  value={veiculo}
                  onChange={(e) => setVeiculo(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Bairro Principal de Atuação
                </label>
                <select
                  value={bairroAtuacao}
                  onChange={(e) => setBairroAtuacao(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                >
                  {BAIRROS_UBATUBA.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="Todas as Regiões">Todas as Regiões (Geral)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Telefone / WhatsApp (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: (12) 99888-7766"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="is_ativo"
                  checked={isAtivo}
                  onChange={(e) => setIsAtivo(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#0DB87E", cursor: "pointer" }}
                />
                <label htmlFor="is_ativo" style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", cursor: "pointer" }}>
                  Colaborador Autorizado e Ativo para Coletas
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                <GhostButton type="button" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </GhostButton>
                <PrimaryButton type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : (editingColab ? "Salvar Alterações" : "Cadastrar Colaborador")}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
