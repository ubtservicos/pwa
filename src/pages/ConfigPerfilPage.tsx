import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  Mail,
  Lock,
  Camera,
  ChevronDown,
  Eye,
  EyeOff,
  Check,
  Heart,
  Copy,
  MessageSquare,
  Instagram,
  Facebook,
  QrCode,
  X,
  MapPin,
  Waves,
  Briefcase,
  Edit3
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import { useSimpleToast } from "@/hooks/useToast2";
import Toast from "@/components/auth/Toast";
import { maskPhone } from "@/utils/masks";
import { supabase } from "@/lib/supabase";
import { BAIRROS_LIST, PRAIAS_LIST } from "@/constants/ubatubaLocations";

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

const SelectField = ({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder = "Selecione...",
}: {
  label: string;
  icon: any;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
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
          padding: "0 14px",
          height: 48,
          position: "relative",
        }}
      >
        <Icon size={18} color={t.muted} style={{ flexShrink: 0 }} />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: value ? t.text : t.muted,
            fontFamily: "DM Sans",
            fontSize: 14,
            cursor: "pointer",
            appearance: "none",
          }}
        >
          <option value="" style={{ background: t.bg, color: t.text }}>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt} style={{ background: t.bg, color: t.text }}>
              {opt}
            </option>
          ))}
        </select>
        <ChevronDown size={18} color={t.muted} style={{ pointerEvents: "none" }} />
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
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [colaboradorSlug, setColaboradorSlug] = useState<string>("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPraiasModal, setShowPraiasModal] = useState(false);
  const [searchPraia, setSearchPraia] = useState("");

  const initial = {
    nome: user.name,
    telefone: "",
    email: user.email || "",
    bairro_moradia: "",
    bairro_trabalho: "",
    praias_frequenta: "",
  };
  const [form, setForm] = useState(initial);
  const [initialLoaded, setInitialLoaded] = useState(initial);

  useEffect(() => {
    if (!user.uid) return;

    const loadProfileDetails = async () => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, phone, bairro_moradia, bairro_trabalho, praias_frequenta")
          .eq("id", user.uid)
          .maybeSingle();

        const { data: usuarioData } = await supabase
          .from("usuarios")
          .select("nome, bairro_moradia, bairro_trabalho, praias_frequenta, referral_code")
          .eq("id", user.uid)
          .maybeSingle();

        const resolvedSlug = usuarioData?.referral_code || user.uid.slice(0, 8);
        setColaboradorSlug(resolvedSlug);

        const { data: { user: authUser } } = await supabase.auth.getUser();

        const phoneVal = profileData?.phone || authUser?.user_metadata?.telefone || "";
        const nameVal = usuarioData?.nome || profileData?.name || authUser?.user_metadata?.full_name || user.name || "";
        const emailVal = authUser?.email || user.email || "";

        const bairroMoradiaVal = profileData?.bairro_moradia || usuarioData?.bairro_moradia || "";
        const bairroTrabalhoVal = profileData?.bairro_trabalho || usuarioData?.bairro_trabalho || "";
        const praiasVal = profileData?.praias_frequenta || usuarioData?.praias_frequenta || "";

        const loaded = {
          nome: nameVal,
          telefone: maskPhone(phoneVal),
          email: emailVal,
          bairro_moradia: bairroMoradiaVal,
          bairro_trabalho: bairroTrabalhoVal,
          praias_frequenta: praiasVal,
        };

        setForm(loaded);
        setInitialLoaded(loaded);
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

  const sanitizeSlugInput = (raw: string) =>
    raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 30);

  const handleCopySlug = () => {
    const slugToCopy = colaboradorSlug || user.uid;
    if (!slugToCopy) return;
    navigator.clipboard.writeText(slugToCopy);
    setCopiedSlug(true);
    showToast("ID / Slug UBT copiado! ✓");
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleStartEditSlug = () => {
    setSlugDraft(colaboradorSlug || "");
    setSlugError(null);
    setEditingSlug(true);
  };

  const handleSaveSlug = async () => {
    const cleaned = sanitizeSlugInput(slugDraft).replace(/^-+|-+$/g, "");
    setSlugDraft(cleaned);
    setSlugError(null);

    if (cleaned.length < 3 || cleaned.length > 30) {
      setSlugError("O ID / Slug deve ter entre 3 e 30 caracteres.");
      return;
    }

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleaned)) {
      setSlugError("Use apenas letras minúsculas, números e hífen (sem hífen no início ou fim).");
      return;
    }

    if (cleaned === colaboradorSlug) {
      setEditingSlug(false);
      return;
    }

    setSavingSlug(true);
    try {
      const { data, error } = await supabase.rpc("atualizar_meu_slug_ubt", {
        p_novo_slug: cleaned,
      });

      if (error) {
        setSlugError(error.message || "Não foi possível atualizar o ID / Slug.");
        return;
      }

      const savedSlug = (data as any)?.slug || cleaned;
      setColaboradorSlug(savedSlug);
      setEditingSlug(false);
      showToast("ID / Slug atualizado com sucesso! ✓");
    } catch (err: any) {
      setSlugError(err?.message || "Erro ao salvar o novo ID / Slug.");
    } finally {
      setSavingSlug(false);
    }
  };

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

  const dirty = JSON.stringify(form) !== JSON.stringify(initialLoaded);

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
          telefone: form.telefone.replace(/\D/g, ""),
        }
      };

      if (form.email !== user.email) {
        updateData.email = form.email;
      }

      const { error: authErr } = await supabase.auth.updateUser(updateData);
      if (authErr) throw authErr;

      // 1. Update tabela profiles
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          name: form.nome,
          phone: form.telefone.replace(/\D/g, ""),
          bairro_moradia: form.bairro_moradia || null,
          bairro_trabalho: form.bairro_trabalho || null,
          praias_frequenta: form.praias_frequenta || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.uid);
      if (profErr) throw profErr;

      // 2. Update tabela usuarios
      const { error: usrErr } = await supabase
        .from("usuarios")
        .update({
          nome: form.nome,
          bairro_moradia: form.bairro_moradia || null,
          bairro_trabalho: form.bairro_trabalho || null,
          praias_frequenta: form.praias_frequenta || null,
        })
        .eq("id", user.uid);
      if (usrErr) console.warn("Aviso ao atualizar tabela usuarios:", usrErr);

      setInitialLoaded({ ...form });
      showToast("Perfil atualizado com sucesso! ✓");
    } catch (err: any) {
      console.error("Erro ao salvar perfil:", err);
      showToast(err.message || "Erro ao salvar alterações");
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

  const selectedPraiasList = form.praias_frequenta
    ? form.praias_frequenta.split(",").map((p) => p.trim()).filter(Boolean)
    : [];

  const filteredPraias = PRAIAS_LIST.filter((p) =>
    p.toLowerCase().includes(searchPraia.toLowerCase())
  );

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

        {/* Dados Pessoais */}
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

          {/* Localização & Preferências */}
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 16 }}>
            <SelectField
              label="Bairro de Moradia"
              icon={MapPin}
              value={form.bairro_moradia}
              onChange={(v) => setForm({ ...form, bairro_moradia: v })}
              options={BAIRROS_LIST}
              placeholder="Selecione seu bairro de residência..."
            />

            <SelectField
              label="Bairro de Trabalho"
              icon={Briefcase}
              value={form.bairro_trabalho}
              onChange={(v) => setForm({ ...form, bairro_trabalho: v })}
              options={BAIRROS_LIST}
              placeholder="Selecione seu bairro de trabalho..."
            />

            {/* Praias que Frequenta */}
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
                Praias que Frequenta
              </label>
              <button
                type="button"
                onClick={() => setShowPraiasModal(true)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  background: t.inputBg,
                  border: `1px solid ${t.inputBdr}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflow: "hidden" }}>
                  <Waves size={18} color={t.muted} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 14,
                      color: selectedPraiasList.length > 0 ? t.text : t.muted,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {selectedPraiasList.length > 0
                      ? selectedPraiasList.join(", ")
                      : "Selecione as praias que frequenta..."}
                  </span>
                </div>
                <ChevronDown size={18} color={t.muted} />
              </button>
            </div>
          </div>
        </div>

        {/* Card Seu ID / Slug na Plataforma UBT (Genérico e Editável) */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(11,15,20,0.65) 100%)",
            border: "1px solid rgba(16,185,129,0.35)",
            borderRadius: 16,
            padding: 18,
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 0 20px rgba(16,185,129,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontFamily: "DM Sans",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#10B981",
                  display: "block",
                }}
              >
                Seu ID / Slug na Plataforma UBT
              </span>
              {!editingSlug && (
                <p
                  style={{
                    fontFamily: "monospace",
                    fontSize: 18,
                    fontWeight: 700,
                    color: t.text,
                    margin: "4px 0 0",
                    letterSpacing: "0.04em",
                    wordBreak: "break-all",
                  }}
                >
                  {colaboradorSlug || "Carregando..."}
                </p>
              )}
            </div>

            {!editingSlug && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleStartEditSlug}
                  disabled={!colaboradorSlug}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "9px 12px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(16,185,129,0.35)",
                    color: t.text,
                    fontFamily: "Syne",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Edit3 size={14} color="#10B981" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={handleCopySlug}
                  disabled={!colaboradorSlug}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 14px",
                    borderRadius: 12,
                    background: copiedSlug ? "#059669" : "#10B981",
                    border: "none",
                    color: "#0B0F14",
                    fontFamily: "Syne",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {copiedSlug ? <Check size={15} /> : <Copy size={15} />}
                  {copiedSlug ? "Copiado!" : "Copiar"}
                </button>
              </div>
            )}
          </div>

          {editingSlug && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text"
                value={slugDraft}
                onChange={(e) => {
                  setSlugDraft(sanitizeSlugInput(e.target.value));
                  setSlugError(null);
                }}
                placeholder="ex: seu-nome-ubt"
                maxLength={30}
                style={{
                  width: "100%",
                  background: t.inputBg,
                  border: `1px solid ${slugError ? "#E84040" : "rgba(16,185,129,0.45)"}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  color: t.text,
                  fontFamily: "monospace",
                  fontSize: 15,
                  outline: "none",
                }}
              />
              <span style={{ fontFamily: "DM Sans", fontSize: 11, color: t.muted }}>
                Use de 3 a 30 caracteres: letras minúsculas, números e hífen.
              </span>
              {slugError && (
                <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#E84040", margin: 0, fontWeight: 600 }}>
                  {slugError}
                </p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSaveSlug}
                  disabled={savingSlug}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#10B981",
                    border: "none",
                    color: "#0B0F14",
                    fontFamily: "Syne",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: savingSlug ? "wait" : "pointer",
                  }}
                >
                  {savingSlug ? "Salvando..." : "Salvar ID / Slug"}
                </button>
                <button
                  type="button"
                  disabled={savingSlug}
                  onClick={() => {
                    setEditingSlug(false);
                    setSlugError(null);
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "transparent",
                    border: `1px solid ${t.border}`,
                    color: t.subtle,
                    fontFamily: "DM Sans",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <p
            style={{
              fontFamily: "DM Sans",
              fontSize: 12,
              color: t.subtle,
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            Este identificador único pertence à sua conta na plataforma UBT. Use-o para <strong>apadrinhar pessoas</strong>, <strong>compartilhar convites</strong> e <strong>vincular sua conta</strong> na plataforma.
          </p>
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

        {/* Trocar Senha */}
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

      {/* Modal de Seleção de Praias */}
      {showPraiasModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            padding: 20,
          }}
        >
          <div
            style={{
              background: t.surface,
              borderRadius: 24,
              width: "100%",
              maxWidth: 420,
              maxHeight: "85vh",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              border: `1px solid ${t.border}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 17, fontWeight: 700, color: t.text, margin: 0 }}>
                Praias que Costuma Frequentar
              </h3>
              <button
                onClick={() => setShowPraiasModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
              >
                <X size={20} color={t.text} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Buscar praia..."
              value={searchPraia}
              onChange={(e) => setSearchPraia(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
                background: t.inputBg,
                border: `1px solid ${t.inputBdr}`,
                color: t.text,
                fontFamily: "DM Sans",
                fontSize: 14,
                outline: "none",
                marginBottom: 12,
              }}
            />

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "45vh",
                paddingRight: 4,
              }}
            >
              {filteredPraias.map((p) => {
                const isSelected = selectedPraiasList.includes(p);
                return (
                  <div
                    key={p}
                    onClick={() => {
                      const next = isSelected
                        ? selectedPraiasList.filter((x) => x !== p)
                        : [...selectedPraiasList, p];
                      setForm({ ...form, praias_frequenta: next.join(", ") });
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: isSelected ? "rgba(13,184,126,0.12)" : t.inputBg,
                      border: `1px solid ${isSelected ? "#0DB87E" : t.inputBdr}`,
                      cursor: "pointer",
                      transition: "all 150ms",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ accentColor: "#0DB87E", width: 16, height: 16, cursor: "pointer" }}
                    />
                    <span
                      style={{
                        fontFamily: "DM Sans",
                        fontSize: 14,
                        color: isSelected ? "#0DB87E" : t.text,
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {p}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowPraiasModal(false)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                background: "#0DB87E",
                color: "#FFF",
                border: "none",
                fontFamily: "DM Sans",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 16,
              }}
            >
              Confirmar Seleção ({selectedPraiasList.length})
            </button>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
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
                margin: "0 0 8px 0",
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
                margin: "0 0 20px 0",
                lineHeight: "1.4"
              }}
            >
              Aponte a câmera do celular para este código para se cadastrar como seu afilhado.
            </p>

            <div
              style={{
                padding: 16,
                background: "#FFFFFF",
                borderRadius: 16,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/cadastro?ref=${user.uid}`)}`}
                alt="QR Code"
                style={{ width: 180, height: 180, display: "block" }}
              />
            </div>

            <button
              onClick={() => {
                handleShareLink();
                setShowQrModal(false);
              }}
              style={{
                marginTop: 24,
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                background: "#0DB87E",
                color: "#FFFFFF",
                border: "none",
                fontFamily: "Syne",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Copiar Link Direto
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPerfilPage;
