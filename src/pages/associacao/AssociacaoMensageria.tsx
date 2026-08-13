import React, { useState } from "react";
import { AssociacaoLayout } from "../../layouts/AssociacaoLayout";
import { MessageSquare, Send, Bell, Smartphone, FileText, CheckCircle } from "lucide-react";

export default function AssociacaoMensageria() {
  const [mensagem, setMensagem] = useState("");
  const [target, setTarget] = useState("todos");
  const [dispatched, setDispatched] = useState(false);
  const [loading, setLoading] = useState(false);

  const templates = [
    { title: "📢 Assembleia Geral", text: "Olá! Convocamos todos os filiados para a nossa Assembleia Geral Ordinária que ocorrerá na próxima sexta-feira às 19h no auditório principal. Sua presença é fundamental!" },
    { title: "💳 Cashback e Repasse", text: "Prezados filiados, informamos que as configurações de rateio foram atualizadas na plataforma. Agora, os repasses de incentivo de cashback B2B já estão disponíveis no extrato." },
    { title: "⚠️ Documentação KYC", text: "Atenção: A prefeitura municipal exige a renovação do alvará anual de serviço. Por favor, envie sua foto atualizada da licença no menu Perfil do UBT SuperApp." },
  ];

  const handleApplyTemplate = (text: string) => {
    setMensagem(text);
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensagem) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDispatched(true);
      
      // Simulate launching WhatsApp Web or API dispatch URL
      const textParam = encodeURIComponent(mensagem);
      const demoPhone = "5512999999999"; // Demo number representing the group broadcast line
      const waUrl = `https://wa.me/${demoPhone}?text=${textParam}`;
      
      // Open wa.me in new tab
      window.open(waUrl, "_blank");

      // Reset success status after a delay
      setTimeout(() => setDispatched(false), 5000);
    }, 1200);
  };

  return (
    <AssociacaoLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 800 }} className="margin-0">
            Mensageria e Comunicados
          </h1>
          <p className="text-white/60 text-sm margin-0 mt-1">
            Redija avisos coletivos e envie de forma automatizada para a base de filiados.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Composer Box */}
          <div className="lg:col-span-2 bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
            <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700 }} className="margin-0 mb-4 flex items-center gap-2 text-white">
              <MessageSquare size={18} className="text-[#00FF66]" /> Redigir Comunicado
            </h3>

            <form onSubmit={handleDispatch} className="flex flex-col gap-4">
              {/* Category selector */}
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">
                  Destinatários
                </label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl height-12 px-4 text-sm text-white focus:border-[#00FF66] outline-none cursor-pointer"
                >
                  <option value="todos">Todos os Filiados Ativos</option>
                  <option value="mototaxi">Apenas Mototaxistas</option>
                  <option value="ambulante">Apenas Ambulantes</option>
                  <option value="diarista">Apenas Diaristas</option>
                </select>
              </div>

              {/* Textarea */}
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">
                  Mensagem do Recado
                </label>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Escreva a mensagem que deseja disparar para seus associados..."
                  className="w-full min-h-[160px] bg-[#09090B] border border-[#27272A] rounded-xl p-4 text-sm text-white focus:border-[#00FF66] outline-none resize-y"
                  required
                />
              </div>

              {/* Submit Neon CTA */}
              <button
                type="submit"
                disabled={loading || !mensagem}
                className="w-full bg-[#00FF66] text-[#09090B] font-display font-bold text-sm height-12 rounded-full flex items-center justify-center gap-2 hover:bg-[#00FF66]/90 transition-all shadow-lg shadow-[#00FF66]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  "Processando disparo..."
                ) : dispatched ? (
                  <>
                    <CheckCircle size={16} /> Disparado com Sucesso!
                  </>
                ) : (
                  <>
                    <Send size={16} /> Disparar via WhatsApp Broadcast
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Templates sidebar */}
          <div className="flex flex-col gap-6">
            {/* Quick Templates Card */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }} className="margin-0 mb-3 flex items-center gap-2 text-white">
                <FileText size={16} className="text-[#00FF66]" /> Modelos Rápidos
              </h3>
              <p className="text-xs text-white/60 mb-4 margin-0">
                Selecione um dos modelos prontos abaixo para preencher o formulário:
              </p>

              <div className="flex flex-col gap-3">
                {templates.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => handleApplyTemplate(tpl.text)}
                    className="w-full text-left p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-xs font-semibold text-white/80 hover:border-[#00FF66]/40 hover:text-white transition-all"
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Info stats */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-6">
              <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }} className="margin-0 mb-3 flex items-center gap-2 text-white">
                <Bell size={16} className="text-[#00FF66]" /> Estatísticas de Entrega
              </h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-white/60">Filiados Cadastrados</span>
                  <span className="font-bold text-white">48</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                  <span className="text-white/60">Canais de Contato</span>
                  <span className="font-bold text-[#00FF66] flex items-center gap-1">
                    <Smartphone size={12} /> WhatsApp Web API
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60">Taxa de Leitura Média</span>
                  <span className="font-bold text-[#00FF66]">94%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AssociacaoLayout>
  );
}
