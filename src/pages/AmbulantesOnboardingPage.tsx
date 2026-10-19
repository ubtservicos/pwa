import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Truck,
  MapPin,
  Store,
  Phone,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  ChevronRight,
  DollarSign
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";

type Modalidade = "delivery" | "local_fixo" | "both";

const PRAIAS_UBATUBA = [
  "Praia Grande",
  "Praia do Tenório",
  "Praia das Toninhas",
  "Praia da Enseada",
  "Praia do Perequê-Açu",
  "Praia do Itaguá",
  "Praia de Itamambuca",
  "Praia de Ubatumirim",
  "Praia do Lázaro",
  "Praia da Maranduba",
  "Praia do Félix",
  "Praia Vermelha do Norte",
  "Outra / Itinerante"
];

export default function AmbulantesOnboardingPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  // Dados Cadastrais
  const [nomeComercial, setNomeComercial] = useState("");
  const [telefone, setTelefone] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [modalidades, setModalidades] = useState<Array<"delivery" | "local_fixo">>(["delivery"]);
  const [praiaReferencia, setPraiaReferencia] = useState(PRAIAS_UBATUBA[0]);
  const [pontoReferencia, setPontoReferencia] = useState("");

  // Documentação específica de Ambulante
  const [alvaraNumero, setAlvaraNumero] = useState("");
  const [cpf, setCpf] = useState("");
  const [possuiAlvara, setPossuiAlvara] = useState<"sim" | "protocolo">("sim");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string>("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Estados de controle
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (user.name && !nomeComercial) {
      setNomeComercial(user.name);
    }
    loadExistingSession();
  }, [user.uid]);

  async function loadExistingSession() {
    if (!user.uid) return;
    try {
      const { data, error } = await supabase
        .from("ambulante_sessions")
        .select("modalidade, address")
        .eq("id", user.uid)
        .maybeSingle();

      if (!error && data) {
        if (data.modalidade === "both") {
          setModalidades(["delivery", "local_fixo"]);
        } else if (data.modalidade === "delivery" || data.modalidade === "local_fixo") {
          setModalidades([data.modalidade]);
        }
        if (data.address) {
          setPontoReferencia(data.address);
        }
      }
    } catch {
      // Ignora erro inicial
    }
  }

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocFile(file);
      setDocPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!user.uid) {
      showToast("Você precisa estar autenticado para concluir o cadastro.", "error");
      return;
    }

    if (!nomeComercial.trim()) {
      showToast("Informe o nome comercial ou identificação da sua atividade.", "error");
      return;
    }

    if (modalidades.length === 0) {
      showToast("Selecione ao menos uma forma de atendimento (Delivery ou Fixo).", "error");
      return;
    }

    setSubmitting(true);

    try {
      let docUrl = docPreviewUrl;

      // Upload do documento se fornecido
      if (docFile) {
        setUploadingDoc(true);
        const fileExt = docFile.name.split(".").pop() || "jpg";
        const fileName = `alvaras/${user.uid}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("catalogo-ambulantes")
          .upload(fileName, docFile, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("catalogo-ambulantes")
            .getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            docUrl = urlData.publicUrl;
          }
        }
      }

      // 1. Atualizar dados na tabela de usuários
      await supabase.from("usuarios").upsert({
        id: user.uid,
        nome: nomeComercial.trim(),
        role: "prestador",
      });

      // 2. Determinar modalidade combinada
      let modalidadeSalvar: Modalidade = "delivery";
      if (modalidades.length === 2) {
        modalidadeSalvar = "both";
      } else if (modalidades.length === 1) {
        modalidadeSalvar = modalidades[0];
      }

      const fullAddress = `${praiaReferencia}${pontoReferencia ? ` (${pontoReferencia})` : ""}, Ubatuba - SP`;

      // 3. Salvar sessão cadastral do ambulante
      const { error: sessionError } = await supabase
        .from("ambulante_sessions")
        .upsert({
          id: user.uid,
          prestador_id: user.uid,
          modalidade: modalidadeSalvar,
          lat: -23.432,
          lng: -45.083,
          address: fullAddress,
          is_online: false,
        });

      if (sessionError) throw sessionError;

      try {
        localStorage.setItem(`amb_session_${user.uid}`, "1");
      } catch {
        /* noop */
      }

      showToast("Cadastro de Ambulante realizado com sucesso!", "success");

      // Transição direta para o CRUD diário de Cardápio
      setTimeout(() => {
        navigate("/app/prestador/ambulantes/cardapio/editar");
      }, 1000);
    } catch (err: any) {
      console.error("Erro ao salvar cadastro de ambulante:", err);
      showToast("Erro ao salvar seus dados. Verifique sua conexão.", "error");
    } finally {
      setSubmitting(false);
      setUploadingDoc(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans pb-32">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold border ${
            feedbackMsg.type === "success"
              ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]/50"
              : "bg-red-950/80 text-red-300 border-red-800"
          }`}
        >
          {feedbackMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedbackMsg.text}
        </div>
      )}

      {/* Header Sticky */}
      <header className="sticky top-0 z-40 bg-[#09090B]/90 backdrop-blur-md border-b border-[#27272A] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-zinc-300 active:scale-95 transition-all"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white font-display">
              Onboarding do Ambulante
            </h1>
            <p className="text-xs text-zinc-400">
              Passo 1: Credenciamento e Documentação
            </p>
          </div>
        </div>

        <span className="font-display text-sm font-extrabold text-[#00FF66]">
          UBT.
        </span>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner Informativo de Separação de Conceitos */}
        <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#0DB87E]/10 border border-[#0DB87E]/30 flex items-center justify-center text-[#00FF66] shrink-0 mt-0.5">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">
              Cadastre sua atividade comercial
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Preencha os dados e documentação de identificação do ambulante. Os produtos e estoque serão configurados no próximo passo, na sua nova área de <strong>Gestão de Cardápio</strong>.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SEÇÃO 1: DADOS OPERACIONAIS */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-[#27272A] pb-2">
              <Store size={18} className="text-[#00FF66]" />
              Identificação do Ambulante
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Nome Comercial / Fantasia do Carrinho ou Barraca *
              </label>
              <input
                type="text"
                value={nomeComercial}
                onChange={(e) => setNomeComercial(e.target.value)}
                placeholder="Ex: Sorvetes do Zé, Barraca Sol & Areia"
                required
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E] transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  WhatsApp de Atendimento
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(12) 99999-9999"
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Chave Pix (para repasses)
                </label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={chavePix}
                    onChange={(e) => setChavePix(e.target.value)}
                    placeholder="CPF, telefone ou e-mail"
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: MODALIDADE DE TRABALHO */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-[#27272A] pb-2">
              <Truck size={18} className="text-[#00FF66]" />
              Modalidade de Atendimento na Praia
            </div>

            <p className="text-xs text-zinc-400">
              Selecione como os banhistas e clientes encontrarão você:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  key: "delivery" as const,
                  title: "Itinerante / Delivery na Areia",
                  desc: "Você circula pela praia e entrega no guarda-sol do cliente",
                  icon: Truck,
                },
                {
                  key: "local_fixo" as const,
                  title: "Ponto Fixo / Barraca",
                  desc: "O cliente vai até o seu ponto fixo ou carrinho demarcado",
                  icon: MapPin,
                },
              ].map(({ key, title, desc, icon: Icon }) => {
                const active = modalidades.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setModalidades((prev) =>
                        prev.includes(key)
                          ? prev.filter((x) => x !== key)
                          : [...prev, key]
                      );
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[110px] ${
                      active
                        ? "border-[#0DB87E] bg-[#0DB87E]/10"
                        : "border-[#27272A] bg-[#09090B] hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon size={20} className={active ? "text-[#00FF66]" : "text-zinc-400"} />
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          active ? "border-[#00FF66] bg-[#00FF66]" : "border-zinc-600"
                        }`}
                      >
                        {active && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{title}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO 3: LOCALIZAÇÃO & PONTO DE ATUAÇÃO */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-[#27272A] pb-2">
              <MapPin size={18} className="text-[#00FF66]" />
              Praia e Ponto de Atuação em Ubatuba
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Praia Principal de Atuação *
              </label>
              <select
                value={praiaReferencia}
                onChange={(e) => setPraiaReferencia(e.target.value)}
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
              >
                {PRAIAS_UBATUBA.map((praia) => (
                  <option key={praia} value={praia}>
                    {praia}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Ponto de Referência ou Posto Salva-Vidas (Opcional)
              </label>
              <input
                type="text"
                value={pontoReferencia}
                onChange={(e) => setPontoReferencia(e.target.value)}
                placeholder="Ex: Em frente ao quiosque X, Posto 3"
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
              />
            </div>
          </div>

          {/* SEÇÃO 4: DOCUMENTAÇÃO & ALVARÁ MUNICIPAL */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-[#27272A] pb-2">
              <FileText size={18} className="text-[#00FF66]" />
              Documentação e Alvará Municipal
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPossuiAlvara("sim")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  possuiAlvara === "sim"
                    ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]"
                    : "bg-[#09090B] text-zinc-400 border-[#27272A]"
                }`}
              >
                Possuo Alvará Emitido
              </button>
              <button
                type="button"
                onClick={() => setPossuiAlvara("protocolo")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  possuiAlvara === "protocolo"
                    ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]"
                    : "bg-[#09090B] text-zinc-400 border-[#27272A]"
                }`}
              >
                Protocolo em Andamento
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {possuiAlvara === "sim" ? "Número do Alvará / Licença" : "Número do Protocolo"}
                </label>
                <input
                  type="text"
                  value={alvaraNumero}
                  onChange={(e) => setAlvaraNumero(e.target.value)}
                  placeholder="Ex: PMU-2026/0491"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  CPF do Titular
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Foto do Alvará ou Documento de Identidade
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#27272A] rounded-xl p-4 bg-[#09090B] hover:border-[#0DB87E] cursor-pointer transition-all">
                <UploadCloud size={24} className="text-zinc-400 mb-1" />
                <span className="text-xs text-zinc-300 font-medium">
                  {docFile ? docFile.name : "Clique para anexar foto do documento"}
                </span>
                <span className="text-[10px] text-zinc-500 mt-0.5">JPG, PNG ou PDF (máx. 10MB)</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* BOTÃO DE SUBMISSÃO */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || uploadingDoc}
              className="w-full bg-gradient-to-r from-[#0DB87E] to-[#00FF66] text-[#09090B] font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-[#0DB87E]/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span>Salvando Credenciamento...</span>
              ) : (
                <>
                  <span>Concluir Onboarding & Ir para o Cardápio</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-zinc-500 mt-2">
              Seus dados cadastrais ficam salvos com segurança na infraestrutura UBT.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
