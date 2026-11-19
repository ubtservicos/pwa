import { useState, useEffect, useMemo } from "react";
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
  Clock,
  UserCheck,
  UserX,
  Shield,
  Link2,
  Mail,
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export type ColaboradorPerfil = "colaborador_administrativo" | "alta_gestao";
export type ColaboradorStatusAprovacao = "pendente" | "aprovado" | "rejeitado";

export interface ColaboradorCoco {
  id: string;
  nome: string;
  telefone?: string | null;
  status?: string | null;
  is_ativo: boolean;
  user_id?: string | null;
  perfil: ColaboradorPerfil;
  status_aprovacao: ColaboradorStatusAprovacao;
  aprovado_em?: string | null;
  created_at?: string;
}

interface UbtAccountOption {
  id: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  role?: string | null;
}

/**
 * Máscara de Telefone / WhatsApp aplicada via REGEX.
 * Remove qualquer caractere não numérico (letras/símbolos), limita a 11 dígitos
 * e formata como (XX) XXXX-XXXX (10 dígitos) ou (XX) XXXXX-XXXX (11 dígitos).
 */
export const PHONE_REGEX = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;

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

const SELECT_COLS =
  "id, nome, telefone, status, is_ativo, user_id, perfil, status_aprovacao, aprovado_em, created_at";

export default function AdminCocoColaboradores() {
  const toast = useAdminToast();
  const navigate = useNavigate();

  const [colaboradores, setColaboradores] = useState<ColaboradorCoco[]>([]);
  const [ubtAccounts, setUbtAccounts] = useState<UbtAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "aprovado" | "pendente" | "rejeitado">("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColab, setEditingColab] = useState<ColaboradorCoco | null>(null);

  // Form State
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState<ColaboradorPerfil>("colaborador_administrativo");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [initialApproval, setInitialApproval] = useState<"aprovado" | "pendente">("aprovado");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const ubtAccountsMap = useMemo(() => {
    const map: Record<string, UbtAccountOption> = {};
    ubtAccounts.forEach((acc) => {
      map[acc.id] = acc;
    });
    return map;
  }, [ubtAccounts]);

  const filteredUbtAccounts = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return ubtAccounts.slice(0, 30);
    return ubtAccounts
      .filter(
        (u) =>
          (u.nome || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.telefone || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [ubtAccounts, userSearch]);

  const normalizeRow = (row: any): ColaboradorCoco => ({
    id: row.id,
    nome: row.nome || "",
    telefone: row.telefone || "",
    status: row.status || "Ativo",
    is_ativo:
      typeof row.is_ativo === "boolean"
        ? row.is_ativo
        : String(row.status || "Ativo").toLowerCase() !== "inativo",
    user_id: row.user_id || null,
    perfil: row.perfil === "alta_gestao" ? "alta_gestao" : "colaborador_administrativo",
    status_aprovacao:
      row.status_aprovacao === "pendente" || row.status_aprovacao === "rejeitado"
        ? row.status_aprovacao
        : "aprovado",
    aprovado_em: row.aprovado_em || null,
    created_at: row.created_at,
  });

  const fetchColaboradores = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("coco_colaboradores")
        .select(SELECT_COLS)
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

  const fetchUbtAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome, email, telefone, role")
        .order("nome", { ascending: true })
        .limit(300);

      if (!error && data) {
        setUbtAccounts(data as UbtAccountOption[]);
      }
    } catch (err) {
      console.warn("[AdminCocoColaboradores] Erro ao carregar contas UBT:", err);
    }
  };

  useEffect(() => {
    fetchColaboradores();
    fetchUbtAccounts();
  }, []);

  const handleOpenModal = (colab?: ColaboradorCoco) => {
    setFormError(null);
    setUserSearch("");
    if (colab) {
      setEditingColab(colab);
      setNome(colab.nome);
      setTelefone(colab.telefone ? formatPhoneRegexMask(colab.telefone) : "");
      setPerfil(colab.perfil || "colaborador_administrativo");
      setSelectedUserId(colab.user_id || "");
      setInitialApproval(colab.status_aprovacao === "pendente" ? "pendente" : "aprovado");
    } else {
      setEditingColab(null);
      setNome("");
      setTelefone("");
      setPerfil("colaborador_administrativo");
      setSelectedUserId("");
      setInitialApproval("aprovado");
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
      const linkedUserId = selectedUserId.trim() || null;

      if (editingColab) {
        const { data, error } = await supabase
          .from("coco_colaboradores")
          .update({
            nome: cleanNome,
            telefone: formattedTelefone,
            perfil,
            user_id: linkedUserId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingColab.id)
          .select(SELECT_COLS)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error("Nenhuma alteração aplicada. Verifique suas permissões.");
        }

        // Se está aprovado e tem conta UBT vinculada, sincroniza role via RPC
        if (data.status_aprovacao === "aprovado" && linkedUserId) {
          const { error: rpcError } = await supabase.rpc("gerenciar_vinculo_colaborador_coco", {
            p_colaborador_id: editingColab.id,
            p_acao: "alterar_perfil",
            p_perfil: perfil,
          });
          if (rpcError) {
            console.warn("[AdminCocoColaboradores] Aviso ao sincronizar perfil RBAC:", rpcError);
          }
        }

        const updatedRow = normalizeRow(data);
        setColaboradores((prev) =>
          prev.map((c) => (c.id === editingColab.id ? updatedRow : c))
        );
        toast.show("Colaborador atualizado com sucesso!");
      } else {
        const isApproved = initialApproval === "aprovado";
        const { data, error } = await supabase
          .from("coco_colaboradores")
          .insert([
            {
              nome: cleanNome,
              telefone: formattedTelefone,
              perfil,
              user_id: linkedUserId,
              status_aprovacao: initialApproval,
              status: isApproved ? "Ativo" : "Pendente",
              is_ativo: isApproved,
            },
          ])
          .select(SELECT_COLS)
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error("Não foi possível confirmar o cadastro do colaborador.");
        }

        if (isApproved && linkedUserId) {
          const { error: rpcError } = await supabase.rpc("gerenciar_vinculo_colaborador_coco", {
            p_colaborador_id: data.id,
            p_acao: "aprovar",
            p_perfil: perfil,
          });
          if (rpcError) {
            console.warn("[AdminCocoColaboradores] Aviso ao sincronizar RBAC na criação:", rpcError);
          }
        }

        setColaboradores((prev) => [normalizeRow(data), ...prev]);
        toast.show(
          isApproved
            ? "Colaborador cadastrado e aprovado com sucesso!"
            : "Requerimento registrado como pendente de aprovação!"
        );
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

  const handleAprovarRequerimento = async (colab: ColaboradorCoco) => {
    if (processingId) return;
    setProcessingId(colab.id);
    try {
      const { error } = await supabase.rpc("gerenciar_vinculo_colaborador_coco", {
        p_colaborador_id: colab.id,
        p_acao: "aprovar",
        p_perfil: colab.perfil,
      });
      if (error) throw error;

      setColaboradores((prev) =>
        prev.map((c) =>
          c.id === colab.id
            ? {
                ...c,
                status_aprovacao: "aprovado",
                is_ativo: true,
                status: "Ativo",
                aprovado_em: new Date().toISOString(),
              }
            : c
        )
      );
      toast.show(`Requerimento de "${colab.nome}" aprovado com sucesso!`);
    } catch (err: any) {
      toast.show(`Erro ao aprovar requerimento: ${err?.message || "Tente novamente."}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejeitarRequerimento = async (colab: ColaboradorCoco) => {
    if (processingId) return;
    if (!window.confirm(`Tem certeza que deseja rejeitar o requerimento de "${colab.nome}"?`)) return;

    setProcessingId(colab.id);
    try {
      const { error } = await supabase.rpc("gerenciar_vinculo_colaborador_coco", {
        p_colaborador_id: colab.id,
        p_acao: "rejeitar",
        p_perfil: colab.perfil,
      });
      if (error) throw error;

      setColaboradores((prev) =>
        prev.map((c) =>
          c.id === colab.id
            ? { ...c, status_aprovacao: "rejeitado", is_ativo: false, status: "Inativo" }
            : c
        )
      );
      toast.show(`Requerimento de "${colab.nome}" rejeitado.`);
    } catch (err: any) {
      toast.show(`Erro ao rejeitar requerimento: ${err?.message || "Tente novamente."}`);
    } finally {
      setProcessingId(null);
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

  const pendingRequests = useMemo(
    () => colaboradores.filter((c) => c.status_aprovacao === "pendente"),
    [colaboradores]
  );

  const filtered = colaboradores.filter((c) => {
    if (statusFilter !== "todos" && c.status_aprovacao !== statusFilter) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const cleanQ = q.replace(/\D/g, "");
    const ubtAcc = c.user_id ? ubtAccountsMap[c.user_id] : null;
    const matchName = c.nome.toLowerCase().includes(q);
    const matchPhone =
      (c.telefone || "").toLowerCase().includes(q) ||
      (cleanQ.length > 0 && (c.telefone || "").replace(/\D/g, "").includes(cleanQ));
    const matchPerfil =
      (c.perfil === "alta_gestao" ? "alta gestao" : "colaborador administrativo").includes(q);
    const matchEmail = (ubtAcc?.email || "").toLowerCase().includes(q);
    return matchName || matchPhone || matchPerfil || matchEmail;
  });

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 20px" }}>
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
              Colaboradores & Aprovações — Côco & Cia
            </h1>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
            Gerencie a equipe credenciada, aprove requerimentos de contas UBT e defina perfis de acesso.
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
            <Truck size={16} /> Gestão de Frota
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

      {/* BLOCO DESTACADO: REQUERIMENTOS PENDENTES DE APROVAÇÃO */}
      {pendingRequests.length > 0 && (
        <div
          style={{
            marginBottom: 24,
            background: "rgba(245,166,35,0.08)",
            border: "1px solid rgba(245,166,35,0.32)",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(245,166,35,0.2)",
                color: "#F5A623",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                Requerimentos Pendentes de Aprovação ({pendingRequests.length})
              </h3>
              <span style={{ fontSize: 12, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
                Solicitações de vínculo à Côco & Cia aguardando validação. Ao aprovar, o acesso ao menu é liberado conforme o perfil.
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
            {pendingRequests.map((req) => {
              const ubtAcc = req.user_id ? ubtAccountsMap[req.user_id] : null;
              const isBusy = processingId === req.id;

              return (
                <Card
                  key={req.id}
                  style={{
                    padding: 16,
                    background: "var(--admin-surface)",
                    border: "1px solid var(--admin-border)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <strong style={{ fontFamily: "Syne", fontSize: 15, color: "var(--admin-text)" }}>
                        {req.nome}
                      </strong>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background:
                            req.perfil === "alta_gestao"
                              ? "rgba(139,92,246,0.16)"
                              : "rgba(13,184,126,0.14)",
                          color: req.perfil === "alta_gestao" ? "#A78BFA" : "#0DB87E",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {req.perfil === "alta_gestao" ? "Alta Gestão" : "Colab. Administrativo"}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: "var(--admin-bg)",
                        fontSize: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        color: "var(--admin-subtle)",
                      }}
                    >
                      {req.telefone && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace" }}>
                          <Phone size={12} color="#0DB87E" /> {formatPhoneRegexMask(req.telefone) || req.telefone}
                        </div>
                      )}
                      {ubtAcc?.email ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Mail size={12} color="#F5A623" /> Conta UBT: {ubtAcc.email}
                        </div>
                      ) : req.user_id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace" }}>
                          <Link2 size={12} color="#F5A623" /> Conta UBT: {req.user_id.slice(0, 8)}...
                        </div>
                      ) : (
                        <div style={{ color: "var(--admin-muted)" }}>Sem conta UBT vinculada</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAprovarRequerimento(req)}
                      style={{
                        flex: 1,
                        background: "#0DB87E",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontFamily: "Syne",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isBusy ? "wait" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <UserCheck size={14} /> Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleRejeitarRequerimento(req)}
                      style={{
                        flex: 1,
                        background: "rgba(232,64,64,0.12)",
                        color: "#E84040",
                        border: "1px solid rgba(232,64,64,0.3)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontFamily: "Syne",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isBusy ? "wait" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <UserX size={14} /> Rejeitar
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de Busca e Filtros de Aprovação */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <Card style={{ padding: "10px 16px", flex: 1, minWidth: 260, display: "flex", alignItems: "center", gap: 10 }}>
          <Search size={17} color="var(--admin-muted)" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, perfil ou e-mail UBT..."
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

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "todos", label: "Todos" },
            { id: "aprovado", label: "Aprovados" },
            { id: "pendente", label: `Pendentes (${pendingRequests.length})` },
            { id: "rejeitado", label: "Rejeitados" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: statusFilter === f.id ? "#0DB87E" : "var(--admin-border)",
                background: statusFilter === f.id ? "rgba(13,184,126,0.12)" : "transparent",
                color: statusFilter === f.id ? "#0DB87E" : "var(--admin-subtle)",
                fontFamily: "DM Sans",
                fontSize: 12,
                fontWeight: statusFilter === f.id ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Colaboradores */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-subtle)", fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "16px 20px" }}>Colaborador</th>
                <th style={{ padding: "16px 20px" }}>Telefone / WhatsApp</th>
                <th style={{ padding: "16px 20px" }}>Perfil</th>
                <th style={{ padding: "16px 20px" }}>Vínculo / Aprovação</th>
                <th style={{ padding: "16px 20px" }}>Status</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 20px", textAlign: "center", color: "var(--admin-muted)" }}>
                    Carregando colaboradores...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "48px 20px", textAlign: "center", color: "var(--admin-muted)" }}>
                    {search || statusFilter !== "todos"
                      ? "Nenhum colaborador encontrado para este filtro."
                      : "Nenhum colaborador cadastrado ainda."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isDeleting = deletingId === c.id;
                  const isToggling = togglingId === c.id;
                  const isBusy = processingId === c.id;
                  const ubtAcc = c.user_id ? ubtAccountsMap[c.user_id] : null;
                  const isAltaGestao = c.perfil === "alta_gestao";

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

                      <td style={{ padding: "16px 20px", color: "var(--admin-subtle)", whiteSpace: "nowrap" }}>
                        {c.telefone ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 13 }}>
                            <Phone size={13} color="#0DB87E" /> {formatPhoneRegexMask(c.telefone) || c.telefone}
                          </span>
                        ) : (
                          <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>Não informado</span>
                        )}
                      </td>

                      {/* Coluna Perfil */}
                      <td style={{ padding: "16px 20px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: isAltaGestao
                              ? "rgba(139,92,246,0.16)"
                              : "rgba(59,130,246,0.14)",
                            color: isAltaGestao ? "#A78BFA" : "#60A5FA",
                          }}
                        >
                          <Shield size={12} />
                          {isAltaGestao ? "Alta Gestão" : "Colaborador Administrativo"}
                        </span>
                      </td>

                      {/* Coluna Vínculo / Aprovação */}
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              width: "fit-content",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                c.status_aprovacao === "aprovado"
                                  ? "rgba(13,184,126,0.14)"
                                  : c.status_aprovacao === "pendente"
                                    ? "rgba(245,166,35,0.16)"
                                    : "rgba(232,64,64,0.15)",
                              color:
                                c.status_aprovacao === "aprovado"
                                  ? "#0DB87E"
                                  : c.status_aprovacao === "pendente"
                                    ? "#F5A623"
                                    : "#E84040",
                            }}
                          >
                            {c.status_aprovacao === "aprovado"
                              ? "Aprovado"
                              : c.status_aprovacao === "pendente"
                                ? "Pendente"
                                : "Rejeitado"}
                          </span>

                          {c.user_id ? (
                            <span style={{ fontSize: 11, color: "var(--admin-subtle)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Link2 size={11} color="#0DB87E" />
                              {ubtAcc?.email || `Conta UBT (${c.user_id.slice(0, 6)})`}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                              Sem conta UBT vinculada
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Ativo/Inativo */}
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

                      {/* Ações */}
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {c.status_aprovacao === "pendente" && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAprovarRequerimento(c)}
                                style={{
                                  background: "#0DB87E",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                title="Aprovar Requerimento"
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleRejeitarRequerimento(c)}
                                style={{
                                  background: "rgba(232,64,64,0.14)",
                                  color: "#E84040",
                                  border: "1px solid rgba(232,64,64,0.3)",
                                  borderRadius: 6,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                                title="Rejeitar Requerimento"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenModal(c)}
                            style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 6 }}
                            title="Editar Colaborador e Perfil"
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

      {/* Modal de Cadastro / Edição (Nome, Telefone REGEX, Perfil e Vínculo com Conta UBT) */}
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
              maxWidth: 520,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                {editingColab ? "Editar Colaborador & Perfil" : "Novo Colaborador"}
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

              {/* Campo Perfil (Editável na criação e na edição) */}
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
                  Perfil de Acesso *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPerfil("colaborador_administrativo")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid",
                      borderColor:
                        perfil === "colaborador_administrativo" ? "#60A5FA" : "var(--admin-border)",
                      background:
                        perfil === "colaborador_administrativo"
                          ? "rgba(59,130,246,0.14)"
                          : "var(--admin-bg)",
                      color:
                        perfil === "colaborador_administrativo" ? "#60A5FA" : "var(--admin-subtle)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Colaborador Administrativo</div>
                    <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
                      Mapa, Agenda, Manuais, Colaboradores e Frota
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPerfil("alta_gestao")}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid",
                      borderColor: perfil === "alta_gestao" ? "#A78BFA" : "var(--admin-border)",
                      background:
                        perfil === "alta_gestao" ? "rgba(139,92,246,0.16)" : "var(--admin-bg)",
                      color: perfil === "alta_gestao" ? "#A78BFA" : "var(--admin-subtle)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Alta Gestão</div>
                    <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>
                      Visão completa (inclui Dashboard, Captação e Config.)
                    </div>
                  </button>
                </div>
              </div>

              {/* Vínculo opcional com Conta UBT */}
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
                  Conta UBT Vinculada (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Filtrar conta UBT por nome ou e-mail..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "var(--admin-text)",
                    fontFamily: "DM Sans",
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                />
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--admin-bg)",
                    border: "1px solid var(--admin-border)",
                    borderRadius: 8,
                    padding: "9px 12px",
                    color: "var(--admin-text)",
                    fontFamily: "DM Sans",
                    fontSize: 13,
                  }}
                >
                  <option value="">Sem conta UBT vinculada</option>
                  {selectedUserId && !filteredUbtAccounts.some((u) => u.id === selectedUserId) && (
                    <option value={selectedUserId}>
                      {ubtAccountsMap[selectedUserId]?.nome || ubtAccountsMap[selectedUserId]?.email || selectedUserId}
                    </option>
                  )}
                  {filteredUbtAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {(acc.nome || "Sem nome")} — {acc.email || acc.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 4, display: "block" }}>
                  Ao vincular uma conta UBT e aprovar, o acesso ao menu Côco & Cia é sincronizado automaticamente.
                </span>
              </div>

              {!editingColab && (
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
                    Fluxo de Aprovação
                  </label>
                  <select
                    value={initialApproval}
                    onChange={(e) => setInitialApproval(e.target.value as "aprovado" | "pendente")}
                    style={{
                      width: "100%",
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 8,
                      padding: "9px 12px",
                      color: "var(--admin-text)",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                    }}
                  >
                    <option value="aprovado">Aprovar imediatamente</option>
                    <option value="pendente">Registrar como Requerimento Pendente</option>
                  </select>
                </div>
              )}

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
