import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Clock, Check, X } from "lucide-react";
import { Card, Avatar, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

export default function AdminKycListPage() {
  const navigate = useNavigate();
  const toast = useAdminToast();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [verticalFilter, setVerticalFilter] = useState<"all" | "mototaxi" | "carro">("all");

  const fetchPendingKycs = async () => {
    setLoading(true);
    try {
      // 1. Fetch pending mototaxi & carros records directly from SSOT
      const [motoRes, carroRes, profilesRes, usersRes] = await Promise.all([
        supabase
          .from("prestador_mototaxi")
          .select("*")
          .eq("kyc_status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("prestador_carro")
          .select("*")
          .eq("kyc_status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, name, phone, role, is_active, created_at"),
        supabase
          .from("usuarios")
          .select("id, nome, email, telefone, role, status, created_at"),
      ]);

      if (motoRes.error) {
        console.error("Erro ao buscar prestador_mototaxi:", motoRes.error);
      }
      if (carroRes.error) {
        console.error("Erro ao buscar prestador_carro:", carroRes.error);
      }

      const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const usuariosMap = new Map((usersRes.data || []).map((u: any) => [u.id, u]));

      const mapCandidate = (row: any, vertical: "mototaxi" | "carro") => {
        const profile = profilesMap.get(row.user_id);
        const usuario = usuariosMap.get(row.user_id);
        const defaultName = vertical === "carro" ? "Candidato Carros" : "Candidato Mototaxi";
        const candidateName = usuario?.nome || profile?.name || defaultName;
        const candidateContact =
          usuario?.email ||
          (usuario?.telefone ? `Tel: ${usuario.telefone}` : null) ||
          (profile?.phone ? `Tel: ${profile.phone}` : `${candidateName.toLowerCase().replace(/\s+/g, ".")}@ubt.app`);

        return {
          id: row.user_id,
          vertical,
          name: candidateName,
          role: usuario?.role || profile?.role || "prestador",
          email: candidateContact,
          createdAt: row.created_at || row.updated_at || usuario?.created_at || profile?.created_at || new Date().toISOString(),
          kycStatus: "pending",
          category: vertical === "carro" ? "Carros" : "Mototaxi",
          plate: row.plate,
          model: row.model,
          cpf: row.cpf,
        };
      };

      const mappedMototaxi = (motoRes.data || []).map((moto: any) => mapCandidate(moto, "mototaxi"));
      const mappedCarros = (carroRes.data || []).map((carro: any) => mapCandidate(carro, "carro"));
      const combined = [...mappedCarros, ...mappedMototaxi].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setUsers(combined);
    } catch (e) {
      console.error("Erro ao buscar KYCs pendentes:", e);
      toast.show("Erro ao carregar lista de KYCs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingKycs();
  }, []);

  const setKyc = async (id: string, vertical: "mototaxi" | "carro", status: "approved" | "rejected") => {
    const targetTable = vertical === "carro" ? "prestador_carro" : "prestador_mototaxi";
    const verticalLabel = vertical === "carro" ? "Carros" : "Mototáxi";
    try {
      if (status === "approved") {
        // 1. Update usuarios table to active prestador
        await supabase
          .from("usuarios")
          .update({
            role: "prestador",
            status: "active",
            under_review: false,
          })
          .eq("id", id);

        // 2. Update vertical provider table to approved
        await supabase
          .from(targetTable)
          .update({
            kyc_status: "approved",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", id);

        // 3. Update profiles table if exists
        await supabase
          .from("profiles")
          .update({
            role: "prestador",
            is_active: true,
          })
          .eq("id", id);

        // 4. Notificação in-app (best effort)
        try {
          await supabase.from("notificacoes").insert({
            user_id: id,
            title: `Cadastro ${verticalLabel} aprovado!`,
            message: `Seus documentos de ${verticalLabel} foram validados. Você já pode ficar online e receber corridas.`,
            type: "kyc_approved",
          });
        } catch {
          // ignore optional notification error
        }

        toast.show(`KYC (${verticalLabel}) aprovado com sucesso! Prestador credenciado e ativo.`);
      } else {
        // 1. Update usuarios
        await supabase
          .from("usuarios")
          .update({
            under_review: false,
          })
          .eq("id", id);

        // 2. Update vertical provider table
        await supabase
          .from(targetTable)
          .update({
            kyc_status: "rejected",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", id);

        try {
          await supabase.from("notificacoes").insert({
            user_id: id,
            title: `Documentos ${verticalLabel} precisam de revisão`,
            message: `Seu cadastro de ${verticalLabel} foi reprovado na verificação. Verifique seus documentos no aplicativo.`,
            type: "kyc_rejected",
          });
        } catch {
          // ignore optional notification error
        }

        toast.show(`KYC (${verticalLabel}) reprovado.`);
      }

      setUsers((prev) => prev.filter((u) => !(u.id === id && u.vertical === vertical)));
    } catch (e) {
      console.error("Erro ao atualizar KYC:", e);
      toast.show("Erro ao atualizar status do KYC.");
    }
  };

  const filtered = users.filter((u) => {
    const matchName = u.name.toLowerCase().includes(q.toLowerCase());
    const matchVertical = verticalFilter === "all" || u.vertical === verticalFilter;
    return matchName && matchVertical;
  });

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ fontFamily: "DM Sans", color: "var(--admin-muted)" }}>Carregando KYCs pendentes...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: "0 auto" }}>
      {/* Back Button */}
      <button
        onClick={() => navigate("/admin")}
        style={{
          background: "none",
          border: "none",
          color: "var(--admin-subtle)",
          fontFamily: "DM Sans",
          fontSize: 14,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          marginBottom: 24,
          transition: "color 150ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--admin-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--admin-subtle)")}
      >
        <ArrowLeft size={16} /> Voltar para o Dashboard
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
            Solicitações de KYC Pendentes
          </h1>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", marginTop: 4 }}>
            Lista de usuários aguardando validação de documentos para credenciamento.
          </p>
        </div>

        {/* Search & Vertical Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            aria-label="Filtrar categoria KYC"
            value={verticalFilter}
            onChange={(e) => setVerticalFilter(e.target.value as "all" | "mototaxi" | "carro")}
            style={{
              height: 40,
              background: "var(--admin-bg)",
              border: "1px solid var(--admin-border)",
              borderRadius: 10,
              padding: "0 12px",
              fontFamily: "DM Sans",
              fontSize: 13,
              color: "var(--admin-text)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">Todas Categorias</option>
            <option value="mototaxi">Mototaxi</option>
            <option value="carro">Carros</option>
          </select>

          <div style={{ position: "relative", width: 260 }}>
            <Search size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome..."
              style={{
                width: "100%",
                height: 40,
                background: "var(--admin-bg)",
                border: "1px solid var(--admin-border)",
                borderRadius: 10,
                padding: "0 14px 0 38px",
                fontFamily: "DM Sans",
                fontSize: 14,
                color: "var(--admin-text)",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
            Nenhuma solicitação de KYC pendente encontrada.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--admin-bg)" }}>
                <tr>
                  {["Nome", "E-mail", "Data de Cadastro", "Categoria Pretendida", "Ações"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 20px",
                        fontFamily: "DM Sans",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--admin-muted)",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={`${u.vertical}-${u.id}`}
                    onClick={() => navigate(`/admin/kyc/${u.id}?vertical=${u.vertical}`)}
                    style={{ borderBottom: "1px solid var(--admin-border)", transition: "background 100ms", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} />
                        <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-text)", fontWeight: 500 }}>
                          {u.name}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
                      {new Date(u.createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <Pill
                        bg={u.vertical === "carro" ? "rgba(6,182,212,0.14)" : "rgba(13,184,126,0.10)"}
                        color={u.vertical === "carro" ? "#22D3EE" : "#0DB87E"}
                        size="sm"
                      >
                        {u.category}
                      </Pill>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setKyc(u.id, u.vertical, "approved")}
                          style={{
                            background: "rgba(13,184,126,0.10)",
                            border: "1px solid rgba(13,184,126,0.25)",
                            color: "#0DB87E",
                            fontFamily: "DM Sans",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            padding: "6px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => setKyc(u.id, u.vertical, "rejected")}
                          style={{
                            background: "rgba(232,64,64,0.08)",
                            border: "1px solid rgba(232,64,64,0.20)",
                            color: "#E84040",
                            fontFamily: "DM Sans",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            padding: "6px 12px",
                            cursor: "pointer",
                          }}
                        >
                          Reprovar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
