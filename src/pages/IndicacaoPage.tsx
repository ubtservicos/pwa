import React, { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
  Share2,
  Award,
  ShieldCheck,
  TrendingUp,
  QrCode,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { trackEvent } from "@/services/AnalyticsService";

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function IndicacaoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const slugParam = searchParams.get("ref") || searchParams.get("slug") || "";
  const nomeParam = searchParams.get("nome") || "";
  const [copied, setCopied] = useState(false);

  const slug = slugParam || "fundador-ubatuba";

  // URL Base Oficial da UBT
  const origin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://ubtservicos.vercel.app";

  const fullShareUrl = `${origin}/r/${slug}`;

  // Chuva de confetes inicial caso venha da conclusão
  useEffect(() => {
    try {
      confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.6 },
        zIndex: 999999,
        colors: ["#00FF66", "#005BFF", "#FFDD00", "#FFFFFF"],
      });
    } catch (e) {}

    trackEvent("indicacao_page_view", "referral", { slug });
  }, [slug]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      toast.success("Link de apadrinhamento copiado com sucesso! ✓");
      setTimeout(() => setCopied(false), 3000);
      trackEvent("referral_link_copied", "referral", { slug });
    } catch (err) {
      toast.error("Erro ao copiar link.");
    }
  };

  const whatsAppMessage = `🚀 Olá! Acabei de ativar meu cadastro pioneiro como Membro Fundador na UBT Serviços em Ubatuba.\n\nCadastre-se pelo meu link exclusivo e garanta benefícios e acesso antecipado:\n${fullShareUrl}`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppMessage)}`;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-green selection:text-navy pb-24 md:pb-12">
      {/* Glows de Fundo */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00FF66]/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-[#005BFF]/10 blur-[140px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative z-30 border-b border-zinc-800 bg-black/90 backdrop-blur-md sticky top-0 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 text-xs font-mono font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Início</span>
          </Link>
          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
          <Link to="/" className="flex items-center gap-2">
            <span className="font-display font-extrabold text-lg tracking-wider text-white">
              UBT <span className="text-green text-sm font-sans font-semibold">SERVIÇOS</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/sou-fundador"
            className="text-xs text-green hover:underline font-mono font-semibold"
          >
            Painel do Fundador
          </Link>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8">
        {/* Banner de Celebração */}
        <div className="text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-green/30 text-green text-[11px] font-mono uppercase tracking-widest font-semibold mb-4 shadow-[0_0_20px_rgba(0,255,102,0.15)]">
            <Sparkles className="w-3.5 h-3.5 text-green" />
            <span>ETAPA CONCLUÍDA • MEMBRO FUNDADOR ATIVO</span>
          </div>

          <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-white tracking-tight leading-tight max-w-xl mb-3">
            {nomeParam ? `Parabéns, ${nomeParam.split(" ")[0]}!` : "Parabéns, Fundador!"} 🎉
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 font-sans max-w-xl leading-relaxed">
            Sua atualização cadastral foi concluída com sucesso. Seu link exclusivo de apadrinhamento já está ativo para você convidar pessoas e formar sua rede em Ubatuba.
          </p>
        </div>

        {/* Card Principal de Compartilhamento */}
        <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col gap-6">
          <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
            <div className="w-10 h-10 rounded-2xl bg-green/10 border border-green/30 flex items-center justify-center text-green shrink-0">
              <Share2 className="w-5 h-5 text-green" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg text-white">
                Seu Link Exclusivo de Indicação
              </h2>
              <p className="text-xs text-zinc-400 font-sans">
                Convide novos prestadores, moradores e turistas para a plataforma.
              </p>
            </div>
          </div>

          {/* Campo com Link e Botão Copiar */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono text-white/70 uppercase tracking-wider block">
              Link Oficial do seu Perfil:
            </label>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-[220px] max-w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm font-mono text-green font-semibold truncate select-all">
                {fullShareUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-display font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green" />
                    <span className="text-green">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Botão de Disparo para WhatsApp */}
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("whatsapp_share_click", "referral", { slug })}
            className="w-full py-4 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-black font-display font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(37,211,102,0.3)] transition-all cursor-pointer text-center"
          >
            <WhatsAppIcon className="w-5 h-5 fill-black shrink-0" />
            <span>Compartilhar no WhatsApp</span>
          </a>

          {/* QR Code Section */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="p-3 bg-black rounded-2xl border border-zinc-800 shrink-0 shadow-lg">
              <QRCodeSVG
                value={fullShareUrl}
                size={140}
                bgColor="#000000"
                fgColor="#00FF66"
                level="H"
                includeMargin={false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <QrCode className="w-4 h-4 text-green" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  QR Code para Compartilhamento Presencial
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                Mostre este QR Code na tela do seu celular para amigos e clientes escanearem diretamente na praia, no comércio ou na rua.
              </p>
              <span className="text-[11px] font-mono text-zinc-500">
                Código: <strong className="text-white">{slug}</strong>
              </span>
            </div>
          </div>

          {/* Regras e Vantagens do Apadrinhamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-black border border-zinc-800/80 flex flex-col gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-green/10 flex items-center justify-center text-green mb-1">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-xs text-white">1% de Comissão</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Receba 1% sobre o valor das transações e serviços da sua rede em Ubatuba.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black border border-zinc-800/80 flex flex-col gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-1">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-xs text-white">Vínculo Permanente</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                As indicações são gravadas definitivamente na infraestrutura da plataforma.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black border border-zinc-800/80 flex flex-col gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-yellow-400/10 flex items-center justify-center text-yellow-400 mb-1">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-xs text-white">Fundo Coletivo</h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Cada serviço fortalece o fundo municipal e as associações da nossa cidade.
              </p>
            </div>
          </div>

          {/* Ações Finais */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800">
            <Link
              to="/"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white/80 font-display font-medium text-xs uppercase tracking-wider text-center transition-all border border-zinc-800"
            >
              Voltar ao Início
            </Link>

            <Link
              to="/sou-fundador"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-green/10 hover:bg-green/20 text-green border border-green/30 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all text-center"
            >
              <span>Acessar Painel do Fundador</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
