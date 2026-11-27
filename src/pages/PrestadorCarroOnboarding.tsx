import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User as UserIcon,
  Hash,
  Upload,
  CheckCircle2,
  Car,
  Package,
  Info,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Snowflake,
  BadgeCheck,
  Palette,
  Calendar,
  DoorClosed,
  FileCheck2,
} from "lucide-react";
import FormFieldLight from "@/components/prestador/FormFieldLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";
import { maskCPF } from "@/utils/masks";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const maskPlate = (v: string) =>
  v
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .replace(/([A-Z]{3})([0-9A-Z]{0,4})/, "$1-$2")
    .slice(0, 8);

type Modalidade = "carona_entrega" | "so_entrega" | "so_carona";

const TopBar = () => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between mb-4">
      <button type="button" onClick={() => navigate(-1)} aria-label="Voltar">
        <ArrowLeft size={22} color="#FFFFFF" />
      </button>
      <span className="font-display text-[18px] font-bold text-white">UBT · Carros</span>
      <span style={{ width: 22 }} />
    </div>
  );
};

const UploadArea = ({
  label,
  optional = false,
  file,
  existingUrl,
  onFile,
}: {
  label: string;
  optional?: boolean;
  file: File | null;
  existingUrl?: string | null;
  onFile: (f: File) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(existingUrl || null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, existingUrl]);

  const hasImage = preview !== null;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-98"
        style={{
          border: `2px dashed ${hasImage ? "#00FF66" : "#27272a"}`,
          background: hasImage ? "rgba(0,255,102,0.06)" : "#18181b",
          padding: "20px 16px",
        }}
      >
        {hasImage ? (
          <div className="flex items-center gap-3 w-full">
            <img
              src={preview!}
              alt={label}
              className="rounded-lg border border-[#00FF66]/30 shrink-0"
              style={{ width: 60, height: 60, objectFit: "cover" }}
            />
            <div className="text-left flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} color="#00FF66" className="shrink-0" />
                <span className="font-sans text-[13px] font-semibold text-white truncate block">
                  {file ? file.name : label}
                </span>
              </div>
              <span className="font-sans text-[11px] block mt-0.5 text-[#00FF66]">
                {file ? "Novo arquivo selecionado" : "Documento enviado (Clique para alterar)"}
              </span>
            </div>
          </div>
        ) : (
          <>
            <Upload size={26} color="#9399AD" />
            <span className="font-sans text-[14px]" style={{ color: "#A1A1AA" }}>
              {label}
              {optional && <span className="ml-1.5 text-[11px] text-zinc-500">(Opcional)</span>}
            </span>
          </>
        )}
      </button>
    </div>
  );
};

const PrestadorCarroOnboarding = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Status KYC");

  const [existingKyc, setExistingKyc] = useState<any | null>(null);

  // Obrigatórios — Pessoal
  const [cpf, setCpf] = useState("");
  const [sex, setSex] = useState<"M" | "F" | null>(null);

  // Documentos Condutor
  const [cnhFront, setCnhFront] = useState<File | null>(null);
  const [cnhBack, setCnhBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  // Obrigatórios — Veículo
  const [plate, setPlate] = useState("");
  const [brandModel, setBrandModel] = useState("");

  // Atributos Descritivos Opcionais (NÃO IMPEDITIVOS)
  const [cor, setCor] = useState("");
  const [ano, setAno] = useState("");
  const [portas, setPortas] = useState("");
  const [arCondicionado, setArCondicionado] = useState(false);
  const [cnhCategoria, setCnhCategoria] = useState("");
  const [possuiEar, setPossuiEar] = useState(false);
  const [alvaraMunicipal, setAlvaraMunicipal] = useState("");
  const [vehicleSubtype, setVehicleSubtype] = useState("padrao");

  // Documentos Veículo
  const [crlvFile, setCrlvFile] = useState<File | null>(null);
  const [carroFile, setCarroFile] = useState<File | null>(null);
  const [carroInternoFile, setCarroInternoFile] = useState<File | null>(null);

  // Modo de trabalho
  const [modalidade, setModalidade] = useState<Modalidade | null>("carona_entrega");

  const canStepPessoal = cpf.replace(/\D/g, "").length === 11 && !!sex;
  const canStepDadosVeiculo = plate.replace(/[^A-Za-z0-9]/g, "").length >= 7 && brandModel.trim().length >= 3;

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (user.user_metadata) {
        if (user.user_metadata.cpf) setCpf(maskCPF(user.user_metadata.cpf));
        if (user.user_metadata.sexo) setSex(user.user_metadata.sexo);
      }

      try {
        const { data: rpcProfile, error: rpcErr } = await supabase.rpc("get_my_carro_profile");
        let carRecord: any = null;

        if (!rpcErr && rpcProfile && typeof rpcProfile === "object") {
          carRecord = (rpcProfile as any).record ?? rpcProfile;
        } else {
          const { data: fallbackCar } = await supabase
            .from("prestador_carro")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();
          carRecord = fallbackCar;
        }

        if (carRecord && carRecord.user_id) {
          setExistingKyc(carRecord);
          if (carRecord.cpf) setCpf(maskCPF(carRecord.cpf));
          if (carRecord.plate) setPlate(maskPlate(carRecord.plate));
          if (carRecord.brand_model) setBrandModel(carRecord.brand_model);
          if (carRecord.gender) setSex(carRecord.gender === "feminino" ? "F" : "M");
          if (carRecord.modalidade) setModalidade(carRecord.modalidade);
          if (carRecord.cor) setCor(String(carRecord.cor));
          if (carRecord.ano) setAno(String(carRecord.ano));
          if (carRecord.portas) setPortas(String(carRecord.portas));
          if (typeof carRecord.ar_condicionado === "boolean") setArCondicionado(carRecord.ar_condicionado);
          if (carRecord.cnh_categoria) setCnhCategoria(String(carRecord.cnh_categoria));
          if (typeof carRecord.possui_ear === "boolean") setPossuiEar(carRecord.possui_ear);
          if (carRecord.alvara_municipal) setAlvaraMunicipal(String(carRecord.alvara_municipal));
          if (carRecord.vehicle_subtype) setVehicleSubtype(String(carRecord.vehicle_subtype));
        } else {
          const { data: usuarioRow } = await supabase
            .from("usuarios")
            .select("cpf")
            .eq("id", user.id)
            .maybeSingle();
          if (usuarioRow?.cpf) setCpf(maskCPF(usuarioRow.cpf));
        }
      } catch (err) {
        console.warn("Erro ao buscar prestador_carro:", err);
      }
    });
  }, []);

  const uploadDoc = async (file: File, docType: string, userId: string): Promise<string | null> => {
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `carro/${userId}/${docType}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error(`Erro ao subir ${docType}:`, uploadError);
        return null;
      }

      const { data } = supabase.storage.from("kyc-documents").getPublicUrl(filePath);
      return data?.publicUrl || null;
    } catch (e) {
      console.error(`Exceção upload ${docType}:`, e);
      return null;
    }
  };

  const submit = async () => {
    setFormError(null);
    setSuccessMessage(null);

    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11 || !sex) {
      const missing: string[] = [];
      if (cpfDigits.length !== 11) missing.push("CPF válido (11 dígitos)");
      if (!sex) missing.push("Sexo");
      const msg = `Preencha os campos obrigatórios na aba Pessoal antes de salvar: ${missing.join(" e ")}.`;
      setFormError(msg);
      toast.error(msg);
      setActiveTab("Pessoal");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const plateClean = plate.replace(/[^A-Za-z0-9]/g, "");
    if (plateClean.length < 7 || brandModel.trim().length < 3) {
      const missing: string[] = [];
      if (plateClean.length < 7) missing.push("Placa do carro");
      if (brandModel.trim().length < 3) missing.push("Marca e Modelo do carro");
      const msg = `Preencha os campos obrigatórios na aba Dados Veículo antes de salvar: ${missing.join(" e ")}.`;
      setFormError(msg);
      toast.error(msg);
      setActiveTab("Dados Veículo");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!modalidade) {
      const msg = "Selecione como você quer trabalhar na aba Modo antes de salvar.";
      setFormError(msg);
      toast.error(msg);
      setActiveTab("Modo");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const msg = "Sessão expirada. Faça login novamente para salvar suas configurações.";
        setFormError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      const [
        cnhFrenteUrl,
        cnhVersoUrl,
        selfieUrl,
        crlvUrl,
        carroPhotoUrl,
        carroInternoPhotoUrl,
      ] = await Promise.all([
        cnhFront ? uploadDoc(cnhFront, "cnh_frente", user.id) : Promise.resolve(existingKyc?.cnh_frente_url || null),
        cnhBack ? uploadDoc(cnhBack, "cnh_verso", user.id) : Promise.resolve(existingKyc?.cnh_verso_url || null),
        selfie ? uploadDoc(selfie, "selfie", user.id) : Promise.resolve(existingKyc?.selfie_url || null),
        crlvFile ? uploadDoc(crlvFile, "crlv", user.id) : Promise.resolve(existingKyc?.crlv_url || null),
        carroFile ? uploadDoc(carroFile, "foto_carro", user.id) : Promise.resolve(existingKyc?.carro_photo_url || null),
        carroInternoFile
          ? uploadDoc(carroInternoFile, "foto_carro_interno", user.id)
          : Promise.resolve(existingKyc?.carro_interno_photo_url || null),
      ]);

      const parsedAno = ano.trim() && Number.isFinite(Number(ano)) ? Math.trunc(Number(ano)) : null;
      const parsedPortas = portas.trim() && Number.isFinite(Number(portas)) ? Math.trunc(Number(portas)) : null;

      try {
        await supabase.auth.updateUser({
          data: {
            cpf,
            sexo: sex,
            placa_carro: plate,
            modelo_carro: brandModel.trim(),
            modalidade_carro: modalidade,
          },
        });
      } catch (metaErr) {
        console.warn("Aviso ao atualizar user_metadata (Carros):", metaErr);
      }

      const genderMapped = sex === "F" ? "feminino" : "masculino";
      const { data: rpcData, error: rpcError } = await supabase.rpc("submit_carro_kyc", {
        p_cpf: cpf,
        p_plate: plate,
        p_brand_model: brandModel.trim(),
        p_gender: genderMapped,
        p_modalidade: modalidade,
        p_cnh_frente_url: cnhFrenteUrl,
        p_cnh_verso_url: cnhVersoUrl,
        p_selfie_url: selfieUrl,
        p_crlv_url: crlvUrl,
        p_carro_photo_url: carroPhotoUrl,
        p_carro_interno_photo_url: carroInternoPhotoUrl,
        p_vehicle_subtype: vehicleSubtype || "padrao",
        p_cor: cor.trim() || null,
        p_ano: parsedAno,
        p_portas: parsedPortas,
        p_ar_condicionado: arCondicionado,
        p_cnh_categoria: cnhCategoria.trim() || null,
        p_possui_ear: possuiEar,
        p_alvara_municipal: alvaraMunicipal.trim() || null,
      });

      if (rpcError) {
        throw new Error(rpcError.message || "Falha ao gravar cadastro de Motorista de Carro no servidor.");
      }

      const payload = rpcData as any;
      if (!payload || payload.ok === false) {
        throw new Error(payload?.error || "Não foi possível salvar seu cadastro de Carros.");
      }

      if (payload.record) {
        setExistingKyc(payload.record);
      }

      const okMsg =
        payload.kyc_status === "approved"
          ? "Configurações de Carros atualizadas com sucesso!"
          : "Configurações salvas! Seu cadastro de Carros foi enviado para análise de KYC pela equipe UBT.";

      setSuccessMessage(okMsg);
      toast.success(okMsg);
      setActiveTab("Status KYC");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Erro ao salvar onboarding carro:", err);
      const errMsg = err?.message || "Erro inesperado ao salvar configurações. Tente novamente.";
      setFormError(errMsg);
      toast.error(errMsg);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const TABS = ["Status KYC", "Pessoal", "Docs Condutor", "Dados Veículo", "Docs Veículo", "Modo"];

  const getDocStatusBadge = (url?: string | null) => {
    const overall = existingKyc?.kyc_status;
    if (!url) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-800">
          Não enviado
        </span>
      );
    }
    if (overall === "approved") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
          <CheckCircle2 size={12} strokeWidth={3} /> Aprovado
        </span>
      );
    }
    if (overall === "rejected") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-500/15 text-red-400 border border-red-500/30">
          <AlertCircle size={12} strokeWidth={3} /> Rejeitado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Clock size={12} strokeWidth={3} /> Em Análise
      </span>
    );
  };

  const docsList = [
    {
      num: "01",
      title: "CNH — Frente",
      desc: "Foto frontal da Carteira Nacional de Habilitação legível.",
      emoji: "🪪",
      url: existingKyc?.cnh_frente_url,
      tabTarget: "Docs Condutor",
    },
    {
      num: "02",
      title: "CNH — Verso",
      desc: "Foto do verso com QR Code e dados complementares.",
      emoji: "🪪",
      url: existingKyc?.cnh_verso_url,
      tabTarget: "Docs Condutor",
    },
    {
      num: "03",
      title: "Selfie com Documento",
      desc: "Foto segurando a CNH ao lado do rosto para validação biométrica.",
      emoji: "🤳",
      url: existingKyc?.selfie_url,
      tabTarget: "Docs Condutor",
    },
    {
      num: "04",
      title: "CRLV do Carro",
      desc: "Documento oficial do veículo em dia (exercício vigente).",
      emoji: "🚗",
      url: existingKyc?.crlv_url,
      tabTarget: "Docs Veículo",
    },
    {
      num: "05",
      title: "Foto do Carro (Placa)",
      desc: "Foto externa do automóvel com a placa nítida e visível.",
      emoji: "📸",
      url: existingKyc?.carro_photo_url,
      tabTarget: "Docs Veículo",
    },
  ];

  return (
    <div
      className="min-h-[100svh] overflow-y-auto text-zinc-100 bg-black font-sans"
      style={{ padding: "24px", paddingBottom: "180px" }}
    >
      <TopBar />

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            id={`tab-${t}`}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: activeTab === t ? "#00FF66" : "#18181b",
              color: activeTab === t ? "#000000" : "#A1A1AA",
              fontFamily: "DM Sans",
              fontWeight: 700,
              fontSize: 13,
              border: activeTab === t ? "none" : "1px solid #27272a",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {formError && (
          <div className="mb-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm font-medium text-red-200 leading-relaxed">{formError}</p>
          </div>
        )}
        {successMessage && (
          <div className="mb-4 rounded-2xl border border-[#00FF66]/40 bg-[#00FF66]/10 p-4 flex items-start gap-3">
            <CheckCircle2 size={18} className="text-[#00FF66] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm font-medium text-[#00FF66] leading-relaxed">{successMessage}</p>
          </div>
        )}

        {activeTab === "Status KYC" && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 bg-zinc-900 border border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-sans text-[12px] font-bold text-zinc-400 uppercase tracking-wider">
                  Status Geral do Cadastro
                </span>
                {existingKyc?.kyc_status === "approved" ? (
                  <span className="px-3 py-1 rounded-full text-[12px] font-black bg-[#00FF66]/20 text-[#00FF66] border border-[#00FF66]/40 flex items-center gap-1.5">
                    <ShieldCheck size={14} /> Cadastro Aprovado
                  </span>
                ) : existingKyc?.kyc_status === "rejected" ? (
                  <span className="px-3 py-1 rounded-full text-[12px] font-black bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Documentação Rejeitada
                  </span>
                ) : existingKyc?.kyc_status === "pending" ? (
                  <span className="px-3 py-1 rounded-full text-[12px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
                    <Clock size={14} /> Em Análise pela Equipe
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[12px] font-black bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1.5">
                    <Info size={14} /> Cadastro Não Enviado
                  </span>
                )}
              </div>

              <h2 className="text-[18px] font-black text-white">Documentos e Regras de Carros</h2>
              <p className="text-[13px] text-zinc-400 mt-1">
                {existingKyc?.kyc_status === "approved"
                  ? "Sua documentação de Carros está regularizada e você está habilitado para receber chamados."
                  : existingKyc?.kyc_status === "pending"
                  ? "Seus dados e documentos de Carros foram enviados e estão em análise pela equipe da UBT."
                  : existingKyc?.kyc_status === "rejected"
                  ? "Seu cadastro precisa de ajustes. Revise seus dados/documentos e clique em Salvar Configurações."
                  : "Preencha seus dados pessoais, dados do veículo e modo de trabalho e clique em Salvar Configurações para entrar na fila de aprovação KYC."}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Documentação Base ({docsList.length})
                </span>
                <span className="text-xs text-zinc-500 font-mono">Processo KYC</span>
              </div>

              {docsList.map((doc) => {
                const hasDoc = !!doc.url;
                return (
                  <div
                    key={doc.title}
                    onClick={() => setActiveTab(doc.tabTarget)}
                    className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-4 ${
                      hasDoc
                        ? "bg-zinc-900 border-[#00FF66]/40 shadow-[0_0_15px_rgba(0,255,102,0.06)]"
                        : "bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden ${
                        hasDoc
                          ? "bg-[#00FF66]/15 border border-[#00FF66]/40 text-[#00FF66]"
                          : "bg-zinc-950 border border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {doc.url ? (
                        <img src={doc.url} alt={doc.title} className="w-full h-full object-cover" />
                      ) : (
                        <span>{doc.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-zinc-500 font-bold">{doc.num}.</span>
                        <h3 className="text-base font-black text-white truncate">{doc.title}</h3>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1 mb-2">{doc.desc}</p>
                      <div>{getDocStatusBadge(doc.url)}</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <PrimaryButtonLight onClick={() => setActiveTab("Pessoal")}>
                Editar Dados e Documentos
              </PrimaryButtonLight>
            </div>
          </div>
        )}

        {activeTab === "Pessoal" && (
          <div className="space-y-4">
            <h2 className="font-display text-[18px] font-bold text-white">Dados pessoais</h2>
            <FormFieldLight
              label="CPF"
              icon={Hash}
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
            <div>
              <label className="block font-sans text-[12px] font-semibold mb-1.5" style={{ color: "#A1A1AA" }}>
                Sexo
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(["M", "F"] as const).map((s) => {
                  const sel = sex === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSex(s)}
                      className="rounded-xl py-4 transition-colors"
                      style={{
                        border: `2px solid ${sel ? "#0DB87E" : "var(--prestador-border)"}`,
                        background: sel ? "rgba(13,184,126,0.15)" : "var(--prestador-card)",
                        color: sel ? "#0DB87E" : "#A1A1AA",
                      }}
                    >
                      <span className="font-sans text-[14px] font-semibold">
                        {s === "M" ? "Masculino 👨" : "Feminino 👩"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Docs Condutor" && (
          <div className="space-y-3">
            <h2 className="font-display text-[18px] font-bold text-white">Documentos do Condutor</h2>
            <UploadArea label="CNH — Frente" file={cnhFront} existingUrl={existingKyc?.cnh_frente_url} onFile={setCnhFront} />
            <UploadArea label="CNH — Verso" file={cnhBack} existingUrl={existingKyc?.cnh_verso_url} onFile={setCnhBack} />
            <UploadArea label="Selfie segurando a CNH" file={selfie} existingUrl={existingKyc?.selfie_url} onFile={setSelfie} />
          </div>
        )}

        {activeTab === "Dados Veículo" && (
          <div className="space-y-4">
            <h2 className="font-display text-[18px] font-bold text-white">Dados do Veículo</h2>
            <FormFieldLight
              label="Placa do carro"
              icon={Hash}
              value={plate}
              onChange={(e) => setPlate(maskPlate(e.target.value))}
              placeholder="ABC-1D23"
              className="uppercase"
            />
            <FormFieldLight
              label="Marca e Modelo do Carro"
              icon={Car}
              value={brandModel}
              onChange={(e) => setBrandModel(e.target.value)}
              placeholder="Chevrolet Onix 1.0 Turbo"
            />

            {/* Seção Opcional / Não Impeditiva */}
            <div className="rounded-2xl bg-[#121215] border border-zinc-800 p-4 space-y-4 mt-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-[15px] font-bold text-white">
                    Detalhes do Veículo (exibidos ao passageiro no chamado)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 shrink-0">
                    Opcional
                  </span>
                </div>
                <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">
                  Nenhum destes detalhes bloqueia seu cadastro ou aprovação. Eles são opcionais e ajudam a dar mais transparência ao passageiro na hora do chamado.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormFieldLight
                  label="Cor (opcional)"
                  icon={Palette}
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  placeholder="Prata"
                />
                <FormFieldLight
                  label="Ano (opcional)"
                  icon={Calendar}
                  value={ano}
                  onChange={(e) => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2022"
                  inputMode="numeric"
                />
                <FormFieldLight
                  label="Portas (opcional)"
                  icon={DoorClosed}
                  value={portas}
                  onChange={(e) => setPortas(e.target.value.replace(/\D/g, "").slice(0, 1))}
                  placeholder="4"
                  inputMode="numeric"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="carro-cnh-categoria" className="block font-sans text-[12px] font-semibold mb-1.5 text-zinc-400">
                    Categoria da CNH (opcional)
                  </label>
                  <select
                    id="carro-cnh-categoria"
                    value={cnhCategoria}
                    onChange={(e) => setCnhCategoria(e.target.value)}
                    className="w-full h-12 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-sm text-white outline-none focus:border-[#00E676]"
                  >
                    <option value="">Não informar</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="carro-vehicle-subtype" className="block font-sans text-[12px] font-semibold mb-1.5 text-zinc-400">
                    Subtipo do Veículo
                  </label>
                  <select
                    id="carro-vehicle-subtype"
                    value={vehicleSubtype}
                    onChange={(e) => setVehicleSubtype(e.target.value)}
                    className="w-full h-12 rounded-xl bg-zinc-950 border border-zinc-800 px-3 text-sm text-white outline-none focus:border-[#00E676]"
                  >
                    <option value="padrao">Padrão</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-3 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm text-zinc-200">
                    <Snowflake size={16} className="text-sky-400" />
                    Ar-condicionado
                  </span>
                  <input
                    type="checkbox"
                    checked={arCondicionado}
                    onChange={(e) => setArCondicionado(e.target.checked)}
                    className="w-5 h-5 accent-[#00E676]"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-3 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm text-zinc-200">
                    <BadgeCheck size={16} className="text-[#00E676]" />
                    Possui EAR na CNH
                  </span>
                  <input
                    type="checkbox"
                    checked={possuiEar}
                    onChange={(e) => setPossuiEar(e.target.checked)}
                    className="w-5 h-5 accent-[#00E676]"
                  />
                </label>
              </div>

              <FormFieldLight
                label="Alvará Municipal (opcional)"
                icon={FileCheck2}
                value={alvaraMunicipal}
                onChange={(e) => setAlvaraMunicipal(e.target.value)}
                placeholder="Ex.: UBT-2026-001"
              />
            </div>
          </div>
        )}

        {activeTab === "Docs Veículo" && (
          <div className="space-y-3">
            <h2 className="font-display text-[18px] font-bold text-white">Documentos e Fotos do Carro</h2>
            <UploadArea label="CRLV (Certificado do Veículo)" file={crlvFile} existingUrl={existingKyc?.crlv_url} onFile={setCrlvFile} />
            <UploadArea label="Foto Externa do Carro (com a Placa visível)" file={carroFile} existingUrl={existingKyc?.carro_photo_url} onFile={setCarroFile} />
            <UploadArea
              label="Foto Interna do Carro"
              optional
              file={carroInternoFile}
              existingUrl={existingKyc?.carro_interno_photo_url}
              onFile={setCarroInternoFile}
            />
          </div>
        )}

        {activeTab === "Modo" && (
          <div className="space-y-3">
            <h2 className="font-display text-[18px] font-bold text-white">Como você quer trabalhar?</h2>
            <div className="flex flex-col gap-3">
              {([
                { key: "carona_entrega" as const, title: "Carona & Entrega", desc: "Transporte de passageiros e pacotes", icon: Car },
                { key: "so_entrega" as const, title: "Só Entrega", desc: "Transporte apenas de pacotes", icon: Package },
                { key: "so_carona" as const, title: "Só Carona", desc: "Transporte apenas de passageiros", icon: UserIcon },
              ]).map(({ key, title, desc, icon: Icon }) => {
                const sel = modalidade === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModalidade(key)}
                    className="w-full text-left rounded-2xl relative transition-colors"
                    style={{
                      border: `2px solid ${sel ? "#0DB87E" : "var(--prestador-border)"}`,
                      background: sel ? "rgba(13,184,126,0.15)" : "var(--prestador-card)",
                      padding: 20,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={24} color="#0DB87E" />
                      <div className="flex-1">
                        <p className="font-sans text-[16px] font-semibold text-white">{title}</p>
                        <p className="font-sans text-[13px] mt-0.5" style={{ color: "#A1A1AA" }}>
                          {desc}
                        </p>
                      </div>
                    </div>
                    {sel && (
                      <CheckCircle2 size={18} color="#0DB87E" style={{ position: "absolute", top: 12, right: 12 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab !== "Status KYC" && (
          <div style={{ position: "fixed", bottom: 64, left: 0, right: 0, padding: 24, background: "var(--prestador-bg)", borderTop: "1px solid var(--prestador-border)", zIndex: 10 }}>
            {activeTab === "Pessoal" ? (
              <PrimaryButtonLight onClick={() => setActiveTab("Docs Condutor")} disabled={!canStepPessoal}>
                Avançar para Documentos
              </PrimaryButtonLight>
            ) : activeTab === "Docs Condutor" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Pessoal")}
                  className="flex-1 font-sans font-bold text-[14px]"
                  style={{ border: "1px solid var(--prestador-border)", borderRadius: 12, color: "#A1A1AA", background: "var(--prestador-card)", padding: "14px 0" }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight onClick={() => setActiveTab("Dados Veículo")}>
                    Avançar para Veículo
                  </PrimaryButtonLight>
                </div>
              </div>
            ) : activeTab === "Dados Veículo" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Docs Condutor")}
                  className="flex-1 font-sans font-bold text-[14px]"
                  style={{ border: "1px solid var(--prestador-border)", borderRadius: 12, color: "#A1A1AA", background: "var(--prestador-card)", padding: "14px 0" }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight onClick={() => setActiveTab("Docs Veículo")} disabled={!canStepDadosVeiculo}>
                    Avançar para Fotos Veículo
                  </PrimaryButtonLight>
                </div>
              </div>
            ) : activeTab === "Docs Veículo" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Dados Veículo")}
                  className="flex-1 font-sans font-bold text-[14px]"
                  style={{ border: "1px solid var(--prestador-border)", borderRadius: 12, color: "#A1A1AA", background: "var(--prestador-card)", padding: "14px 0" }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight onClick={() => setActiveTab("Modo")}>
                    Avançar para Modo
                  </PrimaryButtonLight>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Docs Veículo")}
                  className="flex-1 font-sans font-bold text-[14px]"
                  style={{ border: "1px solid var(--prestador-border)", borderRadius: 12, color: "#A1A1AA", background: "var(--prestador-card)", padding: "14px 0" }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight onClick={submit} loading={loading} disabled={loading}>
                    {loading ? "Salvando..." : "Salvar Configurações"}
                  </PrimaryButtonLight>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrestadorCarroOnboarding;
