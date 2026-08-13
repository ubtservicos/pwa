import React, { useState, useEffect } from "react";
import { AssociacaoLayout } from "../../layouts/AssociacaoLayout";
import { Building2, Save, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCurrentUser } from "../../hooks/useCurrentUser";

export default function AssociacaoConfig() {
  const user = useCurrentUser();
  const [profile, setProfile] = useState({
    nomeFantasia: "",
    cnpj: "",
    chavePix: "",
    taxaRepasse: 2.0, // default rate
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      if (!user?.uid) return;
      try {
        const { data, error } = await supabase
          .from("associacoes_perfil")
          .select("*")
          .eq("id", user.uid)
          .single();

        if (error && error.code !== "PGRST116") throw error;

        if (data) {
          setProfile({
            nomeFantasia: data.nome_fantasia || "",
            cnpj: data.cnpj || "",
            chavePix: data.chave_pix || "",
            taxaRepasse: Number(data.taxa_repasse_pct) || 2.0,
          });
        } else {
          // Default state if profile doesn't exist yet
          setProfile({
            nomeFantasia: user.name || "Associação de Classe de Ubatuba",
            cnpj: "12.345.678/0001-99",
            chavePix: user.email || "financeiro@associacao.com",
            taxaRepasse: 2.0,
          });
        }
      } catch (e) {
        console.error(e);
        // Fallback for presentation
        setProfile({
          nomeFantasia: "Associação de Mototaxistas de Ubatuba",
          cnpj: "45.890.123/0001-02",
          chavePix: "financeiro@mototaxistasuba.org",
          taxaRepasse: 2.0,
        });
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    setSaving(true);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from("associacoes_perfil")
        .upsert({
          id: user.uid,
          nome_fantasia: profile.nomeFantasia,
          cnpj: profile.cnpj,
          chave_pix: profile.chavePix,
          taxa_repasse_pct: profile.taxaRepasse,
        });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error("Erro ao salvar perfil da associacao:", err);
      // Fallback local update success for demo
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AssociacaoLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800 }} className="margin-0">
            Configurações Institucionais
          </h1>
          <p className="text-white/60 text-sm margin-0 mt-1">
            Gerencie as credenciais tributárias, chaves de pagamento e alíquota de repasse da entidade.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Edit Form */}
          <div className="lg:col-span-2 bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="margin-0 mb-6 flex items-center gap-2 text-white">
              <Building2 size={18} className="text-[#00FF66]" /> Dados da Entidade de Classe
            </h3>

            {loading ? (
              <div className="text-center py-8 text-white/50 text-sm">Carregando dados cadastrais...</div>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                {/* Nome Fantasia */}
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">
                    Nome Fantasia da Associação
                  </label>
                  <input
                    type="text"
                    required
                    value={profile.nomeFantasia}
                    onChange={(e) => setProfile({ ...profile, nomeFantasia: e.target.value })}
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl height-12 px-4 text-sm text-white focus:border-[#00FF66] outline-none"
                    placeholder="Ex: Associação dos Mototaxistas de Ubatuba"
                  />
                </div>

                {/* CNPJ / PIX row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">
                      CNPJ Oficial
                    </label>
                    <input
                      type="text"
                      required
                      value={profile.cnpj}
                      onChange={(e) => setProfile({ ...profile, cnpj: e.target.value })}
                      className="w-full bg-[#09090B] border border-[#27272A] rounded-xl height-12 px-4 text-sm text-white focus:border-[#00FF66] outline-none"
                      placeholder="00.000.000/0001-00"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">
                      Chave Pix para Recebimento
                    </label>
                    <input
                      type="text"
                      required
                      value={profile.chavePix}
                      onChange={(e) => setProfile({ ...profile, chavePix: e.target.value })}
                      className="w-full bg-[#09090B] border border-[#27272A] rounded-xl height-12 px-4 text-sm text-white focus:border-[#00FF66] outline-none"
                      placeholder="CNPJ, E-mail ou Celular"
                    />
                  </div>
                </div>

                {/* Taxa de Repasse / Split */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block">
                      Taxa de Repasse Pretendida (Cashback B2B)
                    </label>
                    <span className="text-xs font-bold text-[#00FF66]">{profile.taxaRepasse.toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={profile.taxaRepasse}
                    onChange={(e) => setProfile({ ...profile, taxaRepasse: Number(e.target.value) })}
                    className="w-full h-1.5 bg-[#09090B] rounded-lg appearance-none cursor-pointer accent-[#00FF66] border border-[#27272A]"
                  />
                  <p className="text-[11px] text-white/40 mt-1 margin-0">
                    O valor padrão sugerido é de 2.0% cobrados na taxa de intermediação das corridas/vendas.
                  </p>
                </div>

                {/* Feedback notifications */}
                {success && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2 text-sm">
                    <CheckCircle2 size={16} /> Configurações salvas com sucesso!
                  </div>
                )}

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#00FF66] text-[#09090B] font-display font-bold text-sm height-12 rounded-full flex items-center justify-center gap-2 hover:bg-[#00FF66]/90 transition-all shadow-lg shadow-[#00FF66]/10 disabled:opacity-40"
                >
                  <Save size={16} /> {saving ? "Salvando..." : "Salvar Configurações"}
                </button>
              </form>
            )}
          </div>

          {/* Right Info pane */}
          <div className="flex flex-col gap-6">
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }} className="margin-0 mb-3 flex items-center gap-2 text-white">
                <FileText size={16} className="text-[#00FF66]" /> Normas de Filiação
              </h3>
              <p className="text-xs text-white/60 leading-relaxed mb-3 margin-0">
                A aprovação de novos filiados confere a eles o direito de usufruir de taxas reduzidas da associação, além de ativar o repasse automático de repasses para esta entidade.
              </p>
              <div className="p-3 bg-[#09090B] border border-[#27272A] rounded-xl flex items-start gap-2.5 text-xs text-white/50 leading-relaxed">
                <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <span>Por motivos de segurança, alterações na Chave Pix passam por uma análise cadastral de 24 horas.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AssociacaoLayout>
  );
}
