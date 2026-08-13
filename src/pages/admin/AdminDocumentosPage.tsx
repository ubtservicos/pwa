import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAdminToast } from "@/components/admin/AdminToast";
import { Card } from "@/components/admin/ui";
import { FileText, Check, X, ExternalLink, ShieldAlert, AlertCircle, Search, Eye, EyeOff } from "lucide-react";

interface DocumentAudit {
  id: string;
  associacao_id: string;
  associacao_nome: string;
  tipo_documento: string;
  status: 'pendente' | 'aprovado' | 'vencido' | 'rejeitado';
  data_validade: string | null;
  url_arquivo: string | null;
  justificativa_rejeicao: string | null;
}

interface GroupedDocs {
  associacao_id: string;
  associacao_nome: string;
  docs: DocumentAudit[];
}

type StatusFilter = 'todos' | 'pendente' | 'aprovado' | 'rejeitado' | 'vencido';

export default function AdminDocumentosPage() {
  const [documents, setDocuments] = useState<DocumentAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  
  // Modal states
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);
  const toast = useAdminToast();

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Fetch documents
      const { data: docs, error: dError } = await supabase
        .from("associacao_documentos")
        .select("*");

      if (dError) throw dError;

      // Fetch profiles to map association names
      const { data: profiles } = await supabase
        .from("associacoes_perfil")
        .select("id, nome_fantasia");

      const profileMap = new Map((profiles || []).map((p) => [p.id, p.nome_fantasia]));

      const mapped = (docs || []).map((d: any) => ({
        ...d,
        associacao_nome: profileMap.get(d.associacao_id) || `Associação B2B (${d.associacao_id.substring(0, 6)})`,
      }));

      setDocuments(mapped);
    } catch (err: any) {
      console.error("Erro ao carregar documentos:", err);
      toast.show("Erro ao carregar documentos das associações.");
      
      // Fallback presentation mock
      setDocuments(getDemoDocuments());
    } finally {
      setLoading(false);
    }
  };

  const getDemoDocuments = (): DocumentAudit[] => [
    {
      id: "1",
      associacao_id: "a1",
      associacao_nome: "Associação de Mototaxistas de Ubatuba",
      tipo_documento: "Ata de Eleição de Diretoria",
      status: "pendente",
      data_validade: "12/12/2027",
      url_arquivo: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      justificativa_rejeicao: null
    },
    {
      id: "2",
      associacao_id: "a2",
      associacao_nome: "Associação Comercial B2B Centro",
      tipo_documento: "Estatuto Social Registrado",
      status: "aprovado",
      data_validade: "31/12/2030",
      url_arquivo: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      justificativa_rejeicao: null
    },
    {
      id: "3",
      associacao_id: "a3",
      associacao_nome: "Sindicato de Hotéis e Pousadas",
      tipo_documento: "Comprovante de CNPJ Ativo",
      status: "rejeitado",
      data_validade: null,
      url_arquivo: null,
      justificativa_rejeicao: "A imagem enviada está ilegível. Por favor, reenvie o PDF oficial do site da Receita."
    },
    {
      id: "4",
      associacao_id: "a1",
      associacao_nome: "Associação de Mototaxistas de Ubatuba",
      tipo_documento: "Comprovante de Inscrição CNPJ",
      status: "aprovado",
      data_validade: null,
      url_arquivo: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      justificativa_rejeicao: null
    },
    {
      id: "5",
      associacao_id: "a2",
      associacao_nome: "Associação Comercial B2B Centro",
      tipo_documento: "Alvará de Funcionamento",
      status: "vencido",
      data_validade: "01/05/2026",
      url_arquivo: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      justificativa_rejeicao: null
    }
  ];

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleApprove = async (docId: string) => {
    try {
      const { error } = await supabase
        .from("associacao_documentos")
        .update({ status: "aprovado", justificativa_rejeicao: null })
        .eq("id", docId);

      if (error) throw error;

      toast.show("Documento aprovado com sucesso! ✔️");
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: "aprovado", justificativa_rejeicao: null } : d))
      );
    } catch (err: any) {
      console.error(err);
      toast.show("Erro ao aprovar documento.");
      // Fallback update state locally for presentation
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: "aprovado", justificativa_rejeicao: null } : d))
      );
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingDocId || !justification.trim()) return;
    setSubmittingReject(true);
    try {
      const { error } = await supabase
        .from("associacao_documentos")
        .update({
          status: "rejeitado",
          justificativa_rejeicao: justification
        })
        .eq("id", rejectingDocId);

      if (error) throw error;

      toast.show("Documento rejeitado com sucesso.");
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === rejectingDocId
            ? { ...d, status: "rejeitado", justificativa_rejeicao: justification }
            : d
        )
      );
      setRejectingDocId(null);
      setJustification("");
    } catch (err: any) {
      console.error(err);
      toast.show("Erro ao rejeitar documento.");
      // Fallback update state locally for presentation
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === rejectingDocId
            ? { ...d, status: "rejeitado", justificativa_rejeicao: justification }
            : d
        )
      );
      setRejectingDocId(null);
      setJustification("");
    } finally {
      setSubmittingReject(false);
    }
  };

  // 1. Filtering logic
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.associacao_nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.tipo_documento.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "todos" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 2. Grouping logic
  const groupedDocs: GroupedDocs[] = [];
  filteredDocs.forEach((doc) => {
    let group = groupedDocs.find((g) => g.associacao_id === doc.associacao_id);
    if (!group) {
      group = {
        associacao_id: doc.associacao_id,
        associacao_nome: doc.associacao_nome,
        docs: []
      };
      groupedDocs.push(group);
    }
    group.docs.push(doc);
  });

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-200 p-6 flex flex-col gap-6" style={{ fontFamily: "DM Sans" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 800 }} className="text-white margin-0">
          Auditoria de Documentos B2B
        </h1>
        <p className="text-zinc-400 text-sm margin-0 mt-1">
          Análise, verificação de validades e controle granular de documentos enviados pelas Associações.
        </p>
      </div>

      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between bg-[#18181B] border border-[#27272A] rounded-2xl p-4">
        {/* Search */}
        <div className="flex items-center gap-3 bg-[#09090B] border border-[#27272A] rounded-xl height-11 px-4 flex-1 max-w-md">
          <Search size={16} className="text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por associação ou documento..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm"
          />
        </div>

        {/* Filter Status Selector */}
        <div className="flex flex-wrap items-center gap-1 bg-[#09090B] border border-[#27272A] p-1 rounded-xl">
          {([
            { key: "todos", label: "Todos" },
            { key: "pendente", label: "Pendentes" },
            { key: "aprovado", label: "Aprovados" },
            { key: "rejeitado", label: "Rejeitados" },
            { key: "vencido", label: "Vencidos" }
          ] as const).map(({ key, label }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? "bg-[#00FF66] text-[#09090B] font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="py-12 text-center text-zinc-500 animate-pulse">
          Buscando documentos cadastrados...
        </div>
      ) : groupedDocs.length === 0 ? (
        <div 
          className="p-12 text-center bg-[#18181B] border border-[#27272A] rounded-2xl text-zinc-400 flex flex-col items-center justify-center"
          style={{ background: '#18181B', border: '1px solid #27272A' }}
        >
          <FileText size={48} className="mb-4 text-[#00FF66]" />
          <p className="font-semibold text-lg text-white margin-0">Nenhum documento retornado do banco</p>
          <p className="text-xs mt-1 text-zinc-500 max-w-sm">
            Nenhum registro corresponde aos filtros atuais. Você pode carregar dados demonstrativos para homologação.
          </p>
          
          <button
            onClick={() => setDocuments(getDemoDocuments())}
            className="mt-6 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#00FF66] text-[#09090B] hover:shadow-lg hover:shadow-[#00FF66]/20 transition-all flex items-center gap-1.5"
          >
            <AlertCircle size={14} />
            Carregar Dados Demonstrativos (Mock)
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedDocs.map((group) => (
            <div
              key={group.associacao_id}
              className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6"
              style={{ background: '#18181B', border: '1px solid #27272A' }}
            >
              {/* Group Header (Association Name) */}
              <div className="flex items-center justify-between border-b border-[#27272A] pb-4 mb-4">
                <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="text-white margin-0">
                  {group.associacao_nome}
                </h3>
                <span className="text-xs bg-[#09090B] border border-[#27272A] px-2.5 py-1 rounded-full text-zinc-400">
                  {group.docs.length} {group.docs.length === 1 ? "documento" : "documentos"}
                </span>
              </div>

              {/* Rows inside Association Card */}
              <div className="flex flex-col gap-3">
                {group.docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#09090B] border border-[#27272A] transition-all hover:border-zinc-800"
                  >
                    {/* Document details (left) */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans font-semibold text-[14px] text-zinc-200">
                          {doc.tipo_documento}
                        </span>
                        
                        {doc.status === "aprovado" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Aprovado
                          </span>
                        )}
                        {doc.status === "pendente" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            Pendente
                          </span>
                        )}
                        {doc.status === "rejeitado" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            Rejeitado
                          </span>
                        )}
                        {doc.status === "vencido" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/20 animate-pulse">
                            Vencido
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-col gap-1 text-xs text-zinc-500">
                        {doc.data_validade && (
                          <p className="margin-0">
                            Validade: {doc.data_validade}
                          </p>
                        )}
                        {doc.justificativa_rejeicao && (
                          <div className="mt-2 p-2.5 bg-red-500/5 border border-red-500/10 rounded-lg text-red-400 flex items-start gap-1.5 max-w-xl">
                            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                            <span><strong>Justificativa da Rejeição:</strong> {doc.justificativa_rejeicao}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions panel (right) */}
                    <div className="flex items-center gap-2 self-start md:self-center">
                      {/* Document visualizer */}
                      {doc.url_arquivo ? (
                        <a
                          href={doc.url_arquivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] hover:bg-white/5 transition-all text-xs font-semibold text-white flex items-center gap-1.5"
                          title="Visualizar documento em nova aba"
                        >
                          <Eye size={14} />
                          Visualizar Documento
                        </a>
                      ) : (
                        <button
                          disabled
                          className="px-3.5 py-2 rounded-xl bg-zinc-800/30 border border-zinc-800 text-zinc-500 text-xs font-semibold flex items-center gap-1.5 cursor-not-allowed"
                          title="Sem documento anexo"
                        >
                          <EyeOff size={14} />
                          Sem anexo
                        </button>
                      )}

                      {/* Approval triggers */}
                      {doc.status !== "aprovado" && (
                        <button
                          onClick={() => handleApprove(doc.id)}
                          className="p-2.5 rounded-xl bg-[#00FF66] text-[#09090B] hover:shadow-lg hover:shadow-[#00FF66]/20 transition-all"
                          title="Aprovar Documento"
                        >
                          <Check size={14} />
                        </button>
                      )}

                      {/* Rejection triggers */}
                      {doc.status !== "rejeitado" && (
                        <button
                          onClick={() => setRejectingDocId(doc.id)}
                          className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all"
                          title="Rejeitar Documento"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal Dialog - 100% Dark Mode aligned */}
      {rejectingDocId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl w-full max-w-md p-6 relative">
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="text-white flex items-center gap-2 mb-4">
              <ShieldAlert className="text-red-400" size={20} /> Justificativa da Rejeição
            </h3>
            
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Escreva o motivo detalhado pelo qual este documento está sendo rejeitado. A associação receberá este feedback para providenciar o reenvio.
            </p>

            <textarea
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva o motivo (Ex: Imagem cortada, Ata expirada, etc.)..."
              className="w-full bg-[#09090B] border border-[#27272A] rounded-xl p-3 text-sm text-white focus:border-red-400 outline-none resize-none font-sans"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectingDocId(null);
                  setJustification("");
                }}
                disabled={submittingReject}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-transparent border border-[#27272A] hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={submittingReject || !justification.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EF4444] text-white hover:bg-red-600 transition-all disabled:opacity-40"
              >
                {submittingReject ? "Processando..." : "Confirmar Rejeição"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
