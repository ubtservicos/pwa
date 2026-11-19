import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit3,
  Truck,
  Phone,
  X,
  Search,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export interface ColaboradorCoco {
  id: string;
  nome: string;
  telefone?: string | null;
  status?: string | null;
  is_ativo: boolean;
  created_at?: string;
}

/**
 * Máscara de Telefone / WhatsApp aplicada via REGEX.
 * Remove qualquer caractere não numérico (letras/símbolos), limita a 11 dígitos
 * e formata como (XX) XXXX-XXXX (10 dígitos) ou (XX) XXXXX-XXXX (11 dígitos).
 */
const PHONE_REGEX = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;

export function formatPhoneRegexMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) {
    return digits.length > 0 ? `(${digits}` : "";
  }
  if (digits.length <= 6) {
    return digits.replace(/^(\d{2})(\d{0,4})$/, "($1) $2");
  }
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
  }
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3");
}

export default function AdminCocoColaboradores() {
  const toast = useAdminToast();
  const navigate = useNavigate();

  const [colaboradores, setColaboradores] = useState<ColaboradorCoco[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColab, setEditingColab] = useState<ColaboradorCoco | null>(null);

  // Form State (Simplificado: apenas Nome e Telefone / WhatsApp)
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const normalizeRow = (row: any): ColaboradorCoco => ({
    id: row.id,
    nome: row.nome || "",
    telefone: row.telefone || "",
    status: row.status || "Ativo",
    is_ativo:
      typeof row.is_ativo === "boolean"
        ? row.is_ativo
        : String(row.status || "Ativo").toLowerCase() !== "inativo",
    created_at: row.created_at,
  });

  const fetchColaboradores = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("coco_colaboradores")
        .select("id, nome, telefone, status, is_ativo, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setColaboradores((data || []).map(normalizeRow));
    } catch (err: any) {
      const msg = err?.message || "Erro ao carregar colaboradores.";
      console.error("[AdminCocoColaboradores] Erro ao buscar:", err);
      setLoadError(msg);
      toast.show(`Erro ao carregar colaboradores: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColaboradores();
  }, []);

  const handleOpenModal = (colab?: ColaboradorCoco) => {
    setFormError(null);
    if (colab) {
      setEditingColab(colab);
      setNome(colab.nome);
      setTelefone(colab.telefone ? formatPhoneRegexMask(colab.telefone) : "");
    } else {
      setEditingColab(null);
      setNome("");
      setTelefone("");
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNome = nome.trim();
    const formattedTelefone = formatPhoneRegexMask(telefone);

    if (!cleanNome) {
      setFormError("Informe o nome completo do colaborador.");
      return;
    }

    if (!PHONE_REGEX.test(formattedTelefone)) {
      setFormError("Informe um Telefone / WhatsApp válido no formato (XX) XXXXX-XXXX.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingColab) {
        const { data, error } = await supabase
          .from("coco_colaboradores")
          .update({
            nome: cleanNome,
            telefone: formattedTelefone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingColab.id)
          .select("id, nome, telefone, status, is_ativo, created_at")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error("Nenhuma alteração aplicada. Verifique suas permissões.");
        }

        const updatedRow = normalizeRow(data);
        setColaboradores((prev) =>
          prev.map((c) => (c.id === editingColab.id ? updatedRow : c))
        );
        toast.show("Colaborador atualizado com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("coco_colaboradores")
          .insert([
            {
              nome: cleanNome,
              telefone: formattedTelefone,
              status: "Ativo",
              is_ativo: true,
            },
          ])
          .select("id, nome, telefone, status, is_ativo, created_at")
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error("Não foi possível confirmar o cadastro do colaborador.");
        }

        setColaboradores((prev) => [normalizeRow(data), ...prev]);
        toast.show("Colaborador cadastrado com sucesso!");
      }

      setIsModalOpen(false);
    } catch (err: any) {
      const msg = err?.message || "Erro ao salvar colaborador.";
      console.error("[AdminCocoColaboradores] Erro ao salvar:", err);
      setFormError(msg);
      toast.show(`Erro ao salvar: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (togglingId) return;
    const nextStatus = !currentStatus;
    setTogglingId(id);
    setColaboradores((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, is_ativo: nextStatus, status: nextStatus ? "Ativo" : "Inativo" }
          : c
      )
    );

    try {
      const { data, error } = await supabase
        .from("coco_colaboradores")
        .update({
          is_ativo: nextStatus,
          status: nextStatus ? "Ativo" : "Inativo",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id, is_ativo, status")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Sem permissão ou colaborador não encontrado.");
      toast.show(`Colaborador ${nextStatus ? "ativado" : "desativado"} com sucesso!`);
    } catch (err: any) {
      setColaboradores((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, is_ativo: currentStatus, status: currentStatus ? "Ativo" : "Inativo" }
            : c
        )
      );
      toast.show(`Erro ao alterar status: ${err?.message || "Tente novamente."}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string, nomeColab: string) => {
    if (deletingId) return;
    if (!window.confirm(`Tem certeza que deseja remover o colaborador "${nomeColab}"?`)) return;

    setDeletingId(id);
    try {
      const { data, error } = await supabase
        .from("coco_colaboradores")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nenhuma linha removida. Verifique suas permissões.");
      }

      setColaboradores((prev) => prev.filter((c) => c.id !== id));
      toast.show("Colaborador removido com sucesso!");
    } catch (err: any) {
      toast.show(`Erro ao remover colaborador: ${err?.message || "Tente novamente."}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = colaboradores.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const cleanQ = q.replace(/\D/g, "");
    const matchName = c.nome.toLowerCase().includes(q);
    const matchPhone =
      (c.telefone || "").toLowerCase().includes(q) ||
      (cleanQ.length > 0 && (c.telefone || "").replace(/\D/g, "").includes(cleanQ));
    return matchName || matchPhone;
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(13,184,126,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0DB87E",
              }}
            >
              <Users size={20} />
            </div>
            <h1
              style={{
                fontFamily: "Syne",
                fontSize: 24,
                fontWeight: 700,
                margin: 0,
                color: "var(--admin-text)",
              }}
            >
              Colaboradores Autorizados para Coleta
            </h1>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
            Cadastre e gerencie a equipe de colaboradores credenciados pela Côco & Cia.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={fetchColaboradores}
            disabled={loading}
            title="Atualizar listagem"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--admin-bg)",
              color: "var(--admin-text)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "10px 14px",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 13,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => navigate("/admin/coco/frota")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              color: "var(--admin-subtle)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "10px 16px",
              fontFamily: "Syne",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <Truck size={16} /> Gestão de Frota & Aprovações
          </button>

          <button
            type="button"
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
              boxShadow: "0 4px 12px rgba(13,184,126,0.3)",
            }}
          >
            <Plus size={16} /> Cadastrar Novo Colaborador
          </button>
        </div>
      </div>

      {loadError && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 12,
            background: "rgba(232, 64, 64, 0.1)",
            border: "1px solid rgba(232, 64, 64, 0.35)",
            color: "#E84040",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "DM Sans",
            fontSize: 13,
          }}
        >
          <AlertCircle size={16} />
          <span>{loadError}</span>
        </div>
      )}

      {/* Barra de Busca */}
      <Card style={{ padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Search size={18} color="var(--admin-muted)" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone/WhatsApp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: "DM Sans",
            fontSize: 14,
            color: "var(--admin-text)",
          }}
        />
        {search && (
          <button
            type="button"
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
                <th style={{ padding: "16px 20px" }}>Telefone / WhatsApp</th>
                <th style={{ padding: "16px 20px" }}>Status</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: "48px 20px", textAlign: "center", color: "var(--admin-muted)" }}>
                    Carregando colaboradores...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "48px 20px", textAlign: "center", color: "var(--admin-muted)" }}>
                    {search ? "Nenhum colaborador encontrado para essa busca." : "Nenhum colaborador cadastrado ainda."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isDeleting = deletingId === c.id;
                  const isToggling = togglingId === c.id;

                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: c.is_ativo ? "rgba(13,184,126,0.15)" : "var(--admin-border)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: c.is_ativo ? "#0DB87E" : "var(--admin-muted)",
                              fontWeight: 700,
                              fontSize: 14,
                              flexShrink: 0,
                            }}
                          >
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--admin-text)" }}>{c.nome}</div>
                            <div style={{ fontSize: 11, color: "var(--admin-muted)", fontFamily: "monospace" }}>
                              ID: {c.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--admin-subtle)" }}>
                        {c.telefone ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 13 }}>
                            <Phone size={13} color="#0DB87E" /> {formatPhoneRegexMask(c.telefone) || c.telefone}
                          </span>
                        ) : (
                          <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>Não informado</span>
                        )}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleStatus(c.id, c.is_ativo)}
                          style={{
                            border: "none",
                            background: c.is_ativo ? "rgba(13,184,126,0.15)" : "var(--admin-border)",
                            color: c.is_ativo ? "#0DB87E" : "var(--admin-muted)",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: isToggling ? "wait" : "pointer",
                            opacity: isToggling ? 0.6 : 1,
                            transition: "opacity 150ms",
                          }}
                        >
                          {c.is_ativo ? "🟢 Ativo" : "⚪ Inativo"}
                        </button>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(c)}
                            style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 6 }}
                            title="Editar Colaborador"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDelete(c.id, c.nome)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#E84040",
                              cursor: isDeleting ? "wait" : "pointer",
                              padding: 6,
                              opacity: isDeleting ? 0.5 : 1,
                            }}
                            title="Remover Colaborador"
                          >
                            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Cadastro / Edição Simplificado (Apenas Nome e Telefone/WhatsApp com Máscara REGEX) */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--admin-surface)",
              border: "1px solid var(--admin-border)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 460,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                {editingColab ? "Editar Colaborador" : "Novo Colaborador"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(232, 64, 64, 0.1)",
                  border: "1px solid rgba(232, 64, 64, 0.35)",
                  color: "#E84040",
                  fontSize: 12,
                  fontFamily: "DM Sans",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={14} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--admin-subtle)",
                    marginBottom: 6,
                  }}
                >
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Santos"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    setFormError(null);
                  }}
                  style={{
                    width: "100%",
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "var(--admin-text)",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--admin-subtle)",
                    marginBottom: 6,
                  }}
                >
                  Telefone / WhatsApp *
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  required
                  maxLength={15}
                  placeholder="(12) 99888-7766"
                  value={telefone}
                  onChange={(e) => {
                    setTelefone(formatPhoneRegexMask(e.target.value));
                    setFormError(null);
                  }}
                  style={{
                    width: "100%",
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "var(--admin-text)",
                    fontFamily: "monospace",
                    fontSize: 14,
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 4, display: "block" }}>
                  Apenas números com DDD — formatado automaticamente como (XX) XXXXX-XXXX.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
                <GhostButton type="button" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </GhostButton>
                <PrimaryButton type="submit" disabled={submitting}>
                  {submitting ? "Salvando..." : editingColab ? "Salvar Alterações" : "Cadastrar Colaborador"}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
