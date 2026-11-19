import React, { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MapPin,
  Edit3,
  Clock,
  UserCheck,
  UserX,
  Phone,
  Mail,
  RotateCcw,
  Users,
} from "lucide-react";
import { Card, Pill } from "@/components/admin/ui";
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
  "Estufa I",
  "Estufa II",
  "Ipiranguinha",
  "Taquaral",
  "Itamambuca",
  "Praia do Félix",
  "Praia do Lázaro",
  "Lagoinha",
  "Saco da Ribeira",
  "Sertão da Quina",
];

interface CaminhaoFrota {
  id: string;
  plate: string;
  apelido: string;
  prestador_id?: string | null;
  colaboradores_ids?: string[] | null;
  areas_atendidas?: string[] | null;
  hora_saida?: string | null;
  expectativa_retorno?: string | null;
  status_aprovacao: "approved" | "pending" | "rejected";
  role_solicitada?: string;
  is_online?: boolean;
  collections_today?: number;
  total_collections?: number;
  created_at?: string;
  updated_at?: string;
}

interface PrestadorInfo {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
}

interface ColaboradorOption {
  id: string;
  nome: string;
  telefone?: string | null;
  is_ativo?: boolean;
}

export default function AdminCocoFrota() {
  const toast = useAdminToast();
  const navigate = useNavigate();

  const [caminhoes, setCaminhoes] = useState<CaminhaoFrota[]>([]);
  const [prestadorsMap, setPrestadorsMap] = useState<Record<string, PrestadorInfo>>({});
  const [colaboradoresList, setColaboradoresList] = useState<ColaboradorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "todos" | "online" | "pending" | "approved" | "rejected"
  >("todos");

  // Modal State (Criar / Editar Caminhão)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaminhao, setEditingCaminhao] = useState<CaminhaoFrota | null>(null);
  const [plate, setPlate] = useState("");
  const [apelido, setApelido] = useState("");
  const [roleSolicitada, setRoleSolicitada] = useState("cocoecia-colaborador");
  const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
  const [orderedBairros, setOrderedBairros] = useState<string[]>([]);
  const [horaSaida, setHoraSaida] = useState("07:30");
  const [expectativaRetorno, setExpectativaRetorno] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);

  const colaboradoresMap = useMemo(() => {
    const map: Record<string, ColaboradorOption> = {};
    colaboradoresList.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [colaboradoresList]);

  const fetchColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from("coco_colaboradores")
        .select("id, nome, telefone, is_ativo")
        .order("nome", { ascending: true });
      if (!error && data) {
        setColaboradoresList(data as ColaboradorOption[]);
      }
    } catch (err) {
      console.warn("Erro ao buscar colaboradores da Côco & Cia:", err);
    }
  };

  const fetchCaminhoes = async () => {
    try {
      const { data, error } = await supabase
        .from("coco_caminhoes")
        .select(
          "id, plate, apelido, prestador_id, colaboradores_ids, areas_atendidas, hora_saida, expectativa_retorno, status_aprovacao, role_solicitada, is_online, collections_today, total_collections, created_at, updated_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        setCaminhoes(data as CaminhaoFrota[]);

        const prestadorIds = data
          .map((c: any) => c.prestador_id)
          .filter((id: any): id is string => Boolean(id));

        if (prestadorIds.length > 0) {
          const { data: usersData } = await supabase
            .from("usuarios")
            .select("id, nome, email, telefone")
            .in("id", prestadorIds);

          if (usersData) {
            const map: Record<string, PrestadorInfo> = {};
            usersData.forEach((u: any) => {
              map[u.id] = u;
            });
            setPrestadorsMap(map);
          }
        }
      }
    } catch (err: any) {
      console.warn("Erro ao buscar frota:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaminhoes();
    fetchColaboradores();

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

  const openModal = (caminhao?: CaminhaoFrota) => {
    if (caminhao) {
      setEditingCaminhao(caminhao);
      setPlate(caminhao.plate || "");
      setApelido(caminhao.apelido || "");
      setRoleSolicitada(caminhao.role_solicitada || "cocoecia-colaborador");
      setSelectedColaboradores(Array.isArray(caminhao.colaboradores_ids) ? caminhao.colaboradores_ids : []);
      setOrderedBairros(Array.isArray(caminhao.areas_atendidas) ? caminhao.areas_atendidas : []);
      setHoraSaida(caminhao.hora_saida || "");
      setExpectativaRetorno(caminhao.expectativa_retorno || "");
    } else {
      setEditingCaminhao(null);
      setPlate("");
      setApelido("");
      setRoleSolicitada("cocoecia-colaborador");
      setSelectedColaboradores([]);
      setOrderedBairros([]);
      setHoraSaida("07:30");
      setExpectativaRetorno("17:00");
    }
    setIsModalOpen(true);
  };

  const toggleColaborador = (colabId: string) => {
    setSelectedColaboradores((prev) =>
      prev.includes(colabId) ? prev.filter((id) => id !== colabId) : [...prev, colabId]
    );
  };

  const toggleBairro = (bairro: string) => {
    setOrderedBairros((prev) =>
      prev.includes(bairro) ? prev.filter((b) => b !== bairro) : [...prev, bairro]
    );
  };

  const moveBairro = (index: number, direction: -1 | 1) => {
    setOrderedBairros((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const handleSaveCaminhao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !apelido.trim()) {
      toast.show("Informe a placa e o apelido do veículo.");
      return;
    }

    setSubmitting(true);
    const payload = {
      plate: plate.trim().toUpperCase(),
      apelido: apelido.trim(),
      role_solicitada: roleSolicitada,
      colaboradores_ids: selectedColaboradores,
      areas_atendidas: orderedBairros.length > 0 ? orderedBairros : ["Centro"],
      hora_saida: horaSaida.trim() || null,
      expectativa_retorno: expectativaRetorno.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingCaminhao) {
        const { data, error } = await supabase
          .from("coco_caminhoes")
          .update(payload)
          .eq("id", editingCaminhao.id)
          .select(
            "id, plate, apelido, prestador_id, colaboradores_ids, areas_atendidas, hora_saida, expectativa_retorno, status_aprovacao, role_solicitada, is_online, collections_today, total_collections, created_at, updated_at"
          )
          .single();

        if (error) throw error;
        setCaminhoes((prev) =>
          prev.map((c) => (c.id === editingCaminhao.id ? (data as CaminhaoFrota) : c))
        );
        toast.show(`Caminhão "${payload.apelido}" atualizado com sucesso!`);
      } else {
        const { data, error } = await supabase
          .from("coco_caminhoes")
          .insert({
            ...payload,
            status_aprovacao: "approved",
            is_online: false,
            collections_today: 0,
            total_collections: 0,
          })
          .select(
            "id, plate, apelido, prestador_id, colaboradores_ids, areas_atendidas, hora_saida, expectativa_retorno, status_aprovacao, role_solicitada, is_online, collections_today, total_collections, created_at, updated_at"
          )
          .single();

        if (error) throw error;
        setCaminhoes((prev) => [data as CaminhaoFrota, ...prev]);
        toast.show(`Caminhão "${payload.apelido}" cadastrado na frota oficial!`);
      }

      setIsModalOpen(false);
      setEditingCaminhao(null);
    } catch (err: any) {
      toast.show(`Erro ao salvar caminhão: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOnline = async (id: string, currentOnline: boolean, truckName: string) => {
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({ is_online: !currentOnline })
        .eq("id", id);
      if (error) throw error;
      toast.show(`Caminhão "${truckName}" agora está ${!currentOnline ? "ONLINE 🟢" : "OFFLINE ⚪"}.`);
      fetchCaminhoes();
    } catch (err: any) {
      toast.show(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleDeleteCaminhao = async (id: string, truckName: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o caminhão "${truckName}" da frota?`)) return;
    try {
      const { error } = await supabase.from("coco_caminhoes").delete().eq("id", id);
      if (error) throw error;
      setCaminhoes((prev) => prev.filter((c) => c.id !== id));
      toast.show(`Caminhão "${truckName}" removido da frota.`);
    } catch (err: any) {
      toast.show(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleAprovar = async (
    id: string,
    prestadorId: string | null | undefined,
    truckName: string,
    role?: string
  ) => {
    const finalRole = role || "cocoecia-colaborador";
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({
          status_aprovacao: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;

      if (prestadorId) {
        await supabase.from("usuarios").update({ role: finalRole }).eq("id", prestadorId);
        await supabase.from("profiles").update({ role: finalRole }).eq("id", prestadorId);
      }
      toast.show(`Vinculação do caminhão "${truckName}" aprovada com sucesso!`);
      fetchCaminhoes();
    } catch (err: any) {
      toast.show(`Erro ao aprovar: ${err.message}`);
    }
  };

  const handleRejeitar = async (id: string, truckName: string) => {
    if (!window.confirm(`Tem certeza que deseja rejeitar a vinculação do veículo "${truckName}"?`)) return;
    try {
      const { error } = await supabase
        .from("coco_caminhoes")
        .update({
          status_aprovacao: "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;

      toast.show(`Solicitação do caminhão "${truckName}" rejeitada.`);
      fetchCaminhoes();
    } catch (err: any) {
      toast.show(`Erro ao rejeitar: ${err.message}`);
    }
  };

  const pendingRequests = caminhoes.filter((c) => c.status_aprovacao === "pending");

  const filteredCaminhoes = caminhoes.filter((c) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      c.plate?.toLowerCase().includes(q) ||
      c.apelido?.toLowerCase().includes(q) ||
      c.areas_atendidas?.some((a: string) => a.toLowerCase().includes(q)) ||
      c.colaboradores_ids?.some((cid) =>
        (colaboradoresMap[cid]?.nome || "").toLowerCase().includes(q)
      );

    if (!matchesSearch) return false;

    if (statusFilter === "online") return c.is_online && c.status_aprovacao === "approved";
    if (statusFilter === "pending") return c.status_aprovacao === "pending";
    if (statusFilter === "approved") return c.status_aprovacao === "approved";
    if (statusFilter === "rejected") return c.status_aprovacao === "rejected";
    return true;
  });

  return (
    <div style={{ padding: 32 }}>
      {/* Header & Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
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
              cursor: "pointer",
            }}
            title="Voltar ao Painel"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Gestão de Frota & Rotas de Coleta
            </h1>
            <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
              Gerencie os caminhões da Côco & Cia, equipe vinculada, ordem de coleta bairro a bairro e horários de saída/retorno.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => openModal()}
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
              boxShadow: "0 4px 14px rgba(13,184,126,0.25)",
            }}
          >
            <Plus size={16} /> Cadastrar Caminhão Oficial
          </button>
        </div>
      </div>

      {/* BLOCO DESTACADO: SOLICITAÇÕES PENDENTES DE VINCULAÇÃO */}
      {pendingRequests.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              background: "rgba(245,166,35,0.08)",
              border: "1px solid rgba(245,166,35,0.3)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(245,166,35,0.2)", color: "#F5A623", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={20} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                    Solicitações Pendentes de Vinculação ({pendingRequests.length})
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
                    Prestadores que solicitaram vinculação aos caminhões da Côco & Cia aguardando validação do administrador.
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {pendingRequests.map((req) => {
                const prestador = req.prestador_id ? prestadorsMap[req.prestador_id] : null;

                return (
                  <Card key={req.id} style={{ padding: 18, background: "var(--admin-surface)", border: "1px solid var(--admin-border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Truck size={18} color="#F5A623" />
                          <strong style={{ fontFamily: "Syne", fontSize: 15, color: "var(--admin-text)" }}>
                            {req.apelido}
                          </strong>
                        </div>
                        <span style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: "2px 8px", borderRadius: 6, fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "var(--admin-text)" }}>
                          {req.plate}
                        </span>
                      </div>

                      <div style={{ background: "var(--admin-bg)", padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 12, fontFamily: "DM Sans", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ color: "var(--admin-text)", fontWeight: 600 }}>
                          Prestador: {prestador?.nome || (req.prestador_id ? `ID: ${req.prestador_id.slice(0, 8)}...` : "Não identificado")}
                        </div>
                        {prestador?.telefone && (
                          <div style={{ color: "var(--admin-subtle)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Phone size={12} /> {prestador.telefone}
                          </div>
                        )}
                        {prestador?.email && (
                          <div style={{ color: "var(--admin-subtle)", display: "flex", alignItems: "center", gap: 6 }}>
                            <Mail size={12} /> {prestador.email}
                          </div>
                        )}
                        <div style={{ color: "#F5A623", fontWeight: 600, marginTop: 2 }}>
                          Função Solicitada: {req.role_solicitada === "cocoecia-dirigentes" ? "💼 Dirigente" : "🚚 Colaborador / Motorista"}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                        {req.areas_atendidas && req.areas_atendidas.length > 0 ? (
                          req.areas_atendidas.map((b, idx) => (
                            <span key={`${b}-${idx}`} style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", border: "1px solid var(--admin-border)", padding: "2px 6px", borderRadius: 4, color: "var(--admin-subtle)" }}>
                              {idx + 1}º {b}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>Centro / Itaguá</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--admin-border)" }}>
                      <button
                        type="button"
                        onClick={() => handleAprovar(req.id, req.prestador_id, req.apelido, req.role_solicitada)}
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
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <UserCheck size={14} /> Aprovar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejeitar(req.id, req.apelido)}
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
                          cursor: "pointer",
                          display: "flex",
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
        </div>
      )}

      {/* Filters & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", maxWidth: 360, width: "100%" }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, apelido, colaborador ou bairro..."
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
              outline: "none",
            }}
          />
          <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "todos", label: "Todos" },
            { id: "online", label: "🟢 Online" },
            { id: "approved", label: "Aprovados" },
            { id: "pending", label: `⏳ Pendentes (${pendingRequests.length})` },
            { id: "rejected", label: "❌ Rejeitados" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
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
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet Table Card (Sem Chave PIX; com Colaboradores, Rota Ordenada e Saída/Retorno) */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontFamily: "DM Sans", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--admin-bg)", borderBottom: "1px solid var(--admin-border)", color: "var(--admin-subtle)", fontSize: 12, textTransform: "uppercase" }}>
                <th style={{ padding: "16px 20px" }}>Veículo / Placa</th>
                <th style={{ padding: "16px 20px" }}>Colaboradores Vinculados</th>
                <th style={{ padding: "16px 20px" }}>Rota Ordenada (Bairro a Bairro)</th>
                <th style={{ padding: "16px 20px" }}>Saída / Retorno</th>
                <th style={{ padding: "16px 20px" }}>Status Operacional</th>
                <th style={{ padding: "16px 20px", textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--admin-muted)" }}>
                    Carregando veículos da frota...
                  </td>
                </tr>
              ) : filteredCaminhoes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--admin-muted)" }}>
                    Nenhum caminhão encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                filteredCaminhoes.map((c) => {
                  const prestador = c.prestador_id ? prestadorsMap[c.prestador_id] : null;
                  const linkedColabs = (c.colaboradores_ids || [])
                    .map((cid) => colaboradoresMap[cid])
                    .filter(Boolean);
                  const rota = c.areas_atendidas || [];

                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(13,184,126,0.12)", color: "#0DB87E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Truck size={18} />
                          </div>
                          <div>
                            <div style={{ fontFamily: "Syne", fontWeight: 700, color: "var(--admin-text)", fontSize: 14 }}>
                              {c.apelido}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                              <span style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontWeight: 700, fontSize: 11, color: "var(--admin-text)" }}>
                                {c.plate}
                              </span>
                              {prestador?.nome && (
                                <span style={{ fontSize: 11, color: "var(--admin-subtle)" }}>
                                  · {prestador.nome}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Colaboradores Vinculados */}
                      <td style={{ padding: "16px 20px", maxWidth: 220 }}>
                        {linkedColabs.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {linkedColabs.map((col) => (
                              <span
                                key={col.id}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  background: "rgba(13,184,126,0.12)",
                                  border: "1px solid rgba(13,184,126,0.3)",
                                  color: "#0DB87E",
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                <Users size={11} /> {col.nome}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>
                            Nenhum colaborador vinculado
                          </span>
                        )}
                      </td>

                      {/* Rota Ordenada Bairro a Bairro */}
                      <td style={{ padding: "16px 20px", maxWidth: 280 }}>
                        {rota.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                            {rota.map((b, idx) => (
                              <React.Fragment key={`${b}-${idx}`}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid var(--admin-border)",
                                    padding: "2px 7px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    color: "var(--admin-text)",
                                    fontWeight: 600,
                                  }}
                                >
                                  <span style={{ color: "#0DB87E", fontFamily: "monospace", fontWeight: 700 }}>
                                    {idx + 1}º
                                  </span>
                                  {b}
                                </span>
                                {idx < rota.length - 1 && (
                                  <span style={{ color: "var(--admin-muted)", fontSize: 10 }}>→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>Rota não definida</span>
                        )}
                      </td>

                      {/* Hora de Saída e Expectativa de Retorno */}
                      <td style={{ padding: "16px 20px", whiteSpace: "nowrap" }}>
                        {c.hora_saida || c.expectativa_retorno ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 12, color: "var(--admin-text)" }}>
                            <Clock size={13} color="#0DB87E" />
                            <span>{c.hora_saida || "--:--"}</span>
                            <span style={{ color: "var(--admin-muted)" }}>→</span>
                            <span>{c.expectativa_retorno || "--:--"}</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>Não informado</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "16px 20px" }}>
                        {c.status_aprovacao === "pending" ? (
                          <Pill bg="rgba(245,166,35,0.15)" color="#F5A623" size="sm">
                            ⏳ Aprovação Pendente
                          </Pill>
                        ) : c.status_aprovacao === "rejected" ? (
                          <Pill bg="rgba(232,64,64,0.15)" color="#E84040" size="sm">
                            ❌ Rejeitado
                          </Pill>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleOnline(c.id, Boolean(c.is_online), c.apelido)}
                            style={{
                              border: "none",
                              background: c.is_online ? "rgba(13,184,126,0.15)" : "var(--admin-border)",
                              color: c.is_online ? "#0DB87E" : "var(--admin-muted)",
                              padding: "4px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {c.is_online ? "🟢 Online no Mapa" : "⚪ Offline"}
                          </button>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          {c.status_aprovacao === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAprovar(c.id, c.prestador_id, c.apelido, c.role_solicitada)}
                                style={{
                                  background: "#0DB87E",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                title="Aprovar Prestador"
                              >
                                <Check size={12} /> Aprovar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejeitar(c.id, c.apelido)}
                                style={{
                                  background: "rgba(232,64,64,0.15)",
                                  color: "#E84040",
                                  border: "1px solid rgba(232,64,64,0.3)",
                                  borderRadius: 6,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                                title="Rejeitar Solicitação"
                              >
                                <X size={12} /> Rejeitar
                              </button>
                            </>
                          )}

                          {c.status_aprovacao === "rejected" && (
                            <button
                              type="button"
                              onClick={() => handleAprovar(c.id, c.prestador_id, c.apelido, c.role_solicitada)}
                              style={{
                                background: "rgba(13,184,126,0.15)",
                                color: "#0DB87E",
                                border: "1px solid rgba(13,184,126,0.3)",
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title="Reavaliar e Aprovar"
                            >
                              <RotateCcw size={12} /> Reaprovar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => openModal(c)}
                            style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 6 }}
                            title="Editar Caminhão, Equipe, Rota e Horários"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCaminhao(c.id, c.apelido)}
                            style={{ background: "transparent", border: "none", color: "#E84040", cursor: "pointer", padding: 6 }}
                            title="Remover Caminhão"
                          >
                            <Trash2 size={16} />
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

      {/* MODAL: CADASTRAR / EDITAR CAMINHÃO */}
      {isModalOpen && (
        <div style={modalBackdropStyle} onClick={() => setIsModalOpen(false)}>
          <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Truck size={20} color="#0DB87E" />
                <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                  {editingCaminhao ? "Editar Caminhão & Rota" : "Cadastrar Caminhão Oficial da Frota"}
                </h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} style={closeBtnStyle}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCaminhao} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Placa e Apelido */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Placa do Veículo *</label>
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="Ex: ABC-1234"
                    style={{ ...inputStyle, textTransform: "uppercase", fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Apelido / Identificação *</label>
                  <input
                    type="text"
                    required
                    value={apelido}
                    onChange={(e) => setApelido(e.target.value)}
                    placeholder="Ex: Caminhão 01 - Norte"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Hora de Saída e Expectativa de Retorno */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Hora de Saída</label>
                  <input
                    type="time"
                    value={horaSaida}
                    onChange={(e) => setHoraSaida(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "monospace" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Expectativa de Retorno</label>
                  <input
                    type="time"
                    value={expectativaRetorno}
                    onChange={(e) => setExpectativaRetorno(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "monospace" }}
                  />
                </div>
              </div>

              {/* Colaboradores Vinculados */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Colaboradores Vinculados ao Caminhão ({selectedColaboradores.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/coco/colaboradores")}
                    style={{ background: "none", border: "none", color: "#0DB87E", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    + Gerenciar Colaboradores
                  </button>
                </div>

                {colaboradoresList.length === 0 ? (
                  <div style={{ padding: "12px", borderRadius: 10, border: "1px dashed var(--admin-border)", fontSize: 12, color: "var(--admin-muted)", textAlign: "center" }}>
                    Nenhum colaborador cadastrado em /admin/coco/colaboradores ainda.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 110, overflowY: "auto", padding: 8, borderRadius: 10, background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
                    {colaboradoresList.map((col) => {
                      const sel = selectedColaboradores.includes(col.id);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => toggleColaborador(col.id)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 8,
                            border: "1px solid",
                            borderColor: sel ? "#0DB87E" : "var(--admin-border)",
                            background: sel ? "rgba(13,184,126,0.16)" : "transparent",
                            color: sel ? "#0DB87E" : "var(--admin-subtle)",
                            fontSize: 12,
                            fontWeight: sel ? 700 : 500,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <Users size={12} />
                          <span>{col.nome}</span>
                          {sel && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seleção de Bairros + Ordenação Sequencial */}
              <div>
                <label style={labelStyle}>
                  Rotas por Ordem de Coleta — Selecione os Bairros ({orderedBairros.length})
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, maxHeight: 120, overflowY: "auto", padding: 6, borderRadius: 10, background: "var(--admin-bg)", border: "1px solid var(--admin-border)" }}>
                  {BAIRROS_UBATUBA.map((b) => {
                    const idx = orderedBairros.indexOf(b);
                    const sel = idx !== -1;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBairro(b)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid",
                          borderColor: sel ? "#0DB87E" : "var(--admin-border)",
                          background: sel ? "rgba(13,184,126,0.15)" : "transparent",
                          color: sel ? "#0DB87E" : "var(--admin-subtle)",
                          fontSize: 11,
                          fontWeight: sel ? 700 : 500,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {sel ? `${idx + 1}º ` : "+ "}
                        {b}
                      </button>
                    );
                  })}
                </div>

                {/* Lista Ordenada de Coleta com Subir / Descer */}
                {orderedBairros.length > 0 && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(13,184,126,0.06)", border: "1px solid rgba(13,184,126,0.25)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0DB87E", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={12} /> Sequência de Coleta (Use as setas para ordenar)
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 140, overflowY: "auto" }}>
                      {orderedBairros.map((bairro, idx) => (
                        <div
                          key={bairro}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: "var(--admin-bg)",
                            border: "1px solid var(--admin-border)",
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#0DB87E", minWidth: 24 }}>
                              {idx + 1}º
                            </span>
                            <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{bairro}</span>
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveBairro(idx, -1)}
                              title="Subir na ordem"
                              style={{
                                background: "transparent",
                                border: "1px solid var(--admin-border)",
                                borderRadius: 5,
                                padding: 3,
                                color: idx === 0 ? "var(--admin-muted)" : "var(--admin-text)",
                                cursor: idx === 0 ? "not-allowed" : "pointer",
                                opacity: idx === 0 ? 0.4 : 1,
                              }}
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === orderedBairros.length - 1}
                              onClick={() => moveBairro(idx, 1)}
                              title="Descer na ordem"
                              style={{
                                background: "transparent",
                                border: "1px solid var(--admin-border)",
                                borderRadius: 5,
                                padding: 3,
                                color: idx === orderedBairros.length - 1 ? "var(--admin-muted)" : "var(--admin-text)",
                                cursor: idx === orderedBairros.length - 1 ? "not-allowed" : "pointer",
                                opacity: idx === orderedBairros.length - 1 ? 0.4 : 1,
                              }}
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleBairro(bairro)}
                              title="Remover da rota"
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: 3,
                                color: "#E84040",
                                cursor: "pointer",
                              }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
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
                  {submitting
                    ? "Salvando..."
                    : editingCaminhao
                      ? "Salvar Alterações"
                      : "Cadastrar Veículo"}
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
  height: 40,
  padding: "0 12px",
  fontFamily: "DM Sans",
  fontSize: 13,
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
  background: "rgba(0,0,0,0.65)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalBoxStyle = {
  background: "var(--admin-card-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 20,
  padding: 24,
  maxWidth: 560,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto" as const,
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
};

const closeBtnStyle = {
  background: "transparent",
  border: "none",
  color: "var(--admin-muted)",
  cursor: "pointer",
  padding: 4,
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
