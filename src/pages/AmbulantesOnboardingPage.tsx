import { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  FileText,
  MapPin,
  ShieldCheck,
  Store,
  Truck,
  UploadCloud,
  Sparkles,
  Camera,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { maskCPF, maskPhone } from "@/utils/masks";
import Toast from "@/components/auth/Toast";
import { useSimpleToast } from "@/hooks/useToast2";

const PRAIAS_UBATUBA = [
  "Praia Grande",
  "Praia do Tenório",
  "Praia Vermelha do Centro",
  "Itaguá",
  "Perequê-Açu",
  "Toninhas",
  "Enseada",
  "Lázaro",
  "Sununga",
  "Domingas Dias",
  "Praia Dura",
  "Maranduba",
  "Lagoinha",
  "Itamambuca",
  "Félix",
  "Prumirim",
  "Centro / Calçadão",
  "Outra região de Ubatuba",
];

const TIPOS_ESTRUTURA = [
  { value: "", label: "Selecione (opcional)" },
  { value: "carrinho", label: "Carrinho de Praia" },
  { value: "barraca", label: "Barraca" },
  { value: "isopor", label: "Isopor / Caixa Térmica" },
  { value: "ponto_fixo", label: "Ponto Fixo / Quiosque" },
  { value: "outro", label: "Outro" },
];

type UploadFieldKey =
  | "rg_frente"
  | "rg_verso"
  | "selfie"
  | "alvara_photo"
  | "vigilancia_photo"
  | "estrutura_photo";

export default function AmbulantesOnboardingPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { toast, showToast } = useSimpleToast();

  // Mandatory identity & operational fields
  const [nomeComercial, setNomeComercial] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [modalidades, setModalidades] = useState<string[]>(["entrega", "retirada"]);
  const [praiaReferencia, setPraiaReferencia] = useState("Praia Grande");
  const [pontoReferencia, setPontoReferencia] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0,00");

  // Mandatory KYC docs (uploaded strictly to kyc-documents bucket)
  const [rgFrenteUrl, setRgFrenteUrl] = useState("");
  const [rgVersoUrl, setRgVersoUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  // Optional non-blocking trust badges & structure
  const [possuiAlvara, setPossuiAlvara] = useState(false);
  const [alvaraNumero, setAlvaraNumero] = useState("");
  const [alvaraValidade, setAlvaraValidade] = useState("");
  const [alvaraPhotoUrl, setAlvaraPhotoUrl] = useState("");
  const [possuiVigilancia, setPossuiVigilancia] = useState(false);
  const [vigilanciaPhotoUrl, setVigilanciaPhotoUrl] = useState("");
  const [tipoEstrutura, setTipoEstrutura] = useState("");
  const [estruturaPhotoUrl, setEstruturaPhotoUrl] = useState("");
  const [meiCnpj, setMeiCnpj] = useState("");

  const [existingKycStatus, setExistingKycStatus] = useState<string>("none");
  const [uploadingKey, setUploadingKey] = useState<UploadFieldKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    if (!user.uid) return;
    let active = true;

    const loadExisting = async () => {
      setLoadingInitial(true);
      try {
        const [ambRpcRes, cadRpcRes] = await Promise.all([
          Promise.resolve(supabase.rpc("get_my_ambulante_profile")).catch(() => ({
            data: null,
            error: null,
          })),
          Promise.resolve(supabase.rpc("get_my_cadastral_profile")).catch(() => ({
            data: null,
            error: null,
          })),
        ]);

        if (!active) return;

        const cad = (cadRpcRes as any)?.data;
        const ambRaw = (ambRpcRes as any)?.data;
        const amb = ambRaw && typeof ambRaw === "object" ? ambRaw.record ?? ambRaw : null;

        if (amb && (amb.user_id || amb.nome_comercial)) {
          setExistingKycStatus(amb.kyc_status || "none");
          setNomeComercial(amb.nome_comercial || "");
          setCpf(amb.cpf ? maskCPF(String(amb.cpf)) : "");
          setTelefone(amb.telefone ? maskPhone(String(amb.telefone)) : "");
          setChavePix(amb.chave_pix || "");
          if (Array.isArray(amb.modalidades) && amb.modalidades.length > 0) {
            setModalidades(amb.modalidades);
          }
          if (amb.praia_referencia) setPraiaReferencia(amb.praia_referencia);
          setPontoReferencia(amb.ponto_referencia || "");
          setDeliveryFee(Number(amb.delivery_fee ?? 0).toFixed(2).replace(".", ","));
          setRgFrenteUrl(amb.rg_cnh_frente_url || "");
          setRgVersoUrl(amb.rg_cnh_verso_url || "");
          setSelfieUrl(amb.selfie_url || "");
          setPossuiAlvara(Boolean(amb.possui_alvara));
          setAlvaraNumero(amb.alvara_numero || "");
          setAlvaraValidade(amb.alvara_validade || "");
          setAlvaraPhotoUrl(amb.alvara_photo_url || "");
          setPossuiVigilancia(Boolean(amb.possui_vigilancia_sanitaria));
          setVigilanciaPhotoUrl(amb.vigilancia_photo_url || "");
          setTipoEstrutura(amb.tipo_estrutura || "");
          setEstruturaPhotoUrl(amb.estrutura_photo_url || "");
          setMeiCnpj(amb.mei_cnpj || "");
        } else if (cad && typeof cad === "object") {
          setNomeComercial((prev) => prev || cad.nome || user.name || "");
          setCpf((prev) => prev || (cad.cpf ? maskCPF(String(cad.cpf)) : ""));
          setTelefone((prev) => prev || (cad.telefone ? maskPhone(String(cad.telefone)) : ""));
          setChavePix((prev) => prev || cad.chave_pix || "");
        }
      } catch (err) {
        console.error("Erro ao carregar perfil de ambulante:", err);
      } finally {
        if (active) setLoadingInitial(false);
      }
    };

    loadExisting();
    return () => {
      active = false;
    };
  }, [user.uid, user.name]);

  const toggleModalidade = (mod: "entrega" | "retirada") => {
    setModalidades((prev) => {
      if (prev.includes(mod)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((m) => m !== mod);
      }
      return [...prev, mod];
    });
  };

  const handleUpload = async (key: UploadFieldKey, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user.uid) return;

    setUploadingKey(key);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filePath = `ambulante/${user.uid}/${key}_${Date.now()}.${ext}`;

      // Strictly upload to kyc-documents bucket (NEVER catalogo-ambulantes!)
      const { error: uploadErr } = await supabase.storage
        .from("kyc-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage.from("kyc-documents").getPublicUrl(filePath);
      const storedRef = pubData?.publicUrl || filePath;

      if (key === "rg_frente") setRgFrenteUrl(storedRef);
      if (key === "rg_verso") setRgVersoUrl(storedRef);
      if (key === "selfie") setSelfieUrl(storedRef);
      if (key === "alvara_photo") setAlvaraPhotoUrl(storedRef);
      if (key === "vigilancia_photo") setVigilanciaPhotoUrl(storedRef);
      if (key === "estrutura_photo") setEstruturaPhotoUrl(storedRef);

      showToast("Arquivo enviado com segurança ✓");
    } catch (err: any) {
      console.error("Erro no upload KYC ambulante:", err);
      showToast(err?.message || "Erro ao enviar arquivo. Tente novamente.");
    } finally {
      setUploadingKey(null);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.uid) return;

    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanPhone = telefone.replace(/\D/g, "");
    const parsedFee = Number(deliveryFee.replace(",", ".").trim());

    if (!nomeComercial.trim()) {
      showToast("Informe seu Nome Comercial / Barraca.");
      return;
    }
    if (cleanCpf.length < 11) {
      showToast("Informe um CPF válido com 11 dígitos.");
      return;
    }
    if (cleanPhone.length < 10) {
      showToast("Informe um telefone/WhatsApp válido.");
      return;
    }
    if (!chavePix.trim()) {
      showToast("Informe sua chave PIX para recebimentos.");
      return;
    }
    if (!Number.isFinite(parsedFee) || parsedFee < 0) {
      showToast("Informe uma taxa de entrega válida (0,00 ou maior).");
      return;
    }
    if (!rgFrenteUrl || !rgVersoUrl || !selfieUrl) {
      showToast("Envie os 3 documentos obrigatórios de identidade (RG/CNH Frente, Verso e Selfie).");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_ambulante_kyc", {
        p_nome_comercial: nomeComercial.trim(),
        p_cpf: cleanCpf,
        p_telefone: cleanPhone,
        p_chave_pix: chavePix.trim(),
        p_modalidades: modalidades,
        p_praia_referencia: praiaReferencia.trim() || "Praia Grande",
        p_ponto_referencia: pontoReferencia.trim() || null,
        p_delivery_fee: Number(parsedFee.toFixed(2)),
        p_rg_cnh_frente_url: rgFrenteUrl,
        p_rg_cnh_verso_url: rgVersoUrl,
        p_selfie_url: selfieUrl,
        // Non-blocking optional trust badges & structure
        p_possui_alvara: possuiAlvara,
        p_alvara_numero: alvaraNumero.trim() || null,
        p_alvara_validade: alvaraValidade.trim() || null,
        p_alvara_photo_url: alvaraPhotoUrl || null,
        p_possui_vigilancia_sanitaria: possuiVigilancia,
        p_vigilancia_photo_url: vigilanciaPhotoUrl || null,
        p_tipo_estrutura: tipoEstrutura || null,
        p_estrutura_photo_url: estruturaPhotoUrl || null,
        p_mei_cnpj: meiCnpj.replace(/\D/g, "") || null,
      });

      if (error) throw error;

      showToast("Cadastro KYC de Ambulante enviado com sucesso!");
      if (existingKycStatus === "approved") {
        navigate("/app/prestador/ambulantes/online", { replace: true });
      } else {
        navigate("/app/prestador/ambulantes/kyc-pending", { replace: true });
      }
    } catch (err: any) {
      console.error("Erro ao enviar KYC ambulante:", err);
      showToast(err?.message || "Erro ao salvar cadastro KYC. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-[100svh] bg-[#09090B] text-white flex items-center justify-center font-sans text-sm">
        Carregando cadastro de Ambulante...
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-[#09090B] text-zinc-100 pb-24">
      <Toast message={toast} />

      <header className="sticky top-0 z-20 bg-[#09090B]/95 backdrop-blur-md border-b border-[#27272A] px-4 py-3.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/app/prestador/home")}
          aria-label="Voltar"
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-[17px] font-bold text-white leading-tight">
            Cadastro de Ambulante (KYC)
          </h1>
          <p className="text-[11px] text-zinc-400">
            Identidade obrigatória + selos opcionais de confiança
          </p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SEÇÃO 1: IDENTIFICAÇÃO & DADOS BANCÁRIOS (OBRIGATÓRIOS) */}
          <section className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-[#27272A] pb-2">
              <ShieldCheck size={18} className="text-[#00FF66]" />
              1. Identidade & Recebimento (Obrigatório)
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Nome Comercial / Barraca *
              </label>
              <input
                type="text"
                value={nomeComercial}
                onChange={(e) => setNomeComercial(e.target.value)}
                placeholder="Ex: Barraca do João - Pastel e Caldo"
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  CPF do Titular *
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  WhatsApp / Telefone *
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  placeholder="(12) 99999-9999"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Chave PIX para Repasses *
              </label>
              <input
                type="text"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                placeholder="CPF, celular, e-mail ou chave aleatória"
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
              />
            </div>

            {/* 3 Mandatory KYC document uploads */}
            <div className="pt-2 space-y-2.5">
              <p className="text-xs font-semibold text-zinc-300">
                Documentos de Identidade Obrigatórios (bucket seguro kyc-documents):
              </p>

              {(
                [
                  { key: "rg_frente" as const, label: "RG ou CNH (Frente) *", value: rgFrenteUrl },
                  { key: "rg_verso" as const, label: "RG ou CNH (Verso) *", value: rgVersoUrl },
                  { key: "selfie" as const, label: "Selfie segurando o documento *", value: selfieUrl },
                ] as const
              ).map((doc) => (
                <label
                  key={doc.key}
                  className="flex items-center justify-between gap-3 border border-dashed rounded-xl px-3.5 py-3 bg-[#09090B] cursor-pointer transition-colors"
                  style={{ borderColor: doc.value ? "#0DB87E" : "#27272A" }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {doc.value ? (
                      <CheckCircle2 size={18} className="text-[#0DB87E] shrink-0" />
                    ) : (
                      <Camera size={18} className="text-zinc-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{doc.label}</p>
                      <p className="text-[11px] text-zinc-400">
                        {uploadingKey === doc.key
                          ? "Enviando..."
                          : doc.value
                            ? "Documento anexado ✓"
                            : "Toque para fotografar ou enviar"}
                      </p>
                    </div>
                  </div>
                  <UploadCloud size={18} className="text-zinc-400 shrink-0" />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(ev) => handleUpload(doc.key, ev)}
                    className="hidden"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* SEÇÃO 2: ATUAÇÃO NA PRAIA, MODALIDADES & TAXA DE ENTREGA */}
          <section className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm border-b border-[#27272A] pb-2">
              <MapPin size={18} className="text-[#00FF66]" />
              2. Praia, Modalidades & Taxa de Entrega
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  id: "entrega" as const,
                  title: "Entrega na Areia",
                  desc: "Você leva até o guarda-sol",
                  Icon: Bike,
                },
                {
                  id: "retirada" as const,
                  title: "Retirada no Ponto",
                  desc: "Cliente retira (taxa R$ 0,00)",
                  Icon: Store,
                },
              ].map(({ id, title, desc, Icon }) => {
                const active = modalidades.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleModalidade(id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? "border-[#0DB87E] bg-[#0DB87E]/10"
                        : "border-[#27272A] bg-[#09090B]"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-[#00FF66]" : "text-zinc-400"} />
                    <p className="text-xs font-bold text-white mt-2">{title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{desc}</p>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1.5">
                <Truck size={14} className="text-[#0DB87E]" />
                Sua Taxa de Entrega Individual (R$) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="0,00"
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Deixe <strong>0,00</strong> para aparecer como "Entrega grátis". Retiradas no ponto são sempre R$ 0,00.
              </p>
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
                Ponto de Referência (Ex: Posto 3, em frente ao Quiosque X)
              </label>
              <input
                type="text"
                value={pontoReferencia}
                onChange={(e) => setPontoReferencia(e.target.value)}
                placeholder="Ex: Próximo ao Posto 3"
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
              />
            </div>
          </section>

          {/* SEÇÃO 3: SELOS DE CONFIANÇA & ESTRUTURA (OPCIONAIS — NÃO IMPEDITIVOS) */}
          <section className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 space-y-4">
            <div className="border-b border-[#27272A] pb-2">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Sparkles size={18} className="text-[#0DB87E]" />
                3. Selos de Confiança & Estrutura (opcionais — exibidos ao cliente na praia)
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Nenhum campo abaixo bloqueia seu cadastro ou aprovação. Preencha os que possuir para exibir selos no seu cardápio.
              </p>
            </div>

            {/* Alvará Municipal */}
            <div className="space-y-3 rounded-xl p-3 bg-[#09090B] border border-[#27272A]">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-semibold text-white">Possuo Alvará Municipal</span>
                <input
                  type="checkbox"
                  checked={possuiAlvara}
                  onChange={(e) => setPossuiAlvara(e.target.checked)}
                  className="w-4 h-4 accent-[#0DB87E]"
                />
              </label>

              {possuiAlvara && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Número do Alvará</label>
                      <input
                        type="text"
                        value={alvaraNumero}
                        onChange={(e) => setAlvaraNumero(e.target.value)}
                        placeholder="Ex: PMU-2026/0491"
                        className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Validade do Alvará</label>
                      <input
                        type="date"
                        value={alvaraValidade}
                        onChange={(e) => setAlvaraValidade(e.target.value)}
                        className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                  <label className="flex items-center justify-between gap-2 border border-dashed border-[#27272A] rounded-lg px-3 py-2 cursor-pointer">
                    <span className="text-xs text-zinc-300">
                      {uploadingKey === "alvara_photo"
                        ? "Enviando foto do alvará..."
                        : alvaraPhotoUrl
                          ? "Foto do alvará anexada ✓"
                          : "Anexar foto do Alvará (opcional)"}
                    </span>
                    <FileText size={16} className="text-zinc-400" />
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(ev) => handleUpload("alvara_photo", ev)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Vigilância Sanitária */}
            <div className="space-y-3 rounded-xl p-3 bg-[#09090B] border border-[#27272A]">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-semibold text-white">
                  Possuo Certificado da Vigilância Sanitária
                </span>
                <input
                  type="checkbox"
                  checked={possuiVigilancia}
                  onChange={(e) => setPossuiVigilancia(e.target.checked)}
                  className="w-4 h-4 accent-[#0DB87E]"
                />
              </label>

              {possuiVigilancia && (
                <label className="flex items-center justify-between gap-2 border border-dashed border-[#27272A] rounded-lg px-3 py-2 cursor-pointer">
                  <span className="text-xs text-zinc-300">
                    {uploadingKey === "vigilancia_photo"
                      ? "Enviando certificado..."
                      : vigilanciaPhotoUrl
                        ? "Certificado anexado ✓"
                        : "Anexar foto do Certificado (opcional)"}
                  </span>
                  <FileText size={16} className="text-zinc-400" />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(ev) => handleUpload("vigilancia_photo", ev)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Estrutura & MEI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Tipo de Estrutura (Opcional)
                </label>
                <select
                  value={tipoEstrutura}
                  onChange={(e) => setTipoEstrutura(e.target.value)}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  {TIPOS_ESTRUTURA.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  MEI / CNPJ (Opcional)
                </label>
                <input
                  type="text"
                  value={meiCnpj}
                  onChange={(e) => setMeiCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 border border-dashed border-[#27272A] rounded-xl px-3.5 py-3 bg-[#09090B] cursor-pointer">
              <span className="text-xs text-zinc-300">
                {uploadingKey === "estrutura_photo"
                  ? "Enviando foto da barraca/carrinho..."
                  : estruturaPhotoUrl
                    ? "Foto da barraca/carrinho anexada ✓"
                    : "Foto da sua barraca ou carrinho (opcional)"}
              </span>
              <UploadCloud size={18} className="text-zinc-400" />
              <input
                type="file"
                accept="image/*"
                onChange={(ev) => handleUpload("estrutura_photo", ev)}
                className="hidden"
              />
            </label>
          </section>

          <button
            type="submit"
            disabled={submitting || uploadingKey !== null}
            className="w-full bg-[#00FF66] text-black font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-[#00FF66]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {submitting
              ? "Enviando cadastro KYC..."
              : existingKycStatus === "approved"
                ? "Atualizar Cadastro de Ambulante"
                : "Enviar KYC para Aprovação"}
          </button>
        </form>
      </main>
    </div>
  );
}
