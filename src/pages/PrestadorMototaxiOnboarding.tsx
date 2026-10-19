import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, User as UserIcon, Hash, Upload, CheckCircle2, Bike, Package,
  User, Info, Loader2, AlertCircle, Clock, FileText, ExternalLink, ShieldCheck,
  ChevronRight,
} from "lucide-react";
import FormFieldLight from "@/components/prestador/FormFieldLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";

import { maskCPF } from "@/utils/masks";
import { supabase } from "@/lib/supabase";

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
      <button onClick={() => navigate(-1)} aria-label="Voltar">
        <ArrowLeft size={22} color="#FFFFFF" />
      </button>
      <span className="font-display text-[18px] font-bold text-white">
        UBT.
      </span>
      <span style={{ width: 22 }} />
    </div>
  );
};

const UploadArea = ({
  label,
  file,
  existingUrl,
  onFile,
}: {
  label: string;
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
          padding: "24px 16px",
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
                  {file ? file.name : `${label}`}
                </span>
              </div>
              <span className="font-sans text-[11px] block mt-0.5 text-[#00FF66]">
                {file ? "Novo arquivo selecionado" : "Documento enviado (Clique para alterar)"}
              </span>
            </div>
          </div>
        ) : (
          <>
            <Upload size={28} color="#9399AD" />
            <span className="font-sans text-[14px]" style={{ color: "#A1A1AA" }}>
              {label}
            </span>
          </>
        )}
      </button>
    </div>
  );
};

const PrestadorMototaxiOnboarding = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Status KYC");
  
  // KYC details from DB
  const [existingKyc, setExistingKyc] = useState<any | null>(null);
  const [kycLoaded, setKycLoaded] = useState(false);

  // step 1 - Pessoal
  const [cpf, setCpf] = useState("");
  const [sex, setSex] = useState<"M" | "F" | null>(null);

  // step 2 - Docs Condutor
  const [cnhFront, setCnhFront] = useState<File | null>(null);
  const [cnhBack, setCnhBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  // step 3 - Dados Veículo
  const [plate, setPlate] = useState("");
  const [brandModel, setBrandModel] = useState("");

  // step 4 - Docs Veículo
  const [crlvFile, setCrlvFile] = useState<File | null>(null);
  const [motoFile, setMotoFile] = useState<File | null>(null);

  // step 5 - Modo
  const [modalidade, setModalidade] = useState<Modalidade | null>("carona_entrega");

  const canStepPessoal = cpf.length === 14 && sex;
  const canStepDocsCondutor = true;
  const canStepDadosVeiculo = plate.length >= 7 && brandModel.trim().length >= 3;
  const canStepDocsVeiculo = true;
  const canStepModo = !!modalidade;

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      if (user.user_metadata) {
        if (user.user_metadata.cpf) setCpf(maskCPF(user.user_metadata.cpf));
        if (user.user_metadata.sexo) setSex(user.user_metadata.sexo);
        if (user.user_metadata.placa_moto) setPlate(maskPlate(user.user_metadata.placa_moto));
        if (user.user_metadata.modelo_moto) setBrandModel(user.user_metadata.modelo_moto);
        if (user.user_metadata.modalidade_moto) setModalidade(user.user_metadata.modalidade_moto);
      }

      try {
        const { data: motoRecord } = await supabase
          .from("prestador_mototaxi")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (motoRecord) {
          setExistingKyc(motoRecord);
          if (motoRecord.cpf) setCpf(maskCPF(motoRecord.cpf));
          if (motoRecord.plate) setPlate(maskPlate(motoRecord.plate));
          if (motoRecord.gender) setSex(motoRecord.gender === "feminino" ? "F" : "M");
          if (motoRecord.modalidade) setModalidade(motoRecord.modalidade);
        }
      } catch (err) {
        console.warn("Erro ao buscar prestador_mototaxi:", err);
      } finally {
        setKycLoaded(true);
      }
    });
  }, []);

  const uploadDoc = async (file: File, docType: string, userId: string): Promise<string | null> => {
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `mototaxi/${userId}/${docType}_${Date.now()}.${ext}`;
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
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 1. Upload files to Storage if new ones provided
        const [
          cnhFrenteUrl,
          cnhVersoUrl,
          selfieUrl,
          crlvUrl,
          motoPhotoUrl,
        ] = await Promise.all([
          cnhFront ? uploadDoc(cnhFront, "cnh_frente", user.id) : Promise.resolve(existingKyc?.cnh_frente_url || null),
          cnhBack ? uploadDoc(cnhBack, "cnh_verso", user.id) : Promise.resolve(existingKyc?.cnh_verso_url || null),
          selfie ? uploadDoc(selfie, "selfie", user.id) : Promise.resolve(existingKyc?.selfie_url || null),
          crlvFile ? uploadDoc(crlvFile, "crlv", user.id) : Promise.resolve(existingKyc?.crlv_url || null),
          motoFile ? uploadDoc(motoFile, "foto_moto", user.id) : Promise.resolve(existingKyc?.moto_photo_url || null),
        ]);

        // 2. Update Auth metadata
        await supabase.auth.updateUser({
          data: {
            cpf: cpf,
            sexo: sex,
            placa_moto: plate,
            modelo_moto: brandModel,
            modalidade_moto: modalidade,
          }
        });

        // 3. Persist to prestador_mototaxi table with storage URLs
        const genderMapped = sex === "F" ? "feminino" : "masculino";
        const { error: upsertErr } = await supabase.from("prestador_mototaxi").upsert({
          user_id: user.id,
          cpf: cpf,
          plate: plate,
          gender: genderMapped,
          modalidade: modalidade,
          kyc_status: existingKyc?.kyc_status === "approved" ? "approved" : "pending",
          is_online: false,
          cnh_frente_url: cnhFrenteUrl,
          cnh_verso_url: cnhVersoUrl,
          cnh_photo_url: cnhFrenteUrl,
          crlv_url: crlvUrl,
          moto_photo_url: motoPhotoUrl,
          selfie_url: selfieUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

        if (upsertErr) {
          console.error("Erro no upsert de prestador_mototaxi:", upsertErr);
          throw upsertErr;
        }

        // 4. Mark under_review in usuarios if pending
        if (existingKyc?.kyc_status !== "approved") {
          await supabase.from("usuarios").update({
            under_review: true
          }).eq("id", user.id);
        }
      }

      setLoading(false);
      navigate("/app/prestador/mototaxi/kyc-pending");
    } catch (err) {
      console.error("Erro ao salvar onboarding mototaxi:", err);
      setLoading(false);
      navigate("/app/prestador/mototaxi/kyc-pending");
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
      desc: "Foto frontal da Carteira Nacional de Habilitação (Cat. A) legível.",
      emoji: "🪪",
      url: existingKyc?.cnh_frente_url,
      tabTarget: "Docs Condutor"
    },
    {
      num: "02",
      title: "CNH — Verso",
      desc: "Foto do verso com QR Code e dados complementares.",
      emoji: "🪪",
      url: existingKyc?.cnh_verso_url,
      tabTarget: "Docs Condutor"
    },
    {
      num: "03",
      title: "Selfie com Documento",
      desc: "Foto segurando a CNH ao lado do rosto para validação biométrica.",
      emoji: "🤳",
      url: existingKyc?.selfie_url,
      tabTarget: "Docs Condutor"
    },
    {
      num: "04",
      title: "CRLV da Moto",
      desc: "Documento oficial do veículo em dia (exercício vigente).",
      emoji: "🛵",
      url: existingKyc?.crlv_url,
      tabTarget: "Docs Veículo"
    },
    {
      num: "05",
      title: "Foto da Moto (Placa)",
      desc: "Foto traseira da motocicleta com a placa nítida e visível.",
      emoji: "📸",
      url: existingKyc?.moto_photo_url,
      tabTarget: "Docs Veículo"
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
        {activeTab === "Status KYC" && (
          <div className="space-y-4">
            {/* Status Card Geral */}
            <div
              className="rounded-2xl p-5 bg-zinc-900 border border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
            >
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
                ) : (
                  <span className="px-3 py-1 rounded-full text-[12px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
                    <Clock size={14} /> Em Análise pela Equipe
                  </span>
                )}
              </div>

              <h2 className="text-[18px] font-black text-white">
                Documentos e Regras de Mototáxi
              </h2>
              <p className="text-[13px] text-zinc-400 mt-1">
                {existingKyc?.kyc_status === "approved"
                  ? "Sua documentação está regularizada e você está habilitado para receber chamados de corrida e entrega."
                  : "Seus documentos estão em processo de validação pela equipe de operações da UBT."}
              </p>
            </div>

            {/* Lista de Documentos em Cards Modernos (Design System Unificado) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Documentação Obrigatória ({docsList.length})
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
                    {/* Ícone Grande / Preview em destaque */}
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105 overflow-hidden relative ${
                        hasDoc
                          ? "bg-[#00FF66]/15 border border-[#00FF66]/40 text-[#00FF66]"
                          : "bg-zinc-950 border border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {doc.url ? (
                        <img
                          src={doc.url}
                          alt={doc.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{doc.emoji}</span>
                      )}
                    </div>

                    {/* Informações do Documento */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-zinc-500 font-bold">
                          {doc.num}.
                        </span>
                        <h2 className="text-base font-black text-white truncate group-hover:text-[#00FF66] transition-colors">
                          {doc.title}
                        </h2>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1 mb-2">
                        {doc.desc}
                      </p>

                      {/* Badge de Status */}
                      <div>
                        {getDocStatusBadge(doc.url)}
                      </div>
                    </div>

                    {/* Seta / Ação de Drill-down */}
                    <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-black group-hover:bg-[#00FF66] group-hover:border-[#00FF66] transition-all flex-shrink-0">
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
            <h2 className="font-display text-[18px] font-bold text-white">
              Dados pessoais
            </h2>
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
            <h2 className="font-display text-[18px] font-bold text-white">
              Documentos do Condutor
            </h2>
            <UploadArea label="CNH — Frente" file={cnhFront} existingUrl={existingKyc?.cnh_frente_url} onFile={setCnhFront} />
            <UploadArea label="CNH — Verso" file={cnhBack} existingUrl={existingKyc?.cnh_verso_url} onFile={setCnhBack} />
            <UploadArea label="Selfie segurando a CNH" file={selfie} existingUrl={existingKyc?.selfie_url} onFile={setSelfie} />
          </div>
        )}

        {activeTab === "Dados Veículo" && (
          <div className="space-y-4">
            <h2 className="font-display text-[18px] font-bold text-white">
              Dados do Veículo
            </h2>
            <FormFieldLight
              label="Placa da moto"
              icon={Hash}
              value={plate}
              onChange={(e) => setPlate(maskPlate(e.target.value))}
              placeholder="ABC-1234"
              className="uppercase"
            />
            <FormFieldLight
              label="Modelo, Cor e Ano da Moto"
              icon={Bike}
              value={brandModel}
              onChange={(e) => setBrandModel(e.target.value)}
              placeholder="Honda CG 160 Vermelha (2023)"
            />
          </div>
        )}

        {activeTab === "Docs Veículo" && (
          <div className="space-y-3">
            <h2 className="font-display text-[18px] font-bold text-white">
              Documentos do Veículo
            </h2>
            <UploadArea label="CRLV (Certificado do Veículo)" file={crlvFile} existingUrl={existingKyc?.crlv_url} onFile={setCrlvFile} />
            <UploadArea label="Foto da Moto (com a Placa visível)" file={motoFile} existingUrl={existingKyc?.moto_photo_url} onFile={setMotoFile} />
          </div>
        )}

        {activeTab === "Modo" && (
          <div className="space-y-3">
            <h2 className="font-display text-[18px] font-bold text-white">
              Como você quer trabalhar?
            </h2>
            <div className="flex flex-col gap-3">
              {([
                { key: "carona_entrega" as const, title: "Carona & Entrega", desc: "Transporte de pessoas e pacotes", icon: Bike },
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
                        <p className="font-sans text-[16px] font-semibold text-white">
                          {title}
                        </p>
                        <p className="font-sans text-[13px] mt-0.5" style={{ color: "#A1A1AA" }}>
                          {desc}
                        </p>
                      </div>
                    </div>
                    {sel && (
                      <CheckCircle2
                        size={18}
                        color="#0DB87E"
                        style={{ position: "absolute", top: 12, right: 12 }}
                      />
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
              <PrimaryButtonLight
                onClick={() => setActiveTab("Docs Condutor")}
                disabled={!canStepPessoal}
              >
                Avançar para Documentos
              </PrimaryButtonLight>
            ) : activeTab === "Docs Condutor" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Pessoal")}
                  className="flex-1 font-sans font-bold text-[14px]"
                  style={{
                    border: "1px solid var(--prestador-border)",
                    borderRadius: 12,
                    color: "#A1A1AA",
                    background: "var(--prestador-card)",
                    padding: "14px 0",
                  }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight
                    onClick={() => setActiveTab("Dados Veículo")}
                    disabled={!canStepDocsCondutor}
                  >
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
                  style={{
                    border: "1px solid var(--prestador-border)",
                    borderRadius: 12,
                    color: "#A1A1AA",
                    background: "var(--prestador-card)",
                    padding: "14px 0",
                  }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight
                    onClick={() => setActiveTab("Docs Veículo")}
                    disabled={!canStepDadosVeiculo}
                  >
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
                  style={{
                    border: "1px solid var(--prestador-border)",
                    borderRadius: 12,
                    color: "#A1A1AA",
                    background: "var(--prestador-card)",
                    padding: "14px 0",
                  }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight
                    onClick={() => setActiveTab("Modo")}
                    disabled={!canStepDocsVeiculo}
                  >
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
                  style={{
                    border: "1px solid var(--prestador-border)",
                    borderRadius: 12,
                    color: "#A1A1AA",
                    background: "var(--prestador-card)",
                    padding: "14px 0",
                  }}
                >
                  Voltar
                </button>
                <div className="flex-[2]">
                  <PrimaryButtonLight
                    onClick={submit}
                    loading={loading}
                    disabled={!canStepPessoal || !canStepDadosVeiculo || !canStepModo}
                  >
                    Salvar Configurações
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

export default PrestadorMototaxiOnboarding;
