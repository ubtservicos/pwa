import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Mail, Lock, Camera, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import { useSimpleToast } from "@/hooks/useToast2";
import Toast from "@/components/auth/Toast";
import { maskPhone } from "@/utils/masks";

const Field = ({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  rightSlot,
}: {
  label: string;
  icon: any;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  rightSlot?: React.ReactNode;
}) => {
  const t = useTheme();
  return (
    <div>
      <label
        style={{
          fontFamily: "DM Sans",
          fontSize: 12,
          fontWeight: 500,
          color: t.subtle,
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: t.inputBg,
          border: `1px solid ${t.inputBdr}`,
          borderRadius: 12,
          padding: "12px 14px",
        }}
      >
        <Icon size={18} color={t.muted} />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: t.text,
            fontFamily: "DM Sans",
            fontSize: 15,
          }}
        />
        {rightSlot}
      </div>
    </div>
  );
};

const passwordStrength = (s: string) => {
  let score = 0;
  if (s.length >= 8) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/\d/.test(s) && /[^a-zA-Z0-9]/.test(s)) score++;
  return score;
};

const ConfigPerfilPage = () => {
  const t = useTheme();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  const initial = {
    nome: user.name,
    telefone: "",
    email: user.email || "",
  };
  const [form, setForm] = useState(initial);

  const [senhaOpen, setSenhaOpen] = useState(false);
  const [pwd, setPwd] = useState({ atual: "", nova: "", conf: "" });
  const [showPwd, setShowPwd] = useState({ atual: false, nova: false, conf: false });
  const [savingPwd, setSavingPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toast, showToast } = useSimpleToast();

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setAvatar(r.result as string);
    r.readAsDataURL(f);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      showToast("Perfil atualizado! ✓");
    }, 1000);
  };

  const handleSavePwd = () => {
    setSavingPwd(true);
    setTimeout(() => {
      setSavingPwd(false);
      setSenhaOpen(false);
      setPwd({ atual: "", nova: "", conf: "" });
      showToast("Senha alterada com sucesso! ✓");
    }, 1000);
  };

  const score = passwordStrength(pwd.nova);
  const strengthLabel = ["", "Fraca", "Razoável", "Forte"][score];
  const strengthColor = ["", "#E84040", "#F5A623", "#0DB87E"][score];

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 80px" }}>
        <PageHeader title="Perfil" onBack={() => navigate("/app/config")} />

        <div style={{ marginTop: 28, textAlign: "center" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 999,
                background: "rgba(13,184,126,0.15)",
                border: "3px solid #0DB87E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {avatar ? (
                <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontFamily: "Syne", fontSize: 28, fontWeight: 700, color: "#0DB87E" }}>
                  {initials}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                borderRadius: 999,
                background: "#0DB87E",
                border: `2px solid ${t.bg}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={14} color="#FFF" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          </div>
          <div
            style={{
              fontFamily: "Syne",
              fontSize: 18,
              fontWeight: 700,
              color: t.text,
              marginTop: 12,
            }}
          >
            {user.name}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              fontFamily: "DM Sans",
              fontSize: 12,
              color: "#0DB87E",
              marginTop: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            Editar foto
          </button>
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Nome completo" icon={User} value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
          <Field
            label="Telefone"
            icon={Phone}
            value={form.telefone}
            onChange={(v) => setForm({ ...form, telefone: maskPhone(v) })}
          />
          <div>
            <Field
              label="E-mail"
              icon={Mail}
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(13,184,126,0.10)",
                border: "1px solid #0DB87E",
                color: "#0DB87E",
                fontFamily: "DM Sans",
                fontSize: 11,
                borderRadius: 999,
                padding: "3px 10px",
                marginTop: 6,
              }}
            >
              Verificado ✓
            </span>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <SettingsGroup>
            <button
              type="button"
              onClick={() => setSenhaOpen(!senhaOpen)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 20px",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(13,184,126,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={20} color="#0DB87E" />
              </div>
              <span
                style={{
                  flex: 1,
                  textAlign: "left",
                  fontFamily: "DM Sans",
                  fontSize: 15,
                  fontWeight: 500,
                  color: t.text,
                }}
              >
                Trocar senha
              </span>
              <ChevronDown
                size={18}
                color={t.muted}
                style={{
                  transform: senhaOpen ? "rotate(180deg)" : "rotate(0)",
                  transition: "transform 250ms",
                }}
              />
            </button>
            <div
              style={{
                maxHeight: senhaOpen ? 500 : 0,
                overflow: "hidden",
                transition: "max-height 300ms ease",
              }}
            >
              <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <Field
                  label="Senha atual"
                  icon={Lock}
                  type={showPwd.atual ? "text" : "password"}
                  value={pwd.atual}
                  onChange={(v) => setPwd({ ...pwd, atual: v })}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPwd({ ...showPwd, atual: !showPwd.atual })}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                    >
                      {showPwd.atual ? <EyeOff size={16} color={t.muted} /> : <Eye size={16} color={t.muted} />}
                    </button>
                  }
                />
                <div>
                  <Field
                    label="Nova senha"
                    icon={Lock}
                    type={showPwd.nova ? "text" : "password"}
                    value={pwd.nova}
                    onChange={(v) => setPwd({ ...pwd, nova: v })}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPwd({ ...showPwd, nova: !showPwd.nova })}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                      >
                        {showPwd.nova ? <EyeOff size={16} color={t.muted} /> : <Eye size={16} color={t.muted} />}
                      </button>
                    }
                  />
                  {pwd.nova && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 999,
                              background: i <= score ? strengthColor : t.border,
                            }}
                          />
                        ))}
                      </div>
                      <div
                        style={{
                          fontFamily: "DM Sans",
                          fontSize: 11,
                          color: strengthColor,
                          marginTop: 4,
                        }}
                      >
                        {strengthLabel}
                      </div>
                    </div>
                  )}
                </div>
                <Field
                  label="Confirmar nova senha"
                  icon={Lock}
                  type={showPwd.conf ? "text" : "password"}
                  value={pwd.conf}
                  onChange={(v) => setPwd({ ...pwd, conf: v })}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPwd({ ...showPwd, conf: !showPwd.conf })}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                    >
                      {showPwd.conf ? <EyeOff size={16} color={t.muted} /> : <Eye size={16} color={t.muted} />}
                    </button>
                  }
                />
                <button
                  type="button"
                  onClick={handleSavePwd}
                  disabled={savingPwd}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 12,
                    background: "#0DB87E",
                    color: "#FFF",
                    border: "none",
                    fontFamily: "DM Sans",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: savingPwd ? "wait" : "pointer",
                    opacity: savingPwd ? 0.7 : 1,
                  }}
                >
                  {savingPwd ? "Salvando..." : "Salvar nova senha"}
                </button>
              </div>
            </div>
          </SettingsGroup>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            background: "#0DB87E",
            color: "#FFF",
            border: "none",
            fontFamily: "DM Sans",
            fontSize: 15,
            fontWeight: 600,
            cursor: !dirty || saving ? "not-allowed" : "pointer",
            opacity: !dirty || saving ? 0.5 : 1,
            marginTop: 24,
          }}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
      <Toast message={toast.msg} visible={toast.visible} />
    </div>
  );
};

export default ConfigPerfilPage;
