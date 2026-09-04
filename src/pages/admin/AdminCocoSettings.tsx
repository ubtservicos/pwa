import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Mail, 
  Phone, 
  Building2, 
  QrCode, 
  Save, 
  Check, 
  AlertCircle, 
  KeyRound, 
  ShieldCheck, 
  Recycle, 
  ArrowLeft,
  DollarSign
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNavigate } from "react-router-dom";

export default function AdminCocoSettings() {
  const toast = useAdminToast();
  const user = useCurrentUser();
  const navigate = useNavigate();

  // Auth Credentials States
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Operational States
  const [nomeEntidade, setNomeEntidade] = useState("Côco & Cia Logística Reversa");
  const [telefone, setTelefone] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [missao, setMissao] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loadingOps, setLoadingOps] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Fetch initial profile & entity settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 1. Get Auth session user email
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.email) {
          setCurrentEmail(authData.user.email);
          setNewEmail(authData.user.email);
        }

        // 2. Get Profile data
        if (user.uid) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, phone")
            .eq("id", user.uid)
            .maybeSingle();

          if (profile) {
            if (profile.name) setNomeEntidade(profile.name);
            if (profile.phone) setTelefone(profile.phone);
          }
        }

        // 3. Get Entity Operational Config from coco_config
        const { data: config } = await supabase
          .from("coco_config")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (config) {
          if (config.pix_key) setPixKey(config.pix_key);
          if (config.missao) setMissao(config.missao);
          if (config.descricao) setDescricao(config.descricao);
        } else {
          // Fallback to localStorage pix
          const localPix = localStorage.getItem("coco_pix_fallback");
          if (localPix) setPixKey(localPix);
        }
      } catch (err) {
        console.warn("Erro ao carregar configuracoes:", err);
      } finally {
        setLoadingInitial(false);
      }
    };

    loadSettings();
  }, [user.uid]);

  // Update Auth Credentials (Password / Email)
  const handleUpdateAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAuth(true);

    try {
      const updates: { email?: string; password?: string } = {};

      if (newEmail && newEmail !== currentEmail) {
        updates.email = newEmail.trim();
      }

      if (newPassword) {
        if (newPassword.length < 6) {
          toast.show("A senha deve conter no mínimo 6 caracteres.");
          setLoadingAuth(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          toast.show("As senhas não conferem.");
          setLoadingAuth(false);
          return;
        }
        updates.password = newPassword;
      }

      if (Object.keys(updates).length === 0) {
        toast.show("Nenhuma alteração de autenticação informada.");
        setLoadingAuth(false);
        return;
      }

      const { data, error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      if (updates.email) {
        toast.show("Confirmação enviada para o novo e-mail!");
        setCurrentEmail(updates.email);
      }
      if (updates.password) {
        toast.show("Senha atualizada com sucesso!");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.show(`Erro ao atualizar credenciais: ${err.message}`);
    } finally {
      setLoadingAuth(false);
    }
  };

  // Update Operational Settings (Phone, PIX, Entity Name, Mission)
  const handleUpdateOps = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingOps(true);

    try {
      // 1. Update Profile
      if (user.uid) {
        await supabase
          .from("profiles")
          .update({
            full_name: nomeEntidade.trim(),
            phone: telefone.trim(),
          })
          .eq("id", user.uid);

        await supabase
          .from("usuarios")
          .update({
            nome: nomeEntidade.trim(),
            telefone: telefone.trim(),
          })
          .eq("id", user.uid);
      }

      // 2. Update or Insert into coco_config
      const { data: existingConfig } = await supabase
        .from("coco_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existingConfig?.id) {
        const { error } = await supabase
          .from("coco_config")
          .update({
            pix_key: pixKey.trim(),
            missao: missao.trim(),
            descricao: descricao.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coco_config").insert({
          pix_key: pixKey.trim(),
          missao: missao.trim(),
          descricao: descricao.trim(),
        });
        if (error) throw error;
      }

      // 3. Update localStorage fallback
      localStorage.setItem("coco_pix_fallback", pixKey.trim());

      toast.show("Dados operacionais atualizados com sucesso!");
    } catch (err: any) {
      toast.show(`Erro ao salvar dados operacionais: ${err.message}`);
    } finally {
      setLoadingOps(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 980, margin: "0 auto" }}>
      {/* Header & Sub-Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/admin/coco")}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "var(--admin-card-bg)",
              border: "1px solid var(--admin-border)",
              color: "var(--admin-text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
            title="Voltar ao Painel"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
              Configurações da Entidade & Gestão
            </h1>
            <p style={{ margin: "2px 0 0", fontFamily: "DM Sans", fontSize: 13, color: "var(--admin-subtle)" }}>
              Edite suas credenciais de acesso (e-mail, senha) e os dados operacionais da Côco & Cia.
            </p>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/admin/coco")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              background: "transparent",
              color: "var(--admin-subtle)",
              fontFamily: "DM Sans",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🗺️ Visão Geral
          </button>
          <button
            onClick={() => navigate("/admin/coco/frota")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--admin-border)",
              background: "transparent",
              color: "var(--admin-subtle)",
              fontFamily: "DM Sans",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            🚚 Gestão de Frota
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        
        {/* CARD 1: SEGURANÇA & CREDENCIAIS DE ACESSO */}
        <Card style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.12)", color: "#0DB87E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                Credenciais de Autenticação
              </h2>
              <span style={{ fontSize: 11, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
                Alteração de e-mail e senha de gestor
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdateAuth} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>E-mail de Login</label>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="gestor@cocoecia.com.br"
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
                <Mail size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 13 }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--admin-subtle)", marginTop: 4, display: "block" }}>
                E-mail atual: <strong>{currentEmail || "Carregando..."}</strong>
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
              <label style={labelStyle}>Nova Senha de Acesso</label>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
                <Lock size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 13 }} />
              </div>

              <label style={labelStyle}>Confirmar Nova Senha</label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
                <Lock size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 13 }} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingAuth}
              style={{
                marginTop: 8,
                background: "#0DB87E",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "12px 18px",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 14,
                cursor: loadingAuth ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loadingAuth ? 0.7 : 1
              }}
            >
              <Save size={16} />
              <span>{loadingAuth ? "Salvando..." : "Atualizar Credenciais"}</span>
            </button>
          </form>
        </Card>

        {/* CARD 2: DADOS OPERACIONAIS & CHAVE PIX */}
        <Card style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.12)", color: "#0DB87E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)", margin: 0 }}>
                Dados Operacionais & Chave PIX
              </h2>
              <span style={{ fontSize: 11, color: "var(--admin-subtle)", fontFamily: "DM Sans" }}>
                Informações de contato e arrecadação oficial
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdateOps} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Nome da Associação / Razão Social</label>
              <input
                type="text"
                value={nomeEntidade}
                onChange={(e) => setNomeEntidade(e.target.value)}
                placeholder="Ex: Associação Côco & Cia de Ubatuba"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Telefone / WhatsApp Operacional</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(12) 99999-9999"
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
                <Phone size={16} color="var(--admin-muted)" style={{ position: "absolute", left: 12, top: 13 }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Chave PIX Oficial de Contingência</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CNPJ, E-mail, Telefone ou Chave Aleatória"
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
                <DollarSign size={16} color="#0DB87E" style={{ position: "absolute", left: 12, top: 13 }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--admin-subtle)", marginTop: 4, display: "block" }}>
                Recebe doações de Tomadores quando nenhum caminhão específico está online.
              </span>
            </div>

            <div>
              <label style={labelStyle}>Missão / Descrição da Entidade</label>
              <textarea
                rows={3}
                value={missao}
                onChange={(e) => setMissao(e.target.value)}
                placeholder="Ex: Coleta seletiva solidária e conscientização ambiental em Ubatuba."
                style={{
                  ...inputStyle,
                  height: "auto",
                  padding: 10,
                  fontSize: 13,
                  resize: "vertical"
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loadingOps}
              style={{
                marginTop: 8,
                background: "#0DB87E",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "12px 18px",
                fontFamily: "Syne",
                fontWeight: 700,
                fontSize: 14,
                cursor: loadingOps ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loadingOps ? 0.7 : 1
              }}
            >
              <Save size={16} />
              <span>{loadingOps ? "Salvando..." : "Salvar Dados Operacionais"}</span>
            </button>
          </form>
        </Card>

      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 10,
  height: 42,
  padding: "0 14px",
  fontFamily: "DM Sans",
  fontSize: 14,
  color: "var(--admin-text)",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontFamily: "DM Sans",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--admin-subtle)",
  marginBottom: 6,
};
