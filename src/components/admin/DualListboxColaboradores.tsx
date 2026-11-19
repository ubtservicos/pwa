import React, { useMemo, useState } from "react";
import { ArrowRight, Search, UserMinus, UserPlus, Users } from "lucide-react";

export interface DualListboxColaboradorOption {
  id: string;
  nome: string;
  telefone?: string | null;
  perfil?: string | null;
  is_ativo?: boolean;
  status_aprovacao?: string | null;
}

interface DualListboxColaboradoresProps {
  colaboradores: DualListboxColaboradorOption[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  onManageClick?: () => void;
}

export default function DualListboxColaboradores({
  colaboradores,
  selectedIds,
  onChange,
  onManageClick,
}: DualListboxColaboradoresProps) {
  const [search, setSearch] = useState("");

  const available = useMemo(() => {
    const q = search.toLowerCase().trim();
    return colaboradores.filter((c) => {
      if (selectedIds.includes(c.id)) return false;
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        (c.telefone || "").toLowerCase().includes(q)
      );
    });
  }, [colaboradores, selectedIds, search]);

  const linked = useMemo(() => {
    const byId = new Map(colaboradores.map((c) => [c.id, c]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((item): item is DualListboxColaboradorOption => Boolean(item));
  }, [colaboradores, selectedIds]);

  const addColaborador = (id: string) => {
    if (!selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
    }
  };

  const removeColaborador = (id: string) => {
    onChange(selectedIds.filter((item) => item !== id));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <label
          style={{
            fontFamily: "DM Sans",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--admin-subtle)",
            margin: 0,
          }}
        >
          Colaboradores Vinculados ao Caminhão ({linked.length})
        </label>
        {onManageClick && (
          <button
            type="button"
            onClick={onManageClick}
            style={{
              background: "none",
              border: "none",
              color: "#0DB87E",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Gerenciar Colaboradores
          </button>
        )}
      </div>

      {colaboradores.length === 0 ? (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px dashed var(--admin-border)",
            fontSize: 12,
            color: "var(--admin-muted)",
            textAlign: "center",
          }}
        >
          Nenhum colaborador cadastrado em /admin/coco/colaboradores ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Coluna Esquerda: Colaboradores Disponíveis */}
          <div
            style={{
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--admin-subtle)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Users size={12} /> Disponíveis ({available.length})
              </span>
            </div>

            <div style={{ position: "relative" }}>
              <Search size={13} color="var(--admin-muted)" style={{ position: "absolute", left: 9, top: 9 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar disponíveis..."
                style={{
                  width: "100%",
                  background: "var(--admin-surface)",
                  border: "1px solid var(--admin-border)",
                  borderRadius: 8,
                  padding: "6px 10px 6px 28px",
                  fontSize: 12,
                  color: "var(--admin-text)",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 165, overflowY: "auto" }}>
              {available.length === 0 ? (
                <div style={{ padding: "14px 8px", textAlign: "center", fontSize: 11, color: "var(--admin-muted)" }}>
                  {search ? "Nenhum disponível para a busca." : "Todos os colaboradores já estão vinculados."}
                </div>
              ) : (
                available.map((col) => (
                  <div
                    key={col.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      padding: "7px 9px",
                      borderRadius: 8,
                      background: "var(--admin-surface)",
                      border: "1px solid var(--admin-border)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--admin-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {col.nome}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--admin-muted)" }}>
                        {col.perfil === "alta_gestao" ? "Alta Gestão" : "Colab. Administrativo"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addColaborador(col.id)}
                      title="Adicionar ao caminhão"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(13,184,126,0.4)",
                        background: "rgba(13,184,126,0.12)",
                        color: "#0DB87E",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <UserPlus size={11} />
                      <span>Adicionar</span>
                      <ArrowRight size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Coluna Direita: Colaboradores Vinculados ao Caminhão */}
          <div
            style={{
              background: "rgba(13,184,126,0.05)",
              border: "1px solid rgba(13,184,126,0.3)",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#0DB87E", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Users size={12} /> Vinculados ao Caminhão ({linked.length})
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 205, overflowY: "auto" }}>
              {linked.length === 0 ? (
                <div style={{ padding: "24px 8px", textAlign: "center", fontSize: 11, color: "var(--admin-muted)", border: "1px dashed var(--admin-border)", borderRadius: 8 }}>
                  Selecione colaboradores na lista de disponíveis para vincular a este veículo.
                </div>
              ) : (
                linked.map((col) => (
                  <div
                    key={col.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      padding: "7px 9px",
                      borderRadius: 8,
                      background: "var(--admin-surface)",
                      border: "1px solid rgba(13,184,126,0.35)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--admin-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {col.nome}
                      </div>
                      <div style={{ fontSize: 10, color: "#0DB87E" }}>
                        {col.perfil === "alta_gestao" ? "Alta Gestão" : "Colab. Administrativo"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeColaborador(col.id)}
                      title="Remover do caminhão"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(232,64,64,0.35)",
                        background: "rgba(232,64,64,0.10)",
                        color: "#E84040",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <UserMinus size={11} />
                      <span>Remover</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
