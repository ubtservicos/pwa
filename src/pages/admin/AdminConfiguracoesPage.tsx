import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Check,
  Clock,
  Code,
  Edit2,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  X,
} from "lucide-react";
import { Card, PageTitle, Pill, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { SettingsService, SystemSetting, SystemSettingVersion } from "@/services/SettingsService";
import { useRole } from "@/hooks/usePermissions";
import { HelpTooltip } from "@/components/admin/HelpTooltip";

const CATEGORIES = [
  "Todas",
  "Financeiro",
  "Marketplace",
  "Mototaxi",
  "Diaristas",
  "Ambulantes",
  "Coco & Cia",
  "KYC",
  "LGPD",
  "Telemetria",
  "Analytics",
  "Feature Flags",
  "Notificacoes",
  "Comunicacao",
  "Sistema",
];

export default function AdminConfiguracoesPage() {
  const toast = useAdminToast();
  const isSuperAdmin = useRole("super_admin");

  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");

  // Version History Modal
  const [selectedSettingForHistory, setSelectedSettingForHistory] = useState<SystemSetting | null>(null);
  const [versions, setVersions] = useState<SystemSettingVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollbackMotivo, setRollbackMotivo] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("categoria");

      if (error) throw error;
      setSettings(data || []);

      const initialMap: Record<string, any> = {};
      (data || []).forEach((s) => {
        initialMap[s.chave] = s.valor;
      });
      setEditingValues(initialMap);
    } catch (err: any) {
      console.error("Erro ao carregar configurações do sistema:", err);
      toast.show("Erro ao carregar parâmetros do Configuration Center.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();

    // Realtime subscription
    const channel = supabase
      .channel("admin_configuracoes_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, () => {
        loadSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSettings]);

  const handleValueChange = (chave: string, val: any) => {
    setEditingValues((prev) => ({ ...prev, [chave]: val }));
  };

  const handleSaveSetting = async (setting: SystemSetting) => {
    const newVal = editingValues[setting.chave];
    setSavingKey(setting.chave);
    try {
      const ok = await SettingsService.set(setting.chave, newVal, "Atualização via Central de Configurações");
      if (ok) {
        toast.show(`Parâmetro "${setting.chave}" atualizado com sucesso! ✓`);
        loadSettings();
      } else {
        toast.show(`Erro ao atualizar parâmetro "${setting.chave}".`);
      }
    } catch (err) {
      console.error("Erro ao salvar configuração:", err);
      toast.show("Falha ao gravar parâmetro.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleResetDefault = async (setting: SystemSetting) => {
    if (!setting.valor_padrao) return;
    handleValueChange(setting.chave, setting.valor_padrao);
    setSavingKey(setting.chave);
    try {
      const ok = await SettingsService.set(setting.chave, setting.valor_padrao, "Restauração de valor padrão");
      if (ok) {
        toast.show(`Parâmetro "${setting.chave}" restaurado para o padrão!`);
        loadSettings();
      }
    } finally {
      setSavingKey(null);
    }
  };

  const handleOpenHistory = async (setting: SystemSetting) => {
    setSelectedSettingForHistory(setting);
    setLoadingVersions(true);
    try {
      const { data, error } = await supabase
        .from("system_setting_versions")
        .select("*")
        .eq("setting_id", setting.id)
        .order("versao", { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (err) {
      console.error("Erro ao carregar histórico de versões:", err);
      toast.show("Erro ao carregar histórico de alterações.");
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    if (!selectedSettingForHistory) return;
    try {
      const ok = await SettingsService.rollback(
        selectedSettingForHistory.id,
        versionNumber,
        rollbackMotivo || `Rollback manual para versão ${versionNumber}`
      );

      if (ok) {
        toast.show(`Parâmetro revertido com sucesso para a versão v${versionNumber}! ✓`);
        setSelectedSettingForHistory(null);
        setRollbackMotivo("");
        loadSettings();
      } else {
        toast.show("Erro ao efetuar rollback.");
      }
    } catch (err) {
      console.error("Erro ao efetuar rollback:", err);
      toast.show("Erro ao processar reversão.");
    }
  };

  const filteredSettings = useMemo(() => {
    return settings.filter((s) => {
      const catMatch = selectedCategory === "Todas" || s.categoria.toLowerCase() === selectedCategory.toLowerCase();
      const searchMatch =
        !searchQuery ||
        s.chave.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.descricao && s.descricao.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.categoria.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && searchMatch;
    });
  }, [settings, selectedCategory, searchQuery]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "var(--admin-muted)" }}>
        Carregando Central de Configurações (SettingsService)...
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub={
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          Parâmetros operacionais centralizados, versionados e com atualização em tempo real
          <HelpTooltip concept="admin.configuracoes.centro_configuracoes" />
        </span>
      }>
        Central de Configurações
      </PageTitle>

      {/* Filter and Search Bar */}
      <Card style={{ padding: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar parâmetros por chave, descrição ou categoria..."
            style={{
              width: "100%",
              height: 40,
              paddingLeft: 38,
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              fontFamily: "DM Sans",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {/* Category Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => {
            const sel = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: sel ? "1px solid #0DB87E" : "1px solid #E2E8F0",
                  background: sel ? "rgba(13,184,126,0.12)" : "var(--admin-bg)",
                  color: sel ? "#0DB87E" : "var(--admin-subtle)",
                  fontFamily: "DM Sans",
                  fontSize: 12,
                  fontWeight: sel ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Settings Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {filteredSettings.map((setting) => {
          const isSaving = savingKey === setting.chave;
          const currentVal = editingValues[setting.chave] !== undefined ? editingValues[setting.chave] : setting.valor;
          const isDirty = JSON.stringify(currentVal) !== JSON.stringify(setting.valor);
          const isSensitiveRestricted = setting.sensivel && !isSuperAdmin;

          return (
            <Card key={setting.id} style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid var(--admin-border)" }}>
              <div>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "var(--admin-text)" }}>{setting.chave}</span>
                      <Pill bg="rgba(71,85,105,0.08)" color="var(--admin-subtle)" size="sm">{setting.tipo}</Pill>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--admin-muted)", fontWeight: 600, display: "block", marginTop: 2 }}>
                      {setting.categoria} · v{setting.versao}
                    </span>
                  </div>

                  {setting.sensivel && (
                    <Pill bg="rgba(232,64,64,0.10)" color="#E84040" size="sm">
                      <Lock size={12} style={{ marginRight: 4 }} /> Sensível
                    </Pill>
                  )}
                </div>

                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", marginTop: 4, marginBottom: 16, lineHeight: 1.4 }}>
                  {setting.descricao || "Sem descrição disponível."}
                </p>

                {/* Input Editor according to type */}
                {isSensitiveRestricted ? (
                  <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: 12, fontSize: 12, color: "var(--admin-muted)", textAlign: "center" }}>
                    🔒 Valor visível e editável apenas para Super Admin.
                  </div>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    {setting.tipo === "boolean" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          type="button"
                          onClick={() => handleValueChange(setting.chave, !currentVal)}
                          style={{
                            width: 52,
                            height: 28,
                            borderRadius: 999,
                            background: currentVal ? "#0DB87E" : "#CBD5E1",
                            border: "none",
                            padding: 3,
                            cursor: "pointer",
                            transition: "background 200ms",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: currentVal ? "flex-end" : "flex-start",
                          }}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--admin-bg)" }} />
                        </button>
                        <span style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: currentVal ? "#0DB87E" : "var(--admin-subtle)" }}>
                          {currentVal ? "Ativo (True)" : "Inativo (False)"}
                        </span>
                      </div>
                    ) : setting.tipo === "cor" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="color"
                          value={currentVal || "#0DB87E"}
                          onChange={(e) => handleValueChange(setting.chave, e.target.value)}
                          style={{ width: 40, height: 40, border: "none", borderRadius: 8, cursor: "pointer" }}
                        />
                        <input
                          type="text"
                          value={currentVal || ""}
                          onChange={(e) => handleValueChange(setting.chave, e.target.value)}
                          style={{ flex: 1, height: 40, border: "1px solid var(--admin-border)", borderRadius: 8, padding: "0 12px", fontFamily: "monospace", fontSize: 13 }}
                        />
                      </div>
                    ) : setting.tipo === "json" || setting.tipo === "array" ? (
                      <textarea
                        value={typeof currentVal === "object" ? JSON.stringify(currentVal, null, 2) : currentVal}
                        onChange={(e) => {
                          try {
                            handleValueChange(setting.chave, JSON.parse(e.target.value));
                          } catch {
                            handleValueChange(setting.chave, e.target.value);
                          }
                        }}
                        style={{ width: "100%", height: 80, border: "1px solid var(--admin-border)", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 12, outline: "none" }}
                      />
                    ) : (
                      <input
                        type={setting.tipo === "integer" || setting.tipo === "decimal" ? "number" : "text"}
                        step={setting.tipo === "decimal" ? "0.001" : "1"}
                        value={currentVal !== undefined && currentVal !== null ? currentVal : ""}
                        onChange={(e) => {
                          const val = setting.tipo === "integer" ? parseInt(e.target.value) : setting.tipo === "decimal" ? parseFloat(e.target.value) : e.target.value;
                          handleValueChange(setting.chave, val);
                        }}
                        style={{ width: "100%", height: 40, border: "1px solid var(--admin-border)", borderRadius: 8, padding: "0 12px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              {!isSensitiveRestricted && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--admin-bg)", paddingTop: 14 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(setting)}
                      style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--admin-border)", background: "var(--admin-bg)", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Clock size={12} /> Histórico
                    </button>
                    {setting.valor_padrao && (
                      <button
                        type="button"
                        onClick={() => handleResetDefault(setting)}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--admin-border)", background: "var(--admin-bg)", fontSize: 11, fontWeight: 600, color: "var(--admin-subtle)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <RotateCcw size={12} /> Padrão
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveSetting(setting)}
                    disabled={isSaving || !isDirty}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      background: isDirty ? "#0DB87E" : "var(--admin-muted)",
                      color: "#fff",
                      border: "none",
                      fontFamily: "Syne",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: isDirty ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Save size={14} />
                    {isSaving ? "Gravando..." : "Salvar"}
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal Histórico e Rollback */}
      {selectedSettingForHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", padding: 24, position: "relative" }}>
            <button
              onClick={() => setSelectedSettingForHistory(null)}
              style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={20} color="var(--admin-subtle)" />
            </button>

            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", margin: "0 0 4px" }}>
              Histórico de Versões: {selectedSettingForHistory.chave}
            </h3>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)", marginBottom: 20 }}>
              Versão atual ativa: <strong>v{selectedSettingForHistory.versao}</strong>
            </p>

            {loadingVersions ? (
              <div style={{ padding: 20, textAlign: "center", fontFamily: "DM Sans", color: "var(--admin-muted)" }}>Carregando versões anteriores...</div>
            ) : versions.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontFamily: "DM Sans", color: "var(--admin-muted)" }}>Nenhuma alteração anterior registrada.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {versions.map((ver) => (
                  <div key={ver.id} style={{ border: "1px solid var(--admin-border)", borderRadius: 8, padding: 14, background: "var(--admin-bg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>Versão v{ver.versao}</span>
                      <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                        {new Date(ver.updated_at).toLocaleString("pt-BR")}
                      </span>
                    </div>

                    <p style={{ fontSize: 12, color: "var(--admin-subtle)", margin: "0 0 8px" }}>Motivo: {ver.motivo || "Sem motivo informado."}</p>

                    <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 6, padding: 8, fontSize: 11, fontFamily: "monospace", marginBottom: 10 }}>
                      {JSON.stringify(ver.valor, null, 2)}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => handleRollback(ver.versao)}
                        style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(43,110,232,0.10)", color: "#2B6EE8", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        Rollback para v{ver.versao}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <GhostButton onClick={() => setSelectedSettingForHistory(null)}>Fechar</GhostButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
