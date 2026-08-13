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

  const fetchPendingKycs = async () => {
    setLoading(true);
    try {
      const { data: dbUsers, error } = await supabase
        .from("usuarios")
        .select("*");
      if (error) throw error;

      if (dbUsers) {
        // Buscar perfis diaristas/caminhões para ajudar a definir categorias
        const { data: diaristas } = await supabase
          .from("diarista_perfis")
          .select("user_id");
        
        const diaristasSet = new Set(diaristas?.map(d => d.user_id) || []);

        const { data: caminhoes } = await supabase
          .from("coco_caminhoes")
          .select("prestador_id");
        
        const caminhoesSet = new Set(caminhoes?.map(c => c.prestador_id) || []);

        // Filtrar apenas pendentes de KYC (role !== prestador e sem aprovação implícita)
        const mapped = dbUsers
          .map((u: any) => {
            const isColab = u.role === "cocoecia-colaborador" || u.role === "cocoecia-dirigentes" || u.role === "cocoecia";
            const kycStatus = u.role === "prestador" || isColab ? "approved" : "pending";
            
            let category = "Mototaxi";
            if (isColab || caminhoesSet.has(u.id)) category = "Reciclagem";
            else if (diaristasSet.has(u.id)) category = "Diarista";

            return {
              id: u.id,
              name: u.nome,
              role: u.role,
              email: `${u.nome.toLowerCase().replace(/\s+/g, ".")}@example.com`,
              createdAt: u.created_at || new Date().toISOString(),
              kycStatus,
              category,
            };
          })
          .filter((u) => u.kycStatus === "pending");

        setUsers(mapped);
      }
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

  const setKyc = async (id: string, status: "approved" | "rejected") => {
    try {
      const newRole = status === "approved" ? "prestador" : "tomador";
      const { error } = await supabase
        .from("usuarios")
        .update({ role: newRole })
        .eq("id", id);

      if (error) throw error;

      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.show(status === "approved" ? "KYC aprovado! Papel atualizado para Prestador." : "KYC reprovado.");
    } catch (e) {
      console.error("Erro ao atualizar KYC:", e);
      toast.show("Erro ao atualizar status do KYC.");
    }
  };

  const filtered = users.filter(u => u.name.toLowerCase().includes(q.toLowerCase()));

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

        {/* Search */}
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
                    key={u.id}
                    onClick={() => navigate(`/admin/kyc/${u.id}`)}
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
                      <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
                        {u.category}
                      </Pill>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setKyc(u.id, "approved")}
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
                          onClick={() => setKyc(u.id, "rejected")}
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
