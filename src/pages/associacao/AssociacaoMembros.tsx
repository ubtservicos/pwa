import React, { useState, useEffect } from "react";
import { AssociacaoLayout } from "../../layouts/AssociacaoLayout";
import { Check, X, Search, CheckCircle, ShieldAlert, Sparkles, Bike, ShoppingBag } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Membro {
  id: string;
  nome: string;
  categoria: "mototaxi" | "ambulante" | "diarista";
  status: "active" | "pending" | "blocked";
  telefone: string;
  cadastroData: string;
}

export default function AssociacaoMembros() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  // Load from database with mock fallback
  useEffect(() => {
    async function loadMembros() {
      try {
        const { data, error } = await supabase
          .from("associacao_membros")
          .select(`
            id,
            status,
            created_at,
            usuarios!associacao_membros_prestador_id_fkey(nome, role, telefone)
          `);

        if (error) throw error;

        if (data && data.length > 0) {
          const formatted = data.map((d: any) => ({
            id: d.id,
            nome: d.usuarios?.nome || "Filiado",
            categoria: (d.usuarios?.role === "prestador" ? "mototaxi" : d.usuarios?.role) || "mototaxi",
            status: d.status,
            telefone: d.usuarios?.telefone || "",
            cadastroData: new Date(d.created_at).toLocaleDateString("pt-BR"),
          }));
          setMembros(formatted);
        } else {
          // Fallback demo data
          setMembros(getDemoMembros());
        }
      } catch (e) {
        console.error(e);
        setMembros(getDemoMembros());
      } finally {
        setLoading(false);
      }
    }
    loadMembros();
  }, []);

  const getDemoMembros = (): Membro[] => [
    { id: "1", nome: "Carlos Eduardo da Silva", categoria: "mototaxi", status: "active", telefone: "12997654321", cadastroData: "12/04/2026" },
    { id: "2", nome: "Mariana Souza Santos", categoria: "diarista", status: "active", telefone: "12998765432", cadastroData: "05/05/2026" },
    { id: "3", nome: "Roberto Ramos Cruz", categoria: "ambulante", status: "pending", telefone: "12988112233", cadastroData: "10/08/2026" },
    { id: "4", nome: "Juliana Mendes Vieira", categoria: "diarista", status: "pending", telefone: "12987334455", cadastroData: "11/08/2026" },
    { id: "5", nome: "Marcos Paulo Rezende", categoria: "mototaxi", status: "blocked", telefone: "12991223344", cadastroData: "20/03/2026" },
  ];

  const handleUpdateStatus = async (id: string, newStatus: "active" | "blocked") => {
    try {
      const { error } = await supabase
        .from("associacao_membros")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Update state locally
      setMembros((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
      );
    } catch (e) {
      console.error(e);
      // Fallback update state locally for demo purposes
      setMembros((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
      );
    }
  };

  const filtered = membros.filter((m) =>
    m.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const getCategoryBadge = (cat: "mototaxi" | "ambulante" | "diarista") => {
    if (cat === "mototaxi") return { label: "Mototaxista", icon: Bike, color: "text-[#00FF66]" };
    if (cat === "ambulante") return { label: "Ambulante", icon: ShoppingBag, color: "text-blue-400" };
    return { label: "Diarista", icon: Sparkles, color: "text-purple-400" };
  };

  return (
    <AssociacaoLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800 }} className="margin-0">
            Filiados da Entidade
          </h1>
          <p className="text-white/60 text-sm margin-0 mt-1">
            Gerenciamento e aprovação de novos membros associados à sua classe.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 bg-[#18181B] border border-[#27272A] rounded-xl height-12 px-4">
          <Search size={16} className="text-white/40" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do filiado..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm"
          />
        </div>

        {/* Member Table Card */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#27272A] text-white/40 text-xs font-semibold uppercase">
                  <th className="p-4 pl-6">Nome</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Cadastro</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-white/50 text-sm">
                      Carregando membros cadastrados...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-white/50 text-sm">
                      Nenhum membro encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const badge = getCategoryBadge(m.categoria);
                    const CatIcon = badge.icon;
                    return (
                      <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 pl-6">
                          <div>
                            <p className="text-sm font-semibold text-white margin-0">{m.nome}</p>
                            <p className="text-xs text-white/40 margin-0 mt-0.5">+{m.telefone}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <CatIcon size={14} className={badge.color} />
                            <span className="text-xs text-white/80">{badge.label}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-white/60">{m.cadastroData}</td>
                        <td className="p-4">
                          {m.status === "active" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle size={10} /> Ativo
                            </span>
                          )}
                          {m.status === "pending" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                              Pendente
                            </span>
                          )}
                          {m.status === "blocked" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                              <ShieldAlert size={10} /> Bloqueado
                            </span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {m.status !== "active" && (
                              <button
                                onClick={() => handleUpdateStatus(m.id, "active")}
                                className="p-2 rounded-lg bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/20 hover:bg-[#00FF66]/20 transition-colors"
                                title="Aprovar Filiação"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            {m.status !== "blocked" && (
                              <button
                                onClick={() => handleUpdateStatus(m.id, "blocked")}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                title="Bloquear Membro"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AssociacaoLayout>
  );
}
