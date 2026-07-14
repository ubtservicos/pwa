import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Phone, Mail, Lock, Camera, ChevronDown, Eye, EyeOff, Share2, Check, Heart, Copy, MessageSquare, Instagram, Facebook, QrCode, X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import { useSimpleToast } from "@/hooks/useToast2";
import Toast from "@/components/auth/Toast";
import { maskPhone } from "@/utils/masks";
import { supabase } from "@/lib/supabase";


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
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const initial = {
    nome: user.name,
    telefone: "",
    email: user.email || "",
  };
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (!user.uid) return;
    
    const loadProfileDetails = async () => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, phone")
          .eq("id", user.uid)
          .maybeSingle();

        const { data: usuarioData } = await supabase
          .from("usuarios")
          .select("nome")
          .eq("id", user.uid)
          .maybeSingle();

        const { data: { user: authUser } } = await supabase.auth.getUser();

        const phoneVal = profileData?.phone || authUser?.user_metadata?.telefone || "";
        const nameVal = usuarioData?.nome || profileData?.name || authUser?.user_metadata?.full_name || user.name || "";
        const emailVal = authUser?.email || user.email || "";

        setForm({
          nome: nameVal,
          telefone: maskPhone(phoneVal),
          email: emailVal
        });
      } catch (e) {
        console.error("Error loading profile fields:", e);
      }
    };

    loadProfileDetails();
  }, [user.uid, user.name, user.email]);

  const [senhaOpen, setSenhaOpen] = useState(false);
  const [pwd, setPwd] = useState({ atual: "", nova: "", conf: "" });
  const [showPwd, setShowPwd] = useState({ atual: false, nova: false, conf: false });
  const [savingPwd, setSavingPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toast, showToast } = useSimpleToast();

  const handleShareLink = () => {
    const referralLink = `${window.location.origin}/cadastro?ref=${user.uid}`;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    showToast("Link de Padrinho copiado! ✓");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const referralLink = `${window.location.origin}/cadastro?ref=${user.uid}`;
    const text = encodeURIComponent(`Olá! Cadastre-se na UBT Serviços utilizando meu link de convite e tenha acesso aos melhores profissionais de Ubatuba: ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShareInstagram = () => {
    const referralLink = `${window.location.origin}/cadastro?ref=${user.uid}`;
    navigator.clipboard.writeText(referralLink);
    showToast("Link copiado! Cole no seu Stories ou Bio do Instagram. ✓");
    setTimeout(() => {
      window.open("https://instagram.com", "_blank");
    }, 1500);
  };

  const handleShareFacebook = () => {
    const referralLink = `${window.location.origin}/cadastro?ref=${user.uid}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, "_blank");
  };

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

  const handleSave = async () => {
    if (!user.uid) return;
    setSaving(true);
    try {
      const updateData: any = {
        data: {
          full_name: form.nome,
          telefone: form.telefone.replace(/\D/g, "")
        }
      };

      if (form.email !== user.email) {
        updateData.email = form.email;
      }

      const { error: authErr } = await supabase.auth.updateUser(updateData);
      if (authErr) throw authErr;

      const { error: usrErr } = await supabase
        .from("usuarios")
        .update({ nome: form.nome })
        .eq("id", user.uid);
      if (usrErr) throw usrErr;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          name: form.nome,
          phone: form.telefone.replace(/\D/g, "")
        })
        .eq("id", user.uid);
      if (profErr) throw profErr;

      showToast("Perfil atualizado! ✓");
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePwd = async () => {
    if (pwd.nova !== pwd.conf) {
      showToast("As senhas não coincidem!");
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pwd.nova
      });
      if (error) throw error;
      setSenhaOpen(false);
      setPwd({ atual: "", nova: "", conf: "" });
      showToast("Senha alterada com sucesso! ✓");
    } catch (err: any) {
      console.error(err);
      showToast("Erro ao alterar senha");
    } finally {
      setSavingPwd(false);
    }
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

        {/* Card Padrinho/Madrinha (Indicação) */}
        <div
          style={{
            background: "rgba(13,184,126,0.06)",
            border: "1px solid rgba(13,184,126,0.18)",
            borderRadius: 16,
            padding: 20,
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                background: "rgba(13,184,126,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Heart size={20} color="#0DB87E" fill="#0DB87E" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: t.text, margin: 0, textAlign: "left" }}>
                Seja um Padrinho/Madrinha
              </p>
              <p style={{ fontFamily: "DM Sans", fontSize: 12, color: t.muted, margin: 0, textAlign: "left" }}>
                Ganhe 1% sobre todos os serviços de quem indicar
              </p>
            </div>
          </div>

          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: t.text, opacity: 0.7, margin: "4px 0 8px 0", lineHeight: "1.4", textAlign: "left" }}>
            Compartilhe seu link de indicação exclusivo. Cada novo usuário que se cadastrar através dele será vinculado a você como afilhado direto.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 8 }}>
            {/* Copiar Link */}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleShareLink();
              }}
              style={{
                textDecoration: "none",
                padding: "12px",
                borderRadius: 12,
                background: "rgba(13,184,126,0.1)",
                border: "1px solid rgba(13,184,126,0.25)",
                color: t.text,
                fontFamily: "Syne",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {copiedLink ? <Check size={16} color="#0DB87E" /> : <Copy size={16} color="#0DB87E" />}
              {copiedLink ? "Copiado!" : "Copiar Link"}
            </a>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Olá! Cadastre-se na UBT Serviços utilizando meu link de convite e tenha acesso aos melhores profissionais de Ubatuba: ${window.location.origin}/cadastro?ref=${user.uid}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
                padding: "12px",
                borderRadius: 12,
                background: "rgba(37,211,102,0.1)",
                border: "1px solid rgba(37,211,102,0.25)",
                color: t.text,
                fontFamily: "Syne",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <MessageSquare size={16} color="#25D366" />
              WhatsApp
            </a>

            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                const referralLink = `${window.location.origin}/cadastro?ref=${user.uid}`;
                navigator.clipboard.writeText(referralLink);
                showToast("Link copiado! Cole no seu Stories ou Bio do Instagram. ✓");
              }}
              style={{
                textDecoration: "none",
                padding: "12px",
                borderRadius: 12,
                background: "rgba(225,48,108,0.1)",
                border: "1px solid rgba(225,48,108,0.25)",
                color: t.text,
                fontFamily: "Syne",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Instagram size={16} color="#E1306C" />
              Instagram
            </a>

            {/* Facebook */}
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/cadastro?ref=${user.uid}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
                padding: "12px",
                borderRadius: 12,
                background: "rgba(24,119,242,0.1)",
                border: "1px solid rgba(24,119,242,0.25)",
                color: t.text,
                fontFamily: "Syne",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Facebook size={16} color="#1877F2" />
              Facebook
            </a>

            {/* QR Code de Indicação */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              style={{
                gridColumn: "span 2",
                padding: "12px",
                borderRadius: 12,
                background: "rgba(13,184,126,0.12)",
                border: "1px solid rgba(13,184,126,0.3)",
                color: t.text,
                fontFamily: "Syne",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 4
              }}
            >
              <QrCode size={16} color="#0DB87E" />
              Mostrar QR Code de Indicação
            </button>
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

      {showQrModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            padding: 24,
          }}
        >
          <div
            style={{
              background: t.surface,
              borderRadius: 24,
              width: "100%",
              maxWidth: 380,
              padding: 28,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              border: `1px solid ${t.border}`,
            }}
          >
            <button
              onClick={() => setShowQrModal(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex"
              }}
            >
              <X size={20} color={t.text} />
            </button>

            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: "rgba(13,184,126,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16
              }}
            >
              <Heart size={24} color="#0DB87E" fill="#0DB87E" />
            </div>

            <h3
              style={{
                fontFamily: "Syne",
                fontSize: 18,
                fontWeight: 700,
                color: t.text,
                margin: 0,
                textAlign: "center"
              }}
            >
              QR Code de Indicação
            </h3>

            <p
              style={{
                fontFamily: "DM Sans",
                fontSize: 13,
                color: t.muted,
                textAlign: "center",
                marginTop: 8,
                marginBottom: 20,
                lineHeight: 1.4
              }}
            >
              Aponte a câmera do seu celular para cadastrar-se e vincular-se automaticamente como afilhado(a) da UBT!
            </p>

            <div
              style={{
                background: "#FFF",
                padding: 12,
                borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20
              }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/cadastro?ref=${user.uid}`)}`}
                alt="Referral QR Code"
                style={{ width: 200, height: 200, display: "block" }}
              />
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                background: "#0DB87E",
                color: "#FFF",
                border: "none",
                fontFamily: "Syne",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPerfilPage;
