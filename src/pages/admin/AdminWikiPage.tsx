import React, { useState, useEffect } from "react";
import { 
  Folder, 
  FileText, 
  Search, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  BookOpen,
  Plus,
  Edit3,
  CheckCircle,
  Eye,
  Settings
} from "lucide-react";
import { Card, PageTitle, Pill, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";

interface WikiArea {
  id: string;
  nome: string;
  descricao: string;
  permission_code: string;
}

interface WikiDocument {
  id: string;
  area_nome: string;
  slug: string;
  titulo: string;
  conteudo: string;
  classificacao: 'PUBLIC_INTERNAL' | 'RESTRICTED' | 'CONFIDENTIAL' | 'SUPERADMIN_ONLY';
  ai_allowed: boolean;
  version: string;
  updated_at: string;
}

// Simple helper to parse basic markdown to JSX
function parseMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    if (line.startsWith("# ")) {
      return <h1 key={idx} style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", marginTop: 16, marginBottom: 12 }}>{line.substring(2)}</h1>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={idx} style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#1E293B", marginTop: 14, marginBottom: 10 }}>{line.substring(3)}</h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={idx} style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#334155", marginTop: 12, marginBottom: 8 }}>{line.substring(4)}</h3>;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return <li key={idx} style={{ fontFamily: "DM Sans", fontSize: 14, color: "#334155", marginLeft: 16, marginBottom: 4 }}>{line.substring(2)}</li>;
    }
    if (line.trim() === "") {
      return <div key={idx} style={{ height: 8 }} />;
    }
    return <p key={idx} style={{ fontFamily: "DM Sans", fontSize: 14, color: "#475569", lineHeight: "1.6", margin: "4px 0" }}>{line}</p>;
  });
}

export default function AdminWikiPage() {
  const toast = useAdminToast();
  const { userRole, hasPermission } = usePermissions();
  
  const [areas, setAreas] = useState<WikiArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<WikiArea | null>(null);
  const [documents, setDocuments] = useState<{ slug: string; titulo: string }[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<WikiDocument | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Editor states (Admin/Superadmin only)
  const isEditor = userRole === "super_admin" || userRole === "admin";
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editClassification, setEditClassification] = useState<WikiDocument["classificacao"]>("PUBLIC_INTERNAL");
  const [editAiAllowed, setEditAiAllowed] = useState(false);

  useEffect(() => {
    loadAreas();
  }, []);

  const loadAreas = async () => {
    setLoadingAreas(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase
        .from("wiki_areas")
        .select("*")
        .order("nome", { ascending: true });
      
      if (error) throw error;
      setAreas(data || []);
      if (data && data.length > 0) {
        setSelectedArea(data[0]);
        loadDocumentsList(data[0].id);
      }
    } catch (err: any) {
      console.error("Erro ao carregar áreas da Wiki:", err);
      setErrorMsg("Acesso Negado — Apenas colaboradores autorizados pelo RBAC podem visualizar a Wiki.");
    } finally {
      setLoadingAreas(false);
    }
  };

  const loadDocumentsList = async (areaId: string) => {
    try {
      setSelectedDoc(null);
      const { data, error } = await supabase
        .from("wiki_documents")
        .select("slug, titulo")
        .eq("area_id", areaId)
        .order("titulo", { ascending: true });
      
      if (error) throw error;
      setDocuments(data || []);
      if (data && data.length > 0) {
        loadDocumentContent(data[0].slug);
      }
    } catch (err) {
      console.error("Erro ao carregar lista de documentos:", err);
    }
  };

  const loadDocumentContent = async (slug: string) => {
    if (!selectedArea) return;
    setLoadingDoc(true);
    setErrorMsg("");
    try {
      // Execute the secure get_wiki_document RPC to enforce server-side RLS policies and log view audit event
      const { data, error } = await supabase
        .rpc("get_wiki_document", {
          p_area_nome: selectedArea.nome,
          p_doc_slug: slug
        });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setSelectedDoc(data[0] as WikiDocument);
      }
    } catch (err: any) {
      console.error("Erro ao carregar conteúdo do documento:", err);
      setErrorMsg(err?.message || "Acesso negado para este documento (ACL restrita).");
      setSelectedDoc(null);
    } finally {
      setLoadingDoc(false);
    }
  };

  const handleAreaSelect = (area: WikiArea) => {
    setSelectedArea(area);
    loadDocumentsList(area.id);
  };

  const handleSaveDocument = async () => {
    if (!selectedArea) return;
    
    try {
      if (creating) {
        const slug = editTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const { error } = await supabase
          .from("wiki_documents")
          .insert({
            area_id: selectedArea.id,
            slug,
            titulo: editTitle,
            conteudo: editContent,
            classificacao: editClassification,
            ai_allowed: editAiAllowed
          });
        if (error) throw error;
        toast.show("Artigo criado com sucesso!");
        setCreating(false);
        loadDocumentsList(selectedArea.id);
      } else if (selectedDoc) {
        const { error } = await supabase
          .from("wiki_documents")
          .update({
            titulo: editTitle,
            conteudo: editContent,
            classificacao: editClassification,
            ai_allowed: editAiAllowed,
            updated_at: new Date().toISOString()
          })
          .eq("id", selectedDoc.id);
        if (error) throw error;
        toast.show("Artigo atualizado com sucesso!");
        setEditing(false);
        loadDocumentContent(selectedDoc.slug);
      }
    } catch (err: any) {
      console.error("Erro ao gravar documento:", err);
      toast.show(err.message || "Erro ao gravar dados.");
    }
  };

  const startEdit = () => {
    if (!selectedDoc) return;
    setEditTitle(selectedDoc.titulo);
    setEditContent(selectedDoc.conteudo);
    setEditClassification(selectedDoc.classificacao);
    setEditAiAllowed(selectedDoc.ai_allowed);
    setEditing(true);
    setCreating(false);
  };

  const startCreate = () => {
    setEditTitle("");
    setEditContent("");
    setEditClassification("PUBLIC_INTERNAL");
    setEditAiAllowed(false);
    setCreating(true);
    setEditing(false);
  };

  const filteredAreas = areas.filter(a => 
    a.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.descricao.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: 24, minHeight: "calc(100vh - 64px)", background: "#F8FAFC" }}>
      <div style={{ display: "flex", justifyBetween: "space-between", alignItems: "center", marginBottom: 20 }}>
        <PageTitle sub="Wiki oficial e base de conhecimento integrada sob restrição granular ACL">
          UBT Wiki / Conhecimento
        </PageTitle>

        {isEditor && selectedArea && (
          <PrimaryButton onClick={startCreate} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={16} /> Novo Artigo
          </PrimaryButton>
        )}
      </div>

      {loadingAreas ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "DM Sans", color: "#94A3B8" }}>
          Carregando base de conhecimento (RBAC)...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
          {/* Left Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Search Bar */}
            <div style={{ position: "relative" }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: 12 }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pastas da wiki..."
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

            {/* Folder list */}
            <Card style={{ padding: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", padding: "0 8px 8px 8px", display: "block" }}>
                Pastas (/wiki)
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredAreas.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleAreaSelect(a)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: selectedArea?.id === a.id ? "rgba(13,184,126,0.08)" : "transparent",
                      color: selectedArea?.id === a.id ? "#0DB87E" : "#475569",
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: selectedArea?.id === a.id ? 600 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Folder size={16} color={selectedArea?.id === a.id ? "#0DB87E" : "#94A3B8"} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.nome}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Document list inside selected area */}
            {selectedArea && (
              <Card style={{ padding: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", padding: "0 8px 8px 8px", display: "block" }}>
                  Artigos
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {documents.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94A3B8", padding: "8px 12px", fontStyle: "italic" }}>
                      Sem artigos publicados
                    </div>
                  ) : (
                    documents.map((d) => (
                      <button
                        key={d.slug}
                        onClick={() => loadDocumentContent(d.slug)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          background: selectedDoc?.slug === d.slug ? "#F1F5F9" : "transparent",
                          color: selectedDoc?.slug === d.slug ? "#0F172A" : "#64748B",
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <FileText size={14} color={selectedDoc?.slug === d.slug ? "#475569" : "#CBD5E1"} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.titulo}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Right Main Content Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {errorMsg ? (
              <Card style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", background: "#FFF5F5", border: "1px solid #FEB2B2" }}>
                <AlertTriangle size={32} color="#E53E3E" style={{ marginBottom: 12 }} />
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#C53030", margin: 0 }}>
                  Acesso Negado
                </h3>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#9B2C2C", marginTop: 8, maxWidth: 460 }}>
                  {errorMsg}
                </p>
              </Card>
            ) : editing || creating ? (
              <Card style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>
                  {creating ? "Criar Novo Artigo" : `Editar Artigo: ${editTitle}`}
                </h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>Título do Artigo</label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Ex: Guia de Devolução Financeira"
                      style={{ width: "100%", height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 12px", outline: "none", fontSize: 13, fontFamily: "DM Sans" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>Conteúdo (Markdown)</label>
                    <textarea
                      rows={12}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="# Título do Artigo..."
                      style={{ width: "100%", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px", outline: "none", fontSize: 13, fontFamily: "monospace" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 }}>Classificação de Acesso</label>
                      <select
                        value={editClassification}
                        onChange={(e) => setEditClassification(e.target.value as any)}
                        style={{ width: "100%", height: 38, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 8px", outline: "none", fontSize: 13, fontFamily: "DM Sans" }}
                      >
                        <option value="PUBLIC_INTERNAL">PUBLIC_INTERNAL (Todos os colaboradores)</option>
                        <option value="RESTRICTED">RESTRICTED (Operadores / N2)</option>
                        <option value="CONFIDENTIAL">CONFIDENTIAL (Diretoria / Sócios)</option>
                        <option value="SUPERADMIN_ONLY">SUPERADMIN_ONLY (Superadmin apenas)</option>
                      </select>
                    </div>

                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
                      <input
                        type="checkbox"
                        id="ai_allowed_check"
                        checked={editAiAllowed}
                        onChange={(e) => setEditAiAllowed(e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      <label htmlFor="ai_allowed_check" style={{ fontSize: 13, fontWeight: 500, color: "#475569", cursor: "pointer" }}>
                        Publicar em AI Knowledge (WhatsApp)
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <GhostButton onClick={() => { setEditing(false); setCreating(false); }}>
                      Cancelar
                    </GhostButton>
                    <PrimaryButton onClick={handleSaveDocument}>
                      Gravar Artigo
                    </PrimaryButton>
                  </div>
                </div>
              </Card>
            ) : selectedDoc ? (
              <Card style={{ padding: 32 }}>
                {/* Meta details header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #F1F5F9", paddingBottom: 16, marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>
                      {selectedDoc.titulo}
                    </h2>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                      <Pill bg="rgba(43,110,232,0.1)" color="#2B6EE8" size="sm">
                        v{selectedDoc.version}
                      </Pill>
                      <Pill 
                        bg={selectedDoc.classificacao === "SUPERADMIN_ONLY" ? "rgba(232,64,64,0.1)" : selectedDoc.classificacao === "CONFIDENTIAL" ? "rgba(245,166,35,0.1)" : "rgba(13,184,126,0.1)"} 
                        color={selectedDoc.classificacao === "SUPERADMIN_ONLY" ? "#E84040" : selectedDoc.classificacao === "CONFIDENTIAL" ? "#F5A623" : "#0DB87E"}
                        size="sm"
                      >
                        {selectedDoc.classificacao}
                      </Pill>
                      {selectedDoc.ai_allowed ? (
                        <Pill bg="rgba(13,184,126,0.12)" color="#0DB87E" size="sm">
                          🤖 Publicado para IA
                        </Pill>
                      ) : (
                        <Pill bg="#F1F5F9" color="#64748B" size="sm">
                          Interno Apenas
                        </Pill>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    {isEditor && (
                      <GhostButton onClick={startEdit} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Edit3 size={14} /> Editar
                      </GhostButton>
                    )}
                  </div>
                </div>

                {/* Rendered content panel */}
                <div style={{ minHeight: 200 }}>
                  {parseMarkdown(selectedDoc.conteudo)}
                </div>

                <div style={{ marginTop: 32, borderTop: "1px solid #F1F5F9", paddingTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8", fontFamily: "DM Sans" }}>
                  <span>Atualizado em: {new Date(selectedDoc.updated_at).toLocaleString("pt-BR")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Unlock size={12} /> Protegido por RLS (Audit Trail Ativo)
                  </span>
                </div>
              </Card>
            ) : (
              <Card style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#94A3B8" }}>
                <BookOpen size={48} color="#CBD5E1" style={{ marginBottom: 16 }} />
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#475569", margin: 0 }}>
                  Selecione um Artigo
                </h3>
                <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", marginTop: 8, maxWidth: 360 }}>
                  Navegue pelas pastas e selecione um documento na barra lateral para visualizar seu conteúdo estruturado.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
