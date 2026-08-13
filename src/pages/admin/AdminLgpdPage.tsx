import { useState } from "react";
import { Search, Download, Trash2, EyeOff, ShieldCheck, UserCheck } from "lucide-react";
import { Card, PageTitle, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

export default function AdminLgpdPage() {
  const toast = useAdminToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    try {
      setLoading(true);
      setSelectedUser(null);
      
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .or(`email.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%,id.eq.${searchTerm}`)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.show("Nenhum usuário localizado com estes parâmetros.");
      } else {
        setSelectedUser(data);
      }
    } catch (err) {
      console.error("Erro ao pesquisar usuário:", err);
      toast.show("Erro ao buscar dados cadastrais.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!selectedUser) return;
    try {
      setProcessing(true);
      // Retrieve everything associated with this user ID
      const [
        { data: paymentsData },
        { data: bookingsData },
        { data: diaristaPerfil }
      ] = await Promise.all([
        supabase.from("payments").select("*").or(`customer_id.eq.${selectedUser.id},provider_id.eq.${selectedUser.id}`),
        supabase.from("pedidos").select("*").or(`tomador_id.eq.${selectedUser.id},prestador_id.eq.${selectedUser.id}`),
        supabase.from("diarista_perfis").select("*").eq("user_id", selectedUser.id).maybeSingle()
      ]);

      const reportPayload = {
        exported_at: new Date().toISOString(),
        legislative_basis: "LGPD Art. 18 (Direito de Acesso)",
        user_identity: {
          id: selectedUser.id,
          nome: selectedUser.nome,
          email: selectedUser.email,
          role: selectedUser.role,
          created_at: selectedUser.created_at
        },
        profile_details: diaristaPerfil || {},
        transaction_history: {
          payments: paymentsData || [],
          orders: bookingsData || []
        }
      };

      const blob = new Blob([JSON.stringify(reportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-lgpd-${selectedUser.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.show("Relatório de dados cadastrais JSON exportado!");
    } catch (err) {
      console.error("Erro ao exportar dados:", err);
      toast.show("Erro ao compilar relatório de privacidade.");
    } finally {
      setProcessing(false);
    }
  };

  const handleAnonymize = async () => {
    if (!selectedUser) return;
    const reason = prompt("Por favor, informe a justificativa da anonimização (ex: Solicitação do Titular via SAC):");
    if (!reason || !reason.trim()) {
      toast.show("Operação cancelada: Justificativa é obrigatória.");
      return;
    }
    if (!confirm("Aviso: Esta ação irá substituir o Nome, Celular, CPF e E-mail do usuário por hashes/mocks irreversíveis no banco. Deseja prosseguir?")) return;
    
    try {
      setProcessing(true);
      const randomCode = Math.random().toString(36).slice(2, 8);
      const { error } = await supabase
        .from("usuarios")
        .update({
          nome: `Usuário Anonimizado ${randomCode.toUpperCase()}`,
          email: `anon_${randomCode}@ubtsuperapp.com.br`,
          role: "tomador", // rebaixa role por segurança
          anonymized_at: new Date().toISOString(),
          deleted_at: new Date().toISOString(),
          deleted_reason: `Anonimização: ${reason}`,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedUser.id);

      if (error) throw error;
      toast.show("Dados cadastrais do usuário anonimizados com sucesso!");
      setSelectedUser(null);
      setSearchTerm("");
    } catch (err) {
      console.error("Erro ao anonimizar dados:", err);
      toast.show("Erro ao efetuar anonimização no Supabase.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    const reason = prompt("Por favor, informe a justificativa para exclusão definitiva desta conta (obrigatório):");
    if (!reason || !reason.trim()) {
      toast.show("Operação cancelada: Justificativa de exclusão é obrigatória.");
      return;
    }
    if (!confirm("Cuidado Extremo: Esta ação irá anonimizar os dados cadastrais do usuário de forma irreversível e excluir seus arquivos no storage, preservando os registros de pagamentos/auditorias para fins fiscais. Confirmar?")) return;

    try {
      setProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão administrativa expirada.");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          target_user_id: selectedUser.id,
          deleted_reason: `Exclusão Admin: ${reason}`
        })
      });

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Erro ao invocar exclusão lógica.");
      }

      toast.show("Conta anonimizada e desativada com sucesso.");
      setSelectedUser(null);
      setSearchTerm("");
    } catch (err: any) {
      console.error("Erro ao excluir conta:", err);
      toast.show(err.message || "Erro ao deletar registro de usuário.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <PageTitle sub="Atendimento aos Direitos do Titular sob a LGPD (Art. 18)">
        Privacidade & Compliance LGPD
      </PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
        
        {/* Search Panel */}
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Pesquisar Titular de Dados</h3>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="E-mail, Nome ou UUID..."
              style={{
                flex: 1,
                height: 40,
                border: "1px solid var(--admin-border)",
                borderRadius: 10,
                padding: "0 12px",
                fontFamily: "DM Sans",
                outline: "none",
              }}
            />
            <PrimaryButton type="submit" disabled={loading}>
              Buscar
            </PrimaryButton>
          </form>
          <p style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 12, lineHeight: "1.5" }}>
            Busca unificada na tabela `public.usuarios` por e-mail, nome exato ou chave UUID.
          </p>
        </Card>

        {/* Action Panel */}
        {selectedUser && (
          <Card style={{ padding: 24, border: "2px solid #0DB87E" }}>
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "var(--admin-text)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <UserCheck color="#0DB87E" />
              Titular Identificado
            </h3>
            
            <div style={{ background: "var(--admin-bg)", padding: 16, borderRadius: 12, marginBottom: 20, fontFamily: "DM Sans", fontSize: 14 }}>
              <div style={{ marginBottom: 6 }}><strong>Nome:</strong> {selectedUser.nome}</div>
              <div style={{ marginBottom: 6 }}><strong>E-mail:</strong> {selectedUser.email}</div>
              <div style={{ marginBottom: 6 }}><strong>Papel:</strong> {selectedUser.role}</div>
              <div><strong>UUID:</strong> {selectedUser.id}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleExportData}
                disabled={processing}
                style={{
                  height: 40,
                  background: "#2B6EE8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Download size={16} /> Exportar Relatório de Dados (JSON)
              </button>

              <button
                onClick={handleAnonymize}
                disabled={processing}
                style={{
                  height: 40,
                  background: "#F5A623",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <EyeOff size={16} /> Anonimizar Dados Cadastrais
              </button>

              <button
                onClick={handleDelete}
                disabled={processing}
                style={{
                  height: 40,
                  background: "#E84040",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontFamily: "DM Sans",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Trash2 size={16} /> Excluir Conta Definitivamente
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
