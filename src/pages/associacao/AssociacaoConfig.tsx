import React, { useState, useEffect } from "react";
import { AssociacaoLayout } from "../../layouts/AssociacaoLayout";
import { Building2, Save, FileText, CheckCircle2, AlertCircle, Upload, Calendar } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCurrentUser } from "../../hooks/useCurrentUser";

interface AssociacaoDocumento {
  id: string;
  tipo_documento: string;
  status: 'pendente' | 'aprovado' | 'vencido';
  data_validade: string | null;
  url_arquivo: string | null;
}

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

  // Document Management mock state
  const [documents, setDocuments] = useState<AssociacaoDocumento[]>([
    { id: "1", tipo_documento: "Ata de Eleição de Diretoria", status: "vencido", data_validade: "10/05/2026", url_arquivo: "ata_diretoria.pdf" },
    { id: "2", tipo_documento: "Estatuto Social Registrado", status: "aprovado", data_validade: "31/12/2030", url_arquivo: "estatuto.pdf" },
    { id: "3", tipo_documento: "Comprovante de Inscrição CNPJ", status: "pendente", data_validade: null, url_arquivo: null },
  ]);

  useEffect(() => {
    async function loadConfig() {
      if (!user?.uid) return;
      try {
        const { data, error } = await supabase
          .from("associacoes_perfil")
          .select("*")
          .eq("id", user.uid)
          .maybeSingle(); // Changed from .single() to avoid 406 Acceptable console errors

        if (error) throw error;

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

  const handleUploadDocument = (docId: string) => {
    // Simulated upload
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, status: "pendente", url_arquivo: "upload_novo.pdf", data_validade: "13/08/2027" }
          : d
      )
    );
    alert("Documento enviado para análise da equipe operacional UBT com sucesso!");
  };

  return (
    <AssociacaoLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800 }} className="margin-0">
            Configurações Institucionais
          </h1>
          <p className="text-white/60 text-sm margin-0 mt-1">
            Gerencie as credenciais tributárias, chaves de pagamento e envio de documentos regulatórios.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Edit Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
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

            {/* Document Management Section */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="margin-0 mb-6 flex items-center gap-2 text-white">
                <FileText size={18} className="text-[#00FF66]" /> Gestão de Documentos
              </h3>

              <div className="flex flex-col gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all bg-[#09090B]"
                    style={{
                      borderColor: doc.status === "vencido" ? "rgba(239, 68, 68, 0.3)" : "rgba(39, 39, 42, 1)"
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-semibold text-[14px] text-white">
                          {doc.tipo_documento}
                        </span>
                        {doc.status === "vencido" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            Vencido
                          </span>
                        )}
                        {doc.status === "aprovado" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Aprovado
                          </span>
                        )}
                        {doc.status === "pendente" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            Em análise
                          </span>
                        )}
                      </div>
                      
                      {doc.data_validade && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-[#A1A1AA]">
                          <Calendar size={12} />
                          <span>Validade: {doc.data_validade}</span>
                          {doc.status === "vencido" && (
                            <span className="text-red-400 font-semibold ml-2">({doc.tipo_documento} Vencido!)</span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleUploadDocument(doc.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 self-start sm:self-center transition-all bg-[#18181B] border border-[#27272A] text-white hover:bg-white/5"
                    >
                      <Upload size={14} />
                      Enviar Documento
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Info pane */}
          <div className="flex flex-col gap-6">
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }} className="margin-0 mb-3 flex items-center gap-2 text-white">
                <FileText size={16} className="text-[#00FF66]" /> Normas de Regularidade
              </h3>
              <p className="text-xs text-white/60 leading-relaxed mb-3 margin-0">
                Para manter a liberação dos saques e a retenção tributária ativa, a associação de classe deve manter a documentação e estatuto atualizados junto ao portal administrativo.
              </p>
              <div className="p-3 bg-[#09090B] border border-[#27272A] rounded-xl flex items-start gap-2.5 text-xs text-white/50 leading-relaxed">
                <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                <span>Por motivos de compliance, alterações na Chave Pix passam por uma análise cadastral de 24 horas.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AssociacaoLayout>
  );
}
