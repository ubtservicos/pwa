import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckSquare,
  Copy,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Square,
  Lock,
  UserCheck,
  X,
} from "lucide-react";
import { Card, PageTitle, Pill, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";

interface RoleItem {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

interface PermissionItem {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  categoria: string;
}

export default function AdminPermissoesPage() {
  const toast = useAdminToast();
  const { refresh: refreshMyPerms } = usePermissions();

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [rolePermIds, setRolePermIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters & Search
  const [permSearch, setPermSearch] = useState("");
  const [newRoleModalOpen, setNewRoleModalOpen] = useState(false);
  const [newRoleNome, setNewRoleNome] = useState("");
  const [newRoleCodigo, setNewRoleCodigo] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const loadRbacData = useCallback(async () => {
    try {
      setLoading(true);
      const [rRes, pRes] = await Promise.all([
        supabase.from("roles").select("*").order("nome"),
        supabase.from("permissions").select("*").order("categoria"),
      ]);

      if (rRes.error) throw rRes.error;
      if (pRes.error) throw pRes.error;

      setRoles(rRes.data || []);
      setPermissions(pRes.data || []);

      if (rRes.data && rRes.data.length > 0 && !selectedRole) {
        setSelectedRole(rRes.data[0]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar matriz RBAC:", err);
      toast.show("Erro ao carregar permissões e perfis.");
    } finally {
      setLoading(false);
    }
  }, [selectedRole, toast]);

  const loadRolePermissions = useCallback(async (roleId: string) => {
    try {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", roleId);

      if (error) throw error;
      const permSet = new Set((data || []).map((rp) => rp.permission_id));
      setRolePermIds(permSet);
    } catch (err) {
      console.error("Erro ao buscar permissões da role:", err);
    }
  }, []);

  useEffect(() => {
    loadRbacData();
  }, [loadRbacData]);

  useEffect(() => {
    if (selectedRole) {
      loadRolePermissions(selectedRole.id);
    }
  }, [selectedRole, loadRolePermissions]);

  const handleTogglePermission = (permId: string) => {
    if (selectedRole?.codigo === "super_admin") {
      toast.show("O perfil Super Admin possui todas as permissões permanentemente.");
      return;
    }
    setRolePermIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const idsArray = Array.from(rolePermIds);
      const { error } = await supabase.rpc("manage_role_permissions", {
        p_role_id: selectedRole.id,
        p_permission_ids: idsArray,
      });

      if (error) throw error;

      toast.show(`Permissões do perfil "${selectedRole.nome}" salvas com sucesso! ✓`);
      refreshMyPerms();
    } catch (err: any) {
      console.error("Erro ao salvar permissões:", err);
      toast.show("Erro ao atualizar matriz de permissões.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleNome.trim() || !newRoleCodigo.trim()) return;
    try {
      const cleanCode = newRoleCodigo.trim().toLowerCase().replace(/\s+/g, "_");
      const { data, error } = await supabase
        .from("roles")
        .insert({
          nome: newRoleNome.trim(),
          codigo: cleanCode,
          descricao: newRoleDesc.trim(),
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.show(`Novo perfil "${newRoleNome}" criado com sucesso!`);
      setNewRoleModalOpen(false);
      setNewRoleNome("");
      setNewRoleCodigo("");
      setNewRoleDesc("");
      loadRbacData();
      if (data) setSelectedRole(data);
    } catch (err: any) {
      console.error("Erro ao criar perfil:", err);
      toast.show("Erro ao cadastrar novo perfil RBAC.");
    }
  };

  const handleDuplicateRole = async (role: RoleItem) => {
    const dupNome = `${role.nome} (Cópia)`;
    const dupCode = `${role.codigo}_copia_${Date.now().toString().slice(-4)}`;
    try {
      const { data: newRole, error } = await supabase
        .from("roles")
        .insert({
          nome: dupNome,
          codigo: dupCode,
          descricao: `Cópia do perfil ${role.nome}`,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Copy permissions
      const { data: existingPerms } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", role.id);

      if (existingPerms && existingPerms.length > 0 && newRole) {
        await supabase.rpc("manage_role_permissions", {
          p_role_id: newRole.id,
          p_permission_ids: existingPerms.map((p) => p.permission_id),
        });
      }

      toast.show(`Perfil duplicado com sucesso: "${dupNome}"`);
      loadRbacData();
    } catch (err: any) {
      console.error("Erro ao duplicar perfil:", err);
      toast.show("Erro ao duplicar perfil RBAC.");
    }
  };

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionItem[]>();
    permissions.forEach((p) => {
      const cat = p.categoria || "Geral";
      if (!map.has(cat)) map.set(cat, []);
      if (!permSearch || p.nome.toLowerCase().includes(permSearch.toLowerCase()) || p.codigo.toLowerCase().includes(permSearch.toLowerCase())) {
        map.get(cat)!.push(p);
      }
    });
    return map;
  }, [permissions, permSearch]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
        Carregando Matriz de Controle de Acesso (RBAC)...
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Matriz granular de perfis administrativos e permissões funcionais">
        Gerenciamento de Permissões (RBAC)
      </PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24, marginTop: 24 }}>
        {/* Left Column: Roles list */}
        <Card style={{ padding: 18, height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              Perfis de Acesso ({roles.length})
            </span>
            <button
              type="button"
              onClick={() => setNewRoleModalOpen(true)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "rgba(13,184,126,0.12)",
                color: "#0DB87E",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title="Criar novo perfil"
            >
              <Plus size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {roles.map((role) => {
              const selected = selectedRole?.id === role.id;
              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: selected ? "1px solid #0DB87E" : "1px solid #E2E8F0",
                    background: selected ? "rgba(13,184,126,0.08)" : "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 150ms",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: selected ? 700 : 600, color: selected ? "#0DB87E" : "#0F172A" }}>
                      {role.nome}
                    </div>
                    <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace" }}>{role.codigo}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicateRole(role);
                    }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                    title="Duplicar perfil"
                  >
                    <Copy size={14} color="#94A3B8" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Right Column: Permissions Matrix */}
        {selectedRole && (
          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", pb: 16, paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                    {selectedRole.nome}
                  </h2>
                  <Pill bg="rgba(43,110,232,0.10)" color="#2B6EE8" size="sm">
                    {selectedRole.codigo}
                  </Pill>
                </div>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", marginTop: 4, margin: "4px 0 0" }}>
                  {selectedRole.descricao || "Sem descrição informada."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={saving || selectedRole.codigo === "super_admin"}
                style={{
                  height: 40,
                  padding: "0 18px",
                  borderRadius: 10,
                  background: selectedRole.codigo === "super_admin" ? "#94A3B8" : "#0DB87E",
                  color: "#fff",
                  border: "none",
                  fontFamily: "Syne",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: selectedRole.codigo === "super_admin" ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Save size={16} />
                {saving ? "Salvando..." : "Salvar Permissões"}
              </button>
            </div>

            {/* Search filter for permissions */}
            <div style={{ position: "relative", marginBottom: 20 }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 12 }} />
              <input
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                placeholder="Filtrar permissões nesta role..."
                style={{
                  width: "100%",
                  height: 40,
                  paddingLeft: 38,
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {/* Categories & Checkboxes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {Array.from(groupedPermissions.entries()).map(([catName, permList]) => {
                if (permList.length === 0) return null;
                return (
                  <div key={catName} style={{ border: "1px solid #F1F5F9", borderRadius: 10, padding: 16, background: "#F8FAFC" }}>
                    <div style={{ fontFamily: "Syne", fontSize: 13, fontWeight: 700, color: "#475569", uppercase: "uppercase", marginBottom: 12 }}>
                      {catName}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                      {permList.map((perm) => {
                        const checked = selectedRole.codigo === "super_admin" || rolePermIds.has(perm.id);
                        return (
                          <div
                            key={perm.id}
                            onClick={() => handleTogglePermission(perm.id)}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 8,
                              background: "#fff",
                              border: checked ? "1px solid rgba(13,184,126,0.35)" : "1px solid #E2E8F0",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                            }}
                          >
                            <div style={{ marginTop: 2 }}>
                              {checked ? <CheckSquare size={16} color="#0DB87E" /> : <Square size={16} color="#CBD5E1" />}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{perm.nome}</div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{perm.descricao}</div>
                              <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "monospace", marginTop: 2 }}>{perm.codigo}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Modal Criar Novo Perfil */}
      {newRoleModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 440, padding: 24, position: "relative" }}>
            <button
              onClick={() => setNewRoleModalOpen(false)}
              style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="#64748B" />
            </button>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
              Criar Novo Perfil de Acesso
            </h3>

            <form onSubmit={handleCreateRole} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Nome do Perfil</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Coordenador de Logística"
                  value={newRoleNome}
                  onChange={(e) => {
                    setNewRoleNome(e.target.value);
                    if (!newRoleCodigo) {
                      setNewRoleCodigo(e.target.value.toLowerCase().replace(/\s+/g, "_"));
                    }
                  }}
                  style={{ width: "100%", height: 40, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 12px", fontFamily: "DM Sans", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Código do Perfil</label>
                <input
                  type="text"
                  required
                  placeholder="ex: coord_logistica"
                  value={newRoleCodigo}
                  onChange={(e) => setNewRoleCodigo(e.target.value)}
                  style={{ width: "100%", height: 40, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 12px", fontFamily: "DM Sans", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Descrição</label>
                <textarea
                  placeholder="Descreva o escopo de atuação do perfil..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  style={{ width: "100%", height: 70, border: "1px solid #E2E8F0", borderRadius: 8, padding: 10, fontFamily: "DM Sans", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <GhostButton type="button" onClick={() => setNewRoleModalOpen(false)}>Cancelar</GhostButton>
                <button
                  type="submit"
                  style={{ padding: "8px 16px", borderRadius: 8, background: "#0DB87E", color: "#fff", border: "none", fontFamily: "Syne", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Criar Perfil
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
