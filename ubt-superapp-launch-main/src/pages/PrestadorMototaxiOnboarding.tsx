import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, User as UserIcon, Hash, Upload, CheckCircle2, Bike, Package,
  User, Info, Loader2,
} from "lucide-react";
import FormFieldLight from "@/components/prestador/FormFieldLight";
import PrimaryButtonLight from "@/components/prestador/PrimaryButtonLight";

import { maskCPF } from "@/utils/masks";
import { supabase } from "@/lib/supabase";

const STEPS = ["Dados", "Docs", "Modo", "Revisão"];

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
        <ArrowLeft size={22} color="#0B1B3E" />
      </button>
      <span className="font-display text-[18px] font-bold" style={{ color: "#0B1B3E" }}>
        UBT.
      </span>
      <span style={{ width: 22 }} />
    </div>
  );
};

const UploadArea = ({
  label,
  file,
  onFile,
}: { label: string; file: File | null; onFile: (f: File) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors"
        style={{
          border: `2px dashed ${file ? "#0DB87E" : "#D8DBE5"}`,
          background: file ? "rgba(13,184,126,0.04)" : "#fff",
          padding: "28px 16px",
        }}
      >
        {file && preview ? (
          <div className="flex items-center gap-3">
            <img
              src={preview}
              alt={label}
              className="rounded-lg"
              style={{ width: 60, height: 60, objectFit: "cover" }}
            />
            <CheckCircle2 size={20} color="#0DB87E" />
            <span className="font-sans text-[12px]" style={{ color: "#5B6178" }}>
              {file.name.length > 22 ? file.name.slice(0, 22) + "…" : file.name}
            </span>
          </div>
        ) : (
          <>
            <Upload size={28} color="#9399AD" />
            <span className="font-sans text-[14px]" style={{ color: "#5B6178" }}>
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
  const [activeTab, setActiveTab] = useState("Pessoal");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const tabEl = document.getElementById(`tab-${activeTab}`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);



  // step 1
  const [cpf, setCpf] = useState("");
  const [sex, setSex] = useState<"M" | "F" | null>(null);
  const [plate, setPlate] = useState("");

  // step 2
  const [cnhFront, setCnhFront] = useState<File | null>(null);
  const [cnhBack, setCnhBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  // step 3
  const [modalidade, setModalidade] = useState<Modalidade | null>(null);

  const canStep1 = cpf.length === 14 && sex && plate.length >= 7;
  const canStep2 = true; // Bypassing photo requirement as per user request
  const canStep3 = !!modalidade;

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata) {
        if (user.user_metadata.cpf) {
          setCpf(maskCPF(user.user_metadata.cpf));
        }
        if (user.user_metadata.sexo) {
          setSex(user.user_metadata.sexo);
        }
        if (user.user_metadata.placa_moto) {
          setPlate(maskPlate(user.user_metadata.placa_moto));
        }
        if (user.user_metadata.modalidade_moto) {
          setModalidade(user.user_metadata.modalidade_moto);
        }
      }
    });
  }, []);

  const submit = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const currentStatus = user.user_metadata?.mototaxi_status || "kyc-pending";
      const nextStatus = (currentStatus === "approved" || currentStatus === "kyc-pending") ? currentStatus : "kyc-pending";

      await supabase.auth.updateUser({
        data: {
          cpf: cpf,
          sexo: sex,
          placa_moto: plate,
          modalidade_moto: modalidade,
          mototaxi_status: nextStatus
        }
      });
    }

    setLoading(false);
    
    // Redirect logically based on status
    const finalStatus = user?.user_metadata?.mototaxi_status || "kyc-pending";
    if (finalStatus === "approved" || finalStatus === "kyc-pending") {
      navigate("/app/prestador/home");
    } else {
      navigate("/app/prestador/mototaxi/kyc-pending");
    }
  };

  return (
    <div
      className="min-h-[100svh] overflow-y-auto"
      style={{ background: "#F7F8FA", padding: "24px", paddingBottom: "180px" }}
    >
      <TopBar />

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Pessoal", "Veículo", "Modo"].map(t => (
          <button
            key={t} id={`tab-${t}`} onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#0B1B3E" : "#EFF0F3",
              color: activeTab === t ? "white" : "#5B6178",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>


      <div className="mt-7">
        {activeTab === "Pessoal" && (
          <div className="space-y-4">
            <h2 className="font-display text-[18px] font-bold" style={{ color: "#0B1B3E" }}>
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
              <label className="block font-sans text-[12px] font-semibold mb-1.5" style={{ color: "#5B6178" }}>
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
                        border: `2px solid ${sel ? "#0DB87E" : "#D8DBE5"}`,
                        background: sel ? "#E6FAF4" : "#fff",
                        color: "#0B1B3E",
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
            <FormFieldLight
              label="Placa da moto"
              icon={Hash}
              value={plate}
              onChange={(e) => setPlate(maskPlate(e.target.value))}
              placeholder="ABC-1234"
              className="uppercase"
            />

          </div>
        )}

        {activeTab === "Veículo" && (
          <div className="space-y-3">
            <h2 className="font-display text-[18px] font-bold" style={{ color: "#0B1B3E" }}>
              Documentos
            </h2>
            <UploadArea label="CNH — Frente" file={cnhFront} onFile={setCnhFront} />
            <UploadArea label="CNH — Verso" file={cnhBack} onFile={setCnhBack} />
            <UploadArea label="Selfie segurando a CNH" file={selfie} onFile={setSelfie} />

          </div>
        )}

        {activeTab === "Modo" && (
          <div className="space-y-3">
            <h2 className="font-display text-[18px] font-bold" style={{ color: "#0B1B3E" }}>
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
                      border: `2px solid ${sel ? "#0DB87E" : "#D8DBE5"}`,
                      background: sel ? "#E6FAF4" : "#fff",
                      padding: 20,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={24} color="#0DB87E" />
                      <div className="flex-1">
                        <p className="font-sans text-[16px] font-semibold" style={{ color: "#0B1B3E" }}>
                          {title}
                        </p>
                        <p className="font-sans text-[13px] mt-0.5" style={{ color: "#5B6178" }}>
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

        <div style={{ position: "fixed", bottom: 64, left: 0, right: 0, padding: 24, background: "white", borderTop: "1px solid #E2E8F0", zIndex: 10 }}>
          {activeTab === "Pessoal" ? (
            <PrimaryButtonLight
              onClick={() => setActiveTab("Veículo")}
              disabled={!canStep1}
            >
              Avançar para Veículo
            </PrimaryButtonLight>
          ) : activeTab === "Veículo" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("Pessoal")}
                className="flex-1 font-sans font-bold text-[14px]"
                style={{
                  border: "1px solid #D8DBE5",
                  borderRadius: 12,
                  color: "#5B6178",
                  background: "white",
                  padding: "14px 0",
                }}
              >
                Voltar
              </button>
              <div className="flex-[2]">
                <PrimaryButtonLight
                  onClick={() => setActiveTab("Modo")}
                  disabled={!canStep2}
                >
                  Avançar para Modo
                </PrimaryButtonLight>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("Veículo")}
                className="flex-1 font-sans font-bold text-[14px]"
                style={{
                  border: "1px solid #D8DBE5",
                  borderRadius: 12,
                  color: "#5B6178",
                  background: "white",
                  padding: "14px 0",
                }}
              >
                Voltar
              </button>
              <div className="flex-[2]">
                <PrimaryButtonLight
                  onClick={submit}
                  loading={loading}
                  disabled={!canStep1 || !canStep3}
                >
                  Salvar Configurações
                </PrimaryButtonLight>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const STEPS_LABELS: Record<Modalidade, string> = {
  carona_entrega: "Carona e Entrega",
  so_entrega: "Só Entrega",
  so_carona: "Só Carona",
};

export default PrestadorMototaxiOnboarding;
