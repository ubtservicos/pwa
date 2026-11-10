import { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Search, 
  Copy, 
  Check, 
  Building2, 
  Eye, 
  RefreshCw, 
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { maskCNPJ, maskPhone, maskCPF, generateReferralSlug } from "@/utils/masks";

export interface EntidadeItem {
  id: string;
  name: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  responsavelNome: string;
  responsavelCpf: string;
  telefone: string;
  email: string;
  cadastroCompleto: boolean;
  status: string;
  referralSlug: string;
  chavePix: string;
  tipoChavePix: string;
  possuiMp: boolean;
  bairros: string[];
  praias: string[];
  waitlistId?: string;
  metadata?: any;
  createdAt: string;
  padrinhoId?: string | null;
  padrinhoNome?: string | null;
  padrinhoRole?: string | null;
}

const cleanPhoneDigits = (phone?: string | null) => {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
};

const getAppOrigin = () => {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "https://ubtservicos.vercel.app";
};

export default function AdminEntidadesPage() {
  const toast = useAdminToast();
  const [entidades, setEntidades] = useState<EntidadeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completo" | "incompleto">("all");

  // Modal de Detalhes
  const [selectedEntidade, setSelectedEntidade] = useState<EntidadeItem | null>(null);
  const [customSlugInput, setCustomSlugInput] = useState("");
  const [isSavingCustomSlug, setIsSavingCustomSlug] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Sincroniza slug quando seleciona entidade
  useEffect(() => {
    if (selectedEntidade) {
      setCustomSlugInput(selectedEntidade.referralSlug || "");
      setCopiedLink(null);
    }
  }, [selectedEntidade]);

  // Carrega entidades do Supabase
  const fetchEntidades = async () => {
    setLoading(true);
    try {
      // 1. Busca usuários com role associacao ou metadata PJ
      const { data: rawUsers, error: errUsers } = await supabase
        .from("usuarios")
        .select("*")
        .or("role.eq.associacao,metadata->>tipo_cadastro.eq.pj")
        .order("created_at", { ascending: false });

      if (errUsers) throw errUsers;

      // 2. Busca waitlist para correlação de dados complementares
      const { data: rawWaitlist, error: errWaitlist } = await supabase
        .from("waitlist")
        .select("*");

      if (errWaitlist) throw errWaitlist;

      // 3. Resolução de Padrinhos
      const padrinhoIds = Array.from(new Set([
        ...(rawUsers || []).map((u: any) => u.padrinho_id),
        ...(rawWaitlist || []).map((w: any) => w.padrinho_id)
      ].filter(Boolean)));

      const padrinhoMap = new Map<string, any>();
      if (padrinhoIds.length > 0) {
        const { data: padrinhosData } = await supabase
          .from("usuarios")
          .select("id, nome, razao_social, role, tipo_pessoa")
          .in("id", padrinhoIds);
        (padrinhosData || []).forEach((p: any) => padrinhoMap.set(p.id, p));
      }

      // Mapas auxiliares para correlação
      const wlPhoneMap = new Map<string, any>();
      const wlCnpjMap = new Map<string, any>();
      const wlUserIdMap = new Map<string, any>();

      (rawWaitlist || []).forEach((w: any) => {
        const cleanTel = cleanPhoneDigits(w.telefone);
        const cleanDoc = String(w.cnpj || "").replace(/\D/g, "");
        if (cleanTel) wlPhoneMap.set(cleanTel, w);
        if (cleanDoc) wlCnpjMap.set(cleanDoc, w);
        if (w.user_id) wlUserIdMap.set(w.user_id, w);
        if (w.id) wlUserIdMap.set(w.id, w);
      });

      // Mapeamento e unificação dos registros
      const mappedList: EntidadeItem[] = (rawUsers || []).map((u: any) => {
        const cleanTel = cleanPhoneDigits(u.telefone || u.phone);
        const cleanDoc = String(u.cnpj || u.metadata?.cnpj || "").replace(/\D/g, "");
        const matchedWl = wlUserIdMap.get(u.id) || (cleanDoc ? wlCnpjMap.get(cleanDoc) : null) || (cleanTel ? wlPhoneMap.get(cleanTel) : null);

        const razaoSocial = u.razao_social || u.metadata?.razao_social || matchedWl?.razao_social || u.nome || "Entidade Sem Razão Social";
        const nomeFantasia = u.nome || matchedWl?.nome || matchedWl?.nome_fantasia || razaoSocial;
        const cnpjVal = cleanDoc || String(matchedWl?.cnpj || "").replace(/\D/g, "");
        const responsavelNome = u.responsavel_legal || u.responsavel_nome || matchedWl?.responsavel_nome || matchedWl?.responsavel_legal || "Não informado";
        const responsavelCpf = u.cpf_responsavel || matchedWl?.responsavel_cpf || matchedWl?.cpf_responsavel || u.cpf || "";
        const telefoneVal = u.telefone || matchedWl?.telefone || "";
        const emailVal = u.email || matchedWl?.email || "Não informado";
        const isCompleto = u.cadastro_completo === true || u.metadata?.cadastro_completo === true || matchedWl?.cadastro_completo === true;
        const statusVal = u.status === "ativo" || u.status === "active" ? "ativo" : (u.status || "ativo");

        const referralSlug = matchedWl?.referral_code || matchedWl?.referral_slug || matchedWl?.slug || u.referral_code || u.metadata?.referral_code || generateReferralSlug(nomeFantasia || razaoSocial, cnpjVal || u.id);
        const padId = u.padrinho_id || matchedWl?.padrinho_id || null;
        const pObj = padId ? padrinhoMap.get(padId) : null;
        const padNome = pObj ? (pObj.nome || pObj.razao_social || "Padrinho") : null;
        const padRole = pObj?.role === "associacao" || pObj?.tipo_pessoa === "PJ" ? "PJ" : "PF";

        return {
          id: u.id,
          name: nomeFantasia,
          razaoSocial,
          nomeFantasia,
          cnpj: cnpjVal,
          responsavelNome,
          responsavelCpf,
          telefone: telefoneVal,
          email: emailVal,
          cadastroCompleto: isCompleto,
          status: statusVal,
          referralSlug,
          chavePix: matchedWl?.pix_chave || matchedWl?.chave_pix || u.chave_pix || "",
          tipoChavePix: matchedWl?.pix_tipo || matchedWl?.tipo_chave_pix || u.tipo_chave_pix || "",
          possuiMp: Boolean(matchedWl?.possui_mp || matchedWl?.possui_mercado_pago),
          bairros: matchedWl?.bairros_atuacao || matchedWl?.bairros || u.bairros_atuacao || [],
          praias: matchedWl?.praias || u.praias || [],
          waitlistId: matchedWl?.id,
          metadata: u.metadata || {},
          createdAt: u.created_at || matchedWl?.created_at_utc || new Date().toISOString(),
          padrinhoId: padId,
          padrinhoNome: padNome,
          padrinhoRole: padRole,
        };
      });

      // Se houver leads na waitlist que foram aprovados como PJ mas ainda não constam na lista
      (rawWaitlist || []).forEach((w: any) => {
        const isPJ = w.tipo_cadastro === "pj" || w.tipo_cadastro === "PJ" || w.tipo_cadastro === "associacao" || Boolean(w.cnpj) || Boolean(w.razao_social);
        const isApproved = w.status === "aprovado" || w.status === "approved" || w.cadastro_completo === true;
        
        if (isPJ && isApproved) {
          const cleanTel = cleanPhoneDigits(w.telefone);
          const cleanDoc = String(w.cnpj || "").replace(/\D/g, "");
          const alreadyExists = mappedList.some(item => 
            (cleanTel && cleanPhoneDigits(item.telefone) === cleanTel) || 
            (cleanDoc && cleanPhoneDigits(item.cnpj) === cleanDoc)
          );

          if (!alreadyExists) {
            const rSocial = w.razao_social || w.nome || "Entidade Sem Razão Social";
            const nFantasia = w.nome || w.nome_fantasia || rSocial;
            const wPadId = w.padrinho_id || null;
            const wPObj = wPadId ? padrinhoMap.get(wPadId) : null;
            const wPadNome = wPObj ? (wPObj.nome || wPObj.razao_social || "Padrinho") : null;
            const wPadRole = wPObj?.role === "associacao" || wPObj?.tipo_pessoa === "PJ" ? "PJ" : "PF";
            mappedList.push({
              id: w.user_id || w.id,
              name: nFantasia,
              razaoSocial: rSocial,
              nomeFantasia: nFantasia,
              cnpj: cleanDoc,
              responsavelNome: w.responsavel_nome || w.responsavel_legal || "Não informado",
              responsavelCpf: w.responsavel_cpf || w.cpf_responsavel || "",
              telefone: w.telefone || "",
              email: w.email || "Não informado",
              cadastroCompleto: Boolean(w.cadastro_completo),
              status: "ativo",
              referralSlug: w.referral_code || w.referral_slug || w.slug || generateReferralSlug(nFantasia, cleanDoc || w.id),
              chavePix: w.pix_chave || w.chave_pix || "",
              tipoChavePix: w.pix_tipo || w.tipo_chave_pix || "",
              possuiMp: Boolean(w.possui_mp || w.possui_mercado_pago),
              bairros: w.bairros_atuacao || w.bairros || [],
              praias: w.praias || [],
              waitlistId: w.id,
              metadata: w.metadata || {},
              createdAt: w.created_at_utc || new Date().toISOString(),
              padrinhoId: wPadId,
              padrinhoNome: wPadNome,
              padrinhoRole: wPadRole,
            });
          }
        }
      });

      setEntidades(mappedList);
    } catch (err: any) {
      console.error("Erro ao buscar entidades:", err);
      toast.show("Erro ao carregar entidades.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntidades();
  }, []);

  // Filtro de Busca
  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return entidades.filter((e) => {
      const matchStatus = 
        filterStatus === "all" ||
        (filterStatus === "completo" && e.cadastroCompleto) ||
        (filterStatus === "incompleto" && !e.cadastroCompleto);

      if (!matchStatus) return false;
      if (!ql) return true;

      const cleanQ = ql.replace(/\D/g, "");
      const matchCnpj = cleanQ && cleanPhoneDigits(e.cnpj).includes(cleanQ);
      const matchTel = cleanQ && cleanPhoneDigits(e.telefone).includes(cleanQ);
      const matchText = 
        e.name.toLowerCase().includes(ql) ||
        e.razaoSocial.toLowerCase().includes(ql) ||
        e.email.toLowerCase().includes(ql) ||
        e.responsavelNome.toLowerCase().includes(ql) ||
        e.referralSlug.toLowerCase().includes(ql);

      return matchCnpj || matchTel || matchText;
    });
  }, [entidades, q, filterStatus]);

  // Função para copiar links com feedback
  const handleCopyLink = async (text: string, type: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedLink(type);
      toast.show("Link copiado com sucesso!");
      setTimeout(() => setCopiedLink(null), 2500);
    } catch (e) {
      console.error(e);
      toast.show("Erro ao copiar link.");
    }
  };

  // Função para salvar Vanity Slug
  const handleSaveSlug = async () => {
    if (!selectedEntidade) return;
    const clean = customSlugInput.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    if (!clean) {
      toast.show("Informe um código de indicação válido.");
      return;
    }
    setIsSavingCustomSlug(true);
    try {
      const phoneDigits = cleanPhoneDigits(selectedEntidade.telefone);
      
      // Atualiza waitlist
      if (selectedEntidade.waitlistId) {
        await supabase.from("waitlist").update({ referral_code: clean, referral_slug: clean, slug: clean }).eq("id", selectedEntidade.waitlistId);
      } else if (phoneDigits) {
        await supabase.from("waitlist").update({ referral_code: clean, referral_slug: clean, slug: clean }).or(`telefone.eq.${phoneDigits},telefone.eq.${selectedEntidade.telefone}`);
      }

      // Atualiza usuarios
      if (selectedEntidade.id) {
        await supabase.from("usuarios").update({
          referral_code: clean,
          metadata: { ...(selectedEntidade.metadata || {}), referral_code: clean }
        }).eq("id", selectedEntidade.id);
      }

      setSelectedEntidade((prev) => prev ? { ...prev, referralSlug: clean } : null);
      setEntidades((prev) => prev.map((ent) => ent.id === selectedEntidade.id ? { ...ent, referralSlug: clean } : ent));
      toast.show("Código de indicação (vanity slug) salvo com sucesso!");
    } catch (e) {
      console.error(e);
      toast.show("Erro ao salvar código de indicação.");
    } finally {
      setIsSavingCustomSlug(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      {/* Topo / Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Building2 size={24} color="#0DB87E" />
            <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Entidades & Associações (PJ)
            </h1>
            <span style={{ fontSize: 12, background: "rgba(13,184,126,0.12)", color: "#0DB87E", padding: "3px 8px", borderRadius: 999, fontWeight: 600 }}>
              {filtered.length} {filtered.length === 1 ? "entidade" : "entidades"}
            </span>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--admin-subtle)" }}>
            Gestão de associações, ONGs e pessoas jurídicas credenciadas para participação e repasse solidário.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={fetchEntidades}
            disabled={loading}
            title="Recarregar dados"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              background: "var(--admin-bg)",
              color: "var(--admin-text)",
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
          <input
            type="text"
            placeholder="Buscar por nome, razão social, CNPJ, telefone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              width: "100%",
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 8,
              padding: "9px 12px 9px 36px",
              fontFamily: "DM Sans",
              fontSize: 13,
              color: "var(--admin-text)",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "completo", "incompleto"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid var(--admin-border)",
                background: filterStatus === st ? "rgba(13,184,126,0.15)" : "var(--admin-bg)",
                color: filterStatus === st ? "#0DB87E" : "var(--admin-subtle)",
                fontWeight: filterStatus === st ? 700 : 500,
                fontSize: 12,
                cursor: "pointer",
                transition: "all 0.15s ease",
                textTransform: "capitalize",
              }}
            >
              {st === "all" ? "Todos os Cadastros" : st === "completo" ? "Completos" : "Incompletos"}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Entidades */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--admin-bg)" }}>
              <tr>
                {[
                  "ENTIDADE / RAZÃO SOCIAL",
                  "CNPJ",
                  "RESPONSÁVEL LEGAL",
                  "CONTATO",
                  "CADASTRO",
                  "STATUS",
                  "AÇÕES"
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 18px",
                      fontFamily: "DM Sans",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--admin-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40, color: "var(--admin-subtle)" }}>
                    Carregando entidades cadastradas...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 48, color: "var(--admin-subtle)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Building2 size={32} color="var(--admin-muted)" />
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--admin-text)" }}>
                        Nenhuma entidade encontrada
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {q ? "Nenhum resultado corresponde à sua pesquisa." : "Ainda não existem entidades cadastradas ou aprovadas."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr 
                    key={e.id} 
                    style={{ 
                      borderBottom: "1px solid var(--admin-border)",
                      transition: "background 0.15s ease",
                    }}
                    className="hover:bg-zinc-900/40"
                  >
                    {/* ENTIDADE / RAZÃO SOCIAL */}
                    <td style={{ padding: "14px 18px", minWidth: 220 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 700, color: "var(--admin-text)" }}>
                          {e.nomeFantasia || e.razaoSocial}
                        </span>
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider">
                          PJ
                        </span>
                      </div>
                      {e.razaoSocial && e.razaoSocial !== e.nomeFantasia && (
                        <div style={{ fontSize: 12, color: "var(--admin-subtle)", marginTop: 1 }}>
                          {e.razaoSocial}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 1 }}>
                        {e.email}
                      </div>
                    </td>

                    {/* CNPJ */}
                    <td style={{ padding: "14px 18px", fontFamily: "monospace", fontSize: 13, color: "var(--admin-text)", whiteSpace: "nowrap" }}>
                      {maskCNPJ(e.cnpj)}
                    </td>

                    {/* RESPONSÁVEL LEGAL */}
                    <td style={{ padding: "14px 18px", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-text)" }}>
                      <div>{e.responsavelNome}</div>
                      {e.responsavelCpf && (
                        <div style={{ fontSize: 11, color: "var(--admin-muted)", fontFamily: "monospace" }}>
                          CPF: {maskCPF(e.responsavelCpf)}
                        </div>
                      )}
                    </td>

                    {/* CONTATO */}
                    <td style={{ padding: "14px 18px", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-text)", whiteSpace: "nowrap" }}>
                      {maskPhone(e.telefone)}
                    </td>

                    {/* CADASTRO (STATUS) */}
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                      {e.cadastroCompleto ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 size={12} /> Completo
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1">
                          <AlertCircle size={12} /> Incompleto
                        </span>
                      )}
                    </td>

                    {/* STATUS OPERACIONAL */}
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: e.status === "ativo" || e.status === "active" ? "rgba(13,184,126,0.12)" : "rgba(245,158,11,0.12)",
                          color: e.status === "ativo" || e.status === "active" ? "#0DB87E" : "#F59E0B",
                        }}
                      >
                        {e.status === "ativo" || e.status === "active" ? "Ativo" : "Pendente"}
                      </span>
                    </td>

                    {/* AÇÕES */}
                    <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => setSelectedEntidade(e)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: "var(--admin-surface)",
                          border: "1px solid var(--admin-border)",
                          color: "#0DB87E",
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          padding: "6px 12px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        className="hover:border-emerald-500 hover:bg-emerald-500/10"
                      >
                        <Eye size={13} />
                        <span>Detalhes</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE DETALHES DA ENTIDADE */}
      {selectedEntidade && (
        <>
          <div 
            onClick={() => setSelectedEntidade(null)} 
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, backdropFilter: "blur(2px)" }} 
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--admin-surface)",
              border: "1px solid var(--admin-border)",
              borderRadius: 16,
              padding: 24,
              width: 580,
              maxWidth: "94vw",
              maxHeight: "90vh",
              overflowY: "auto",
              zIndex: 70,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* Cabeçalho do Modal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, borderBottom: "1px solid var(--admin-border)", paddingBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(13,184,126,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
                  <Building2 size={24} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <h2 style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                      {selectedEntidade.nomeFantasia || selectedEntidade.razaoSocial}
                    </h2>
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      PJ
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--admin-subtle)", marginTop: 2 }}>
                    ID: {selectedEntidade.id}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedEntidade(null)}
                aria-label="Fechar"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "var(--admin-subtle)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Grid de Dados Estruturados */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Razão Social
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)", fontWeight: 600 }}>
                  {selectedEntidade.razaoSocial}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Nome Fantasia
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)", fontWeight: 600 }}>
                  {selectedEntidade.nomeFantasia || "—"}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  CNPJ
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)", fontFamily: "monospace", fontWeight: 600 }}>
                  {maskCNPJ(selectedEntidade.cnpj)}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Responsável Legal
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)", fontWeight: 600 }}>
                  {selectedEntidade.responsavelNome}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  CPF do Responsável
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)", fontFamily: "monospace" }}>
                  {maskCPF(selectedEntidade.responsavelCpf)}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Telefone / WhatsApp
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)" }}>
                  {maskPhone(selectedEntidade.telefone)}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  E-mail Oficial
                </span>
                <span style={{ fontSize: 13, color: "var(--admin-text)", wordBreak: "break-all" }}>
                  {selectedEntidade.email}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Status do Cadastro
                </span>
                <div style={{ marginTop: 2 }}>
                  {selectedEntidade.cadastroCompleto ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 size={12} /> Completo
                    </span>
                  ) : (
                    <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1">
                      <AlertCircle size={12} /> Incompleto
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                  Padrinho / Indicado por
                </span>
                <div style={{ marginTop: 2 }}>
                  {selectedEntidade.padrinhoNome ? (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1.5">
                      🤝 {selectedEntidade.padrinhoNome} ({selectedEntidade.padrinhoRole})
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-xs italic">
                      Direto (Sem Padrinho)
                    </span>
                  )}
                </div>
              </div>

              {selectedEntidade.chavePix && (
                <div style={{ gridColumn: "1 / -1", background: "var(--admin-bg)", padding: 10, borderRadius: 8, border: "1px solid var(--admin-border)" }}>
                  <span style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 600, display: "block" }}>
                    Chave Pix ({selectedEntidade.tipoChavePix || "Pix"})
                  </span>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "#0DB87E", fontWeight: 600 }}>
                    {selectedEntidade.chavePix}
                  </span>
                </div>
              )}
            </div>

            {/* SEÇÃO: AÇÕES E LINKS OPERACIONAIS */}
            <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 11, color: "var(--admin-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.6 }}>
                Ações e Links Operacionais
              </div>

              {/* 1. Link de Atualização Cadastral (Fluxo Geográfico PJ) */}
              {(() => {
                const telLimpo = cleanPhoneDigits(selectedEntidade.telefone);
                const linkAtualizacao = `${getAppOrigin()}/atualizacao-cadastral?tel=${telLimpo}`;
                const nomeEntidade = selectedEntidade.nomeFantasia || selectedEntidade.razaoSocial;
                const waMsg = `Olá, equipe da ${nomeEntidade}! Aqui é da coordenação UBT Serviços. Para dar continuidade ao cadastro da entidade e configuração das regiões/praias de atuação, acesse este link seguro: ${linkAtualizacao}`;
                const formattedPhone = telLimpo.length >= 10 && !telLimpo.startsWith("55") ? `55${telLimpo}` : telLimpo;
                const waLink = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(waMsg)}`;

                return (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>1. Link de Atualização Cadastral (Fluxo Geográfico PJ):</span>
                      {telLimpo ? (
                        <span style={{ fontSize: 10, color: "#0DB87E", fontWeight: 600 }}>Pronto para envio</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "#E84040", fontWeight: 600 }}>Telefone não cadastrado</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <input
                        readOnly
                        type="text"
                        value={telLimpo ? linkAtualizacao : "Telefone da entidade não cadastrado"}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          background: "var(--admin-bg)",
                          border: "1px solid var(--admin-border)",
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: "var(--admin-text)",
                          outline: "none",
                          cursor: telLimpo ? "text" : "not-allowed",
                          opacity: telLimpo ? 1 : 0.6,
                        }}
                        onClick={(e) => telLimpo && (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        disabled={!telLimpo}
                        onClick={() => handleCopyLink(linkAtualizacao, "atualizacao")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--admin-border)",
                          background: copiedLink === "atualizacao" ? "rgba(13,184,126,0.15)" : "var(--admin-bg)",
                          color: copiedLink === "atualizacao" ? "#0DB87E" : "var(--admin-text)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: telLimpo ? "pointer" : "not-allowed",
                          opacity: telLimpo ? 1 : 0.5,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {copiedLink === "atualizacao" ? (
                          <>
                            <Check size={13} color="#0DB87E" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy size={13} /> Copiar
                          </>
                        )}
                      </button>
                      {telLimpo && (
                        <>
                          <a
                            href={linkAtualizacao}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid var(--admin-border)",
                              background: "var(--admin-bg)",
                              color: "#2B6EE8",
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <ExternalLink size={12} /> Abrir
                          </a>
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "6px 12px",
                              borderRadius: 6,
                              background: "#25D366",
                              color: "#000000",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              textDecoration: "none",
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            <span>WhatsApp</span>
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 2. Link Padrinho/Madrinha (Indicação PJ) */}
              {(() => {
                const refSlug = selectedEntidade.referralSlug || customSlugInput || "entidade-ubatuba";
                const padrinhoLink = `${getAppOrigin()}/?ref=${refSlug}#cadastro-fundadores-cap`;
                const nomeEntidade = selectedEntidade.nomeFantasia || selectedEntidade.razaoSocial;
                const telLimpo = cleanPhoneDigits(selectedEntidade.telefone);
                const formattedPhone = telLimpo.length >= 10 && !telLimpo.startsWith("55") ? `55${telLimpo}` : telLimpo;
                const waReferralMsg = `Olá, equipe da ${nomeEntidade}! Aqui está o Link Padrinho/Madrinha exclusivo da entidade para convidar membros e moradores, gerando recursos para a associação:\n${padrinhoLink}`;
                const waReferralLink = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(waReferralMsg)}`;

                return (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>2. Link Padrinho/Madrinha (Indicação PJ):</span>
                      <span style={{ fontSize: 10, color: "#0DB87E", fontWeight: 600 }}>Slug: {refSlug}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <input
                        readOnly
                        type="text"
                        value={padrinhoLink}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          background: "var(--admin-bg)",
                          border: "1px solid var(--admin-border)",
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontFamily: "monospace",
                          color: "var(--admin-text)",
                          outline: "none",
                          cursor: "text",
                        }}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyLink(padrinhoLink, "padrinho")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--admin-border)",
                          background: copiedLink === "padrinho" ? "rgba(13,184,126,0.15)" : "var(--admin-bg)",
                          color: copiedLink === "padrinho" ? "#0DB87E" : "var(--admin-text)",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {copiedLink === "padrinho" ? (
                          <>
                            <Check size={13} color="#0DB87E" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy size={13} /> Copiar
                          </>
                        )}
                      </button>
                      {telLimpo && (
                        <a
                          href={waReferralLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "6px 12px",
                            borderRadius: 6,
                            background: "#25D366",
                            color: "#000000",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 3. Código de Indicação Personalizado (Vanity Slug) */}
              <div>
                <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginBottom: 4, fontWeight: 600 }}>
                  3. Código de Indicação Personalizado (Vanity Slug):
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="text"
                    value={customSlugInput}
                    onChange={(e) => setCustomSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="ex: coco-cia-teste"
                    style={{
                      flex: 1,
                      background: "var(--admin-bg)",
                      border: "1px solid var(--admin-border)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "var(--admin-text)",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    disabled={isSavingCustomSlug || !customSlugInput.trim() || customSlugInput.trim() === selectedEntidade.referralSlug}
                    onClick={handleSaveSlug}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--admin-border)",
                      background: "#0DB87E",
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: (isSavingCustomSlug || !customSlugInput.trim() || customSlugInput.trim() === selectedEntidade.referralSlug) ? "not-allowed" : "pointer",
                      opacity: (isSavingCustomSlug || !customSlugInput.trim() || customSlugInput.trim() === selectedEntidade.referralSlug) ? 0.5 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isSavingCustomSlug ? "Salvando..." : "Salvar Slug"}
                  </button>
                </div>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div style={{ borderTop: "1px solid var(--admin-border)", marginTop: 18, paddingTop: 14, display: "flex", justifyContent: "flex-end" }}>
              <GhostButton onClick={() => setSelectedEntidade(null)}>
                Fechar
              </GhostButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
