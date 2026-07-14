import { useState, useEffect } from "react";
import { User, Bike, X, Search, ShieldAlert, Ban, UserCheck, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { MOCK_TICKETS, AdminTicket } from "@/mocks/adminData";
import { Card, Pill, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { getStatusRules, saveStatusRules, STATUS_THEMES, StatusRule } from "@/lib/statusRules";

export default function AdminArbitragemPage() {
  const toast = useAdminToast();
  const [tickets, setTickets] = useState<AdminTicket[]>(MOCK_TICKETS);
  const [tab, setTab] = useState<"open" | "closed" | "rules">("open");
  const [sel, setSel] = useState<AdminTicket | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userStatuses, setUserStatuses] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<StatusRule[]>([]);

  // Form states for custom status creation
  const [newLabel, setNewLabel] = useState("");
  const [newTheme, setNewTheme] = useState<"Red" | "Orange" | "Blue" | "Purple" | "Grey" | "Yellow">("Orange");
  const [newDuration, setNewDuration] = useState("");
  const [newRestrictions, setNewRestrictions] = useState({
    blockLogin: false,
    blockRequests: false,
    blockChat: false,
    blockPayments: false,
    hideProfile: false,
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase.from("usuarios").select("*");
        if (error) throw error;
        if (data) setUsersList(data);
      } catch (err) {
        console.error("Erro ao buscar usuários para arbitragem:", err);
      }
    };
    fetchUsers();

    // Load user statuses
    const saved = localStorage.getItem("ubt_users_status");
    if (saved) {
      try {
        setUserStatuses(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    // Load status rules
    setRules(getStatusRules());
  }, []);

  const saveRules = (updatedRules: StatusRule[]) => {
    setRules(updatedRules);
    saveStatusRules(updatedRules);
  };

  const changeUserStatus = (userId: string, newStatus: string) => {
    const updated = { ...userStatuses, [userId]: newStatus };
    setUserStatuses(updated);
    localStorage.setItem("ubt_users_status", JSON.stringify(updated));
    toast.show("Status do usuário atualizado com sucesso!");
  };

  const updateRuleField = (key: string, field: keyof StatusRule, value: any) => {
    const updated = rules.map((r) => (r.key === key ? { ...r, [field]: value } : r));
    saveRules(updated);
    toast.show("Configurações de status atualizadas!");
  };

  const deleteStatus = (key: string) => {
    const updated = rules.filter((r) => r.key !== key);
    saveRules(updated);
    toast.show("Status removido.");
  };

  const createStatus = () => {
    if (!newLabel.trim()) {
      toast.show("Insira um nome para o status!");
      return;
    }
    const key = newLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
    if (rules.some((r) => r.key === key)) {
      toast.show("Um status com essa chave já existe!");
      return;
    }
    const newRule: StatusRule = {
      key,
      label: newLabel,
      theme: newTheme,
      durationDays: newDuration ? parseInt(newDuration) : null,
      ...newRestrictions,
    };
    saveRules([...rules, newRule]);
    toast.show("Novo status criado com sucesso!");
    // Reset form
    setNewLabel("");
    setNewTheme("Orange");
    setNewDuration("");
    setNewRestrictions({
      blockLogin: false,
      blockRequests: false,
      blockChat: false,
      blockPayments: false,
      hideProfile: false,
    });
  };

  const findUserByName = (name: string) => {
    return usersList.find((u) => u.nome.toLowerCase() === name.toLowerCase());
  };

  const tomadorUser = sel ? findUserByName(sel.tomador) : null;
  const prestadorUser = sel ? findUserByName(sel.prestador) : null;

  const tomadorStatus = tomadorUser ? (userStatuses[tomadorUser.id] || "active") : "active";
  const prestadorStatus = prestadorUser ? (userStatuses[prestadorUser.id] || "active") : "active";
  const [justif, setJustif] = useState("");

  const openCount = tickets.filter((t) => t.status === "open").length;
  const closedCount = tickets.filter((t) => t.status === "closed").length;
  const list = tickets.filter((t) => t.status === tab);

  const resolve = () => {
    if (!sel || !justif.trim()) return;
    setTickets((arr) => arr.map((t) => (t.id === sel.id ? { ...t, status: "closed" } : t)));
    toast.show("Ticket resolvido!");
    setSel(null);
    setJustif("");
  };

  const getStatusLabelAndColors = (statusKey: string) => {
    if (statusKey === "active") {
      return { label: "Ativo", bg: "rgba(13,184,126,0.12)", color: "#0DB87E", border: "rgba(13,184,126,0.25)" };
    }
    const rule = rules.find((r) => r.key === statusKey);
    if (rule) {
      const theme = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
      return { label: rule.label, ...theme };
    }
    return { label: statusKey, bg: "rgba(148,163,184,0.12)", color: "#94A3B8", border: "rgba(148,163,184,0.25)" };
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Arbitragem</h1>
        <Pill bg="rgba(232,64,64,0.10)" color="#E84040" border="rgba(232,64,64,0.25)">
          {openCount} abertos
        </Pill>
      </div>

      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid #E2E8F0", marginBottom: 16 }}>
        {[
          { key: "open" as const, label: `Abertos (${openCount})` },
          { key: "closed" as const, label: `Histórico (${closedCount})` },
          { key: "rules" as const, label: `Status & Regras` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 0",
              fontFamily: "DM Sans",
              fontSize: 14,
              fontWeight: 600,
              color: tab === t.key ? "#0DB87E" : "#475569",
              borderBottom: tab === t.key ? "2px solid #0DB87E" : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rules" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Rules Grid */}
          <div>
            <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>
              Configuração de Status Ativos
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
              {rules.map((rule) => {
                const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                const isDefault = rule.key === "quarantined" || rule.key === "disabled";
                return (
                  <Card key={rule.key} style={{ padding: 20, borderTop: `4px solid ${colors.color}`, position: "relative" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <Pill bg={colors.bg} color={colors.color} border={colors.border}>
                          {rule.label}
                        </Pill>
                        {isDefault && (
                          <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 8, fontFamily: "DM Sans" }}>
                            (Padrão)
                          </span>
                        )}
                      </div>
                      {!isDefault && (
                        <button
                          onClick={() => deleteStatus(rule.key)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#E84040",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: 0,
                            fontFamily: "DM Sans",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <Trash2 size={14} /> Excluir
                        </button>
                      )}
                    </div>

                    {/* Duration Field */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>
                        Duração padrão (dias):
                      </label>
                      {rule.key === "disabled" ? (
                        <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>
                          Ilimitado / Indefinido
                        </span>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="number"
                            min={1}
                            value={rule.durationDays === null ? "" : rule.durationDays}
                            placeholder="Ilimitado"
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              updateRuleField(rule.key, "durationDays", val);
                            }}
                            style={{
                              width: 90,
                              height: 32,
                              background: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              borderRadius: 8,
                              padding: "0 10px",
                              fontFamily: "DM Sans",
                              fontSize: 13,
                              color: "#0F172A",
                              outline: "none",
                            }}
                          />
                          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8" }}>
                            {rule.durationDays === null ? "dias indefinidos (Manual)" : "dias"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Restrictions Toggles */}
                    <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
                      <span style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#94A3B8", marginBottom: 10 }}>
                        Bloqueios e Restrições Ativas:
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[
                          { field: "blockLogin" as const, label: "Bloquear login no aplicativo" },
                          { field: "blockRequests" as const, label: "Bloquear solicitações de serviços" },
                          { field: "blockChat" as const, label: "Bloquear mensagens no chat" },
                          { field: "blockPayments" as const, label: "Bloquear recebimento/saques" },
                          { field: "hideProfile" as const, label: "Ocultar perfil em buscas" },
                        ].map((item) => (
                          <label
                            key={item.field}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              fontFamily: "DM Sans",
                              fontSize: 13,
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={rule[item.field]}
                              onChange={(e) => updateRuleField(rule.key, item.field, e.target.checked)}
                              style={{
                                width: 15,
                                height: 15,
                                border: "1px solid #E2E8F0",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Creation Form */}
          <Card style={{ padding: 24, background: "#F8FAFC", border: "1px dashed #CBD5E1" }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px" }}>
              Criar Novo Status Customizado
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                  Nome do Status
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sob Investigação"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  style={{
                    width: "100%",
                    height: 38,
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    color: "#0F172A",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                  Tema de Cor
                </label>
                <select
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value as any)}
                  style={{
                    width: "100%",
                    height: 38,
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    color: "#0F172A",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="Orange">Laranja (Quarentena/Aviso)</option>
                  <option value="Red">Vermelho (Crítico/Bloqueio)</option>
                  <option value="Blue">Azul (Informativo)</option>
                  <option value="Purple">Roxo (Destaque)</option>
                  <option value="Yellow">Amarelo (Alerta Suave)</option>
                  <option value="Grey">Cinza (Neutro)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6 }}>
                  Duração padrão (dias)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="Ilimitado / Manual"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  style={{
                    width: "100%",
                    height: 38,
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    color: "#0F172A",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <span style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 10 }}>
                Restrições Aplicadas ao Status
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {[
                  { field: "blockLogin" as const, label: "Bloquear login no App" },
                  { field: "blockRequests" as const, label: "Bloquear pedidos de serviço" },
                  { field: "blockChat" as const, label: "Bloquear mensagens no chat" },
                  { field: "blockPayments" as const, label: "Bloquear recebimento/saques" },
                  { field: "hideProfile" as const, label: "Ocultar perfil público" },
                ].map((item) => (
                  <label
                    key={item.field}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newRestrictions[item.field]}
                      onChange={(e) =>
                        setNewRestrictions((prev) => ({ ...prev, [item.field]: e.target.checked }))
                      }
                      style={{ cursor: "pointer" }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            <PrimaryButton
              onClick={createStatus}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Plus size={16} /> Criar Novo Status
            </PrimaryButton>
          </Card>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((t) => (
            <div
              key={t.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: 20,
                border: "1px solid #E2E8F0",
                borderLeft: `4px solid ${t.status === "open" ? "#E84040" : "#94A3B8"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <Pill bg="#F1F5F9" color="#475569" size="sm">
                  {t.type}
                </Pill>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8" }}>
                  {new Date(t.date).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <User size={14} color="#2B6EE8" />
                <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0F172A" }}>{t.tomador}</span>
                <span style={{ color: "#94A3B8" }}>↔</span>
                <Bike size={14} color="#0DB87E" />
                <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0F172A" }}>{t.prestador}</span>
              </div>
              <div
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 13,
                  color: "#475569",
                  marginTop: 6,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {t.description}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8 }}>
                <Pill bg="rgba(43,110,232,0.10)" color="#2B6EE8">
                  R$ {t.value.toFixed(2)}
                </Pill>
                <div style={{ display: "flex", gap: 8 }}>
                  {t.status === "open" && (
                    <button
                      onClick={() => setSel(t)}
                      style={{
                        background: "rgba(13,184,126,0.10)",
                        border: "1px solid rgba(13,184,126,0.25)",
                        color: "#0DB87E",
                        fontFamily: "DM Sans",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        padding: "6px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Resolver
                    </button>
                  )}
                  <button
                    onClick={() => setSel(t)}
                    style={{
                      background: "transparent",
                      border: "1px solid #E2E8F0",
                      color: "#475569",
                      fontFamily: "DM Sans",
                      fontSize: 12,
                      borderRadius: 6,
                      padding: "6px 14px",
                      cursor: "pointer",
                    }}
                  >
                    Detalhes
                  </button>
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <Card style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontFamily: "DM Sans" }}>
              Nenhum ticket {tab === "open" ? "aberto" : "fechado"}.
            </Card>
          )}
        </div>
      )}

      {sel && (
        <>
          <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }} />
          <aside
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              height: "100vh",
              width: 440,
              maxWidth: "100vw",
              background: "#fff",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.15)",
              zIndex: 70,
              overflowY: "auto",
              padding: 28,
            }}
          >
            <button
              onClick={() => setSel(null)}
              aria-label="Fechar"
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="#475569" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0F172A" }}>
                Ticket #{sel.id}
              </span>
              <Pill
                bg={sel.status === "open" ? "rgba(232,64,64,0.10)" : "rgba(13,184,126,0.10)"}
                color={sel.status === "open" ? "#E84040" : "#0DB87E"}
                size="sm"
              >
                {sel.status === "open" ? "Aberto" : "Fechado"}
              </Pill>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Descrição completa
              </div>
              <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{sel.description}</div>
            </div>

            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <User size={14} color="#2B6EE8" />
                    <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Tomador</span>
                  </div>
                  {tomadorUser && (() => {
                    const info = getStatusLabelAndColors(tomadorStatus);
                    return (
                      <span style={{
                        fontFamily: "DM Sans",
                        fontSize: 10,
                        fontWeight: 600,
                        color: info.color
                      }}>
                        {info.label.toUpperCase()}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0F172A", marginTop: 4 }}>{sel.tomador}</div>
                {tomadorUser && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {tomadorStatus !== "active" && (
                      <button
                        onClick={() => changeUserStatus(tomadorUser.id, "active")}
                        style={{ fontSize: 10, background: "rgba(13,184,126,0.1)", border: "none", color: "#0DB87E", padding: "3px 6px", borderRadius: 4, cursor: "pointer" }}
                      >
                        Ativar
                      </button>
                    )}
                    {rules.map((rule) => {
                      if (tomadorStatus === rule.key) return null;
                      const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                      return (
                        <button
                          key={rule.key}
                          onClick={() => changeUserStatus(tomadorUser.id, rule.key)}
                          style={{
                            fontSize: 10,
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            color: colors.color,
                            padding: "3px 6px",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          {rule.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bike size={14} color="#0DB87E" />
                    <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>Prestador</span>
                  </div>
                  {prestadorUser && (() => {
                    const info = getStatusLabelAndColors(prestadorStatus);
                    return (
                      <span style={{
                        fontFamily: "DM Sans",
                        fontSize: 10,
                        fontWeight: 600,
                        color: info.color
                      }}>
                        {info.label.toUpperCase()}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#0F172A", marginTop: 4 }}>{sel.prestador}</div>
                {prestadorUser && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {prestadorStatus !== "active" && (
                      <button
                        onClick={() => changeUserStatus(prestadorUser.id, "active")}
                        style={{ fontSize: 10, background: "rgba(13,184,126,0.1)", border: "none", color: "#0DB87E", padding: "3px 6px", borderRadius: 4, cursor: "pointer" }}
                      >
                        Ativar
                      </button>
                    )}
                    {rules.map((rule) => {
                      if (prestadorStatus === rule.key) return null;
                      const colors = STATUS_THEMES[rule.theme] || STATUS_THEMES.Grey;
                      return (
                        <button
                          key={rule.key}
                          onClick={() => changeUserStatus(prestadorUser.id, rule.key)}
                          style={{
                            fontSize: 10,
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            color: colors.color,
                            padding: "3px 6px",
                            borderRadius: 4,
                            cursor: "pointer",
                          }}
                        >
                          {rule.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                Valor em disputa
              </div>
              <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "#E84040" }}>
                R$ {sel.value.toFixed(2)}
              </div>
            </div>

            {sel.status === "open" && (
              <div style={{ marginTop: 24 }}>
                <textarea
                  value={justif}
                  onChange={(e) => setJustif(e.target.value)}
                  placeholder="Justificativa da decisão (obrigatória)"
                  style={{
                    width: "100%",
                    height: 100,
                    background: "#F1F5F9",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    color: "#0F172A",
                    resize: "none",
                    outline: "none",
                  }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => toast.show("Reembolso registrado.")}
                    style={{
                      background: "rgba(232,64,64,0.10)",
                      border: "1px solid rgba(232,64,64,0.25)",
                      color: "#E84040",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      padding: "10px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Reembolsar tomador
                  </button>
                  <GhostButton onClick={() => toast.show("Cobrança mantida.")}>Manter cobrança</GhostButton>
                </div>
                <PrimaryButton
                  disabled={!justif.trim()}
                  onClick={resolve}
                  style={{ width: "100%", marginTop: 10 }}
                >
                  Marcar como resolvido
                </PrimaryButton>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
