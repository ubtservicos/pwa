import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAdminToast } from "@/components/admin/AdminToast";
import { Check, X, UserCheck } from "lucide-react";
import { Card, PageTitle } from "@/components/admin/ui";

interface PendingUser {
  id: string;
  nome: string | null;
  role: string | null;
  cpf: string | null;
  telefone: string | null;
  chave_pix: string | null;
  status: string | null;
  bairro_moradia: string | null;
  bairro_trabalho: string | null;
  praias_frequenta: string[] | null;
  praias_atende: string[] | null;
  cnpj: string | null;
}

export default function AdminAprovacoesPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useAdminToast();

  const loadPendingUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("status", "pending");

      if (error) throw error;
      setUsers((data || []) as PendingUser[]);
    } catch (err: any) {
      console.error("Erro ao carregar aprovacoes pendentes:", err);
      toast.show("Erro ao carregar cadastros em análise.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const handleUpdateStatus = async (userId: string, newStatus: "active" | "rejected") => {
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;

      toast.show(
        newStatus === "active"
          ? "Cadastro aprovado com sucesso! 🎉"
          : "Cadastro rejeitado com sucesso."
      );
      
      // Update local state
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      console.error("Erro ao atualizar status:", err);
      toast.show("Erro ao atualizar status do cadastro.");
    }
  };

  const getFriendlyRole = (role: string | null) => {
    if (role === "associacao") return "Associação B2B";
    if (role === "prestador") return "Prestador / Parceiro";
    if (role === "tomador") return "Morador / Turista (Tomador)";
    return role || "Não informado";
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white p-6" style={{ fontFamily: "DM Sans" }}>
      <PageTitle sub="Análise e liberação de novos cadastros de prestadores, moradores e entidades B2B">
        <span className="text-white">Central de Aprovações (Smart Onboarding)</span>
      </PageTitle>

      {loading ? (
        <div className="py-12 text-center text-white/50">
          <span className="animate-pulse">Buscando cadastros em análise...</span>
        </div>
      ) : users.length === 0 ? (
        <Card className="p-8 text-center bg-[#18181B] border-[#27272A] text-[#A1A1AA]">
          <UserCheck size={48} className="mx-auto mb-4 text-[#00FF66]" />
          <p className="font-semibold text-lg text-white">Nenhum cadastro pendente</p>
          <p className="text-sm mt-1">Todos os cadastros foram analisados e liberados.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {users.map((u) => (
            <Card key={u.id} className="p-6 bg-[#18181B] border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                {/* User Header */}
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display font-bold text-lg text-white">
                    {u.nome || "Sem Nome"}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#27272A] text-[#00FF66] border border-[#00FF66]/20">
                    {getFriendlyRole(u.role)}
                  </span>
                </div>

                {/* Dynamic details */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-[13px] text-[#A1A1AA]">
                  {u.role === "associacao" && u.cnpj && (
                    <div>
                      <span className="block font-semibold text-white/60">CNPJ:</span>
                      <span className="font-mono text-white">{u.cnpj}</span>
                    </div>
                  )}
                  {u.role !== "associacao" && u.cpf && (
                    <div>
                      <span className="block font-semibold text-white/60">CPF:</span>
                      <span className="font-mono text-white">{u.cpf}</span>
                    </div>
                  )}
                  {u.telefone && (
                    <div>
                      <span className="block font-semibold text-white/60">Telefone:</span>
                      <span className="text-white">{u.telefone}</span>
                    </div>
                  )}
                  {u.bairro_moradia && (
                    <div>
                      <span className="block font-semibold text-white/60">Bairro Moradia:</span>
                      <span className="text-white">{u.bairro_moradia}</span>
                    </div>
                  )}
                  {u.bairro_trabalho && (
                    <div>
                      <span className="block font-semibold text-white/60">Bairro Trabalho:</span>
                      <span className="text-white">{u.bairro_trabalho}</span>
                    </div>
                  )}
                  {u.praias_frequenta && u.praias_frequenta.length > 0 && (
                    <div>
                      <span className="block font-semibold text-white/60">Praias que frequenta:</span>
                      <span className="text-white">{u.praias_frequenta.join(", ")}</span>
                    </div>
                  )}
                  {u.praias_atende && u.praias_atende.length > 0 && (
                    <div>
                      <span className="block font-semibold text-white/60">Praias que atende:</span>
                      <span className="text-white">{u.praias_atende.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center">
                <button
                  onClick={() => handleUpdateStatus(u.id, "rejected")}
                  className="px-4 py-2.5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 text-[#EF4444] hover:bg-[#EF4444]/10 transition-all font-sans text-sm font-semibold flex items-center gap-2"
                >
                  <X size={16} />
                  Rejeitar
                </button>
                <button
                  onClick={() => handleUpdateStatus(u.id, "active")}
                  className="px-4 py-2.5 rounded-xl bg-[#00FF66] text-[#09090B] hover:shadow-lg hover:shadow-[#00FF66]/20 transition-all font-sans text-sm font-extrabold flex items-center gap-2"
                >
                  <Check size={16} />
                  Aprovar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
