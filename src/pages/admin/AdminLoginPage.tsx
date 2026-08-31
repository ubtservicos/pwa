import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "superadmin",
  "operator",
  "moderador",
  "financeiro",
  "operations_manager",
  "marketing",
  "kyc",
  "auditoria",
  "analytics"
];

const COCO_ROLES = [
  "cocoecia",
  "cocoecia-dirigentes",
  "cocoecia-colaborador"
];

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !senha) {
      const msg = "Informe o e-mail e a senha de acesso.";
      console.warn("[Auth] Validação:", msg);
      setErrMessage(msg);
      setLoading(false);
      return;
    }

    console.log("[Auth] 1. Iniciando login para:", cleanEmail);

    try {
      // 1. Supabase SignIn
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: senha,
      });

      console.log("[Auth] 2. Resposta Supabase SignIn:", authData, signInError);

      if (signInError || !authData?.user) {
        const errorDetail = signInError?.message || "E-mail ou senha incorretos.";
        console.error("[Auth] Falha no SignIn:", signInError);
        setErrMessage(errorDetail);
        setLoading(false);
        return;
      }

      const userId = authData.user.id;
      let userRole: string | null = null;

      // 2. Fetch Profile from public.profiles
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        console.log("[Auth] 3. Resposta Fetch Profile:", profileData, profileError);

        if (profileData?.role) {
          userRole = profileData.role;
        } else if (profileError) {
          console.warn("[Auth] Erro ao consultar profiles (RLS ou permissão):", profileError);
        }
      } catch (pErr) {
        console.warn("[Auth] Exceção ao ler profiles:", pErr);
      }

      // 3. Fallback: Fetch from public.usuarios
      if (!userRole) {
        try {
          const { data: dbUserData, error: dbUserError } = await supabase
            .from("usuarios")
            .select("role")
            .eq("id", userId)
            .maybeSingle();

          console.log("[Auth] 3.1. Resposta Fetch Usuarios (fallback):", dbUserData, dbUserError);

          if (dbUserData?.role) {
            userRole = dbUserData.role;
          }
        } catch (uErr) {
          console.warn("[Auth] Exceção ao ler usuarios:", uErr);
        }
      }

      // 4. Fallback: Check user_metadata or app_metadata
      if (!userRole) {
        userRole = (authData.user.user_metadata?.role as string) || (authData.user.app_metadata?.role as string) || null;
      }

      console.log("[Auth] 4. Role final identificada:", userRole);

      // 5. Bypass de RLS & Redirecionamento
      if (userRole && COCO_ROLES.includes(userRole)) {
        console.log("[Auth] 5. Redirecionando para rota Coco & Cia: /admin/coco");
        navigate("/admin/coco");
      } else if (userRole && (ADMIN_ROLES.includes(userRole) || userRole === "superadmin")) {
        console.log("[Auth] 5. Redirecionando para painel administrativo: /admin");
        navigate("/admin");
      } else if (!userRole) {
        // Autenticado mas sem role explícita retornada por RLS: redireciona para /admin para validação do layout
        console.warn("[Auth] 5. Autenticado com sucesso, mas role não lida. Redirecionando para /admin...");
        navigate("/admin");
      } else {
        // Usuário é tomador / prestador comum sem papel administrativo
        console.warn("[Auth] 5. Usuário sem privilégios administrativos. Role:", userRole);
        await supabase.auth.signOut();
        const unauthorizedMsg = `Acesso não autorizado: Sua conta possui o perfil "${userRole}", sem acesso administrativo.`;
        setErrMessage(unauthorizedMsg);
        console.error("[Auth] " + unauthorizedMsg);
      }
    } catch (error: any) {
      console.error("[Auth] Exceção geral capturada no submit:", error);
      setErrMessage(error?.message || "Erro inesperado ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 44,
    borderRadius: 10,
    padding: "0 14px 0 40px",
    fontFamily: "DM Sans",
    fontSize: 14,
    outline: "none",
  };

  return (
    <div
      className="bg-[#09090B] text-zinc-100"
      style={{
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <form
        onSubmit={submit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 sm:p-10 w-full max-w-[380px] shadow-2xl shadow-black/80"
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#fff" }}>UBT.</div>
          <div className="text-zinc-400" style={{ fontFamily: "DM Sans", fontSize: 13, marginTop: 4 }}>
            Painel Administrativo & Gestão
          </div>
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <Mail size={16} className="text-zinc-500" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              type="email"
              placeholder="seu.email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              className="bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-[#0DB87E] transition-colors"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>
          <div style={{ position: "relative" }}>
            <Lock size={16} className="text-zinc-500" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              type={show ? "text" : "password"}
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ ...inputStyle, paddingRight: 40 }}
              className="bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-[#0DB87E] transition-colors"
              autoComplete="current-password"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", padding: 2 }}
              aria-label="Mostrar senha"
              disabled={loading}
            >
              {show ? <EyeOff size={16} className="text-zinc-500" /> : <Eye size={16} className="text-zinc-500" />}
            </button>
          </div>
        </div>

        {errMessage && (
          <div
            style={{
              marginTop: 16,
              background: "rgba(232,64,64,0.12)",
              border: "1px solid #E84040",
              borderRadius: 10,
              padding: "12px 14px",
              fontFamily: "DM Sans",
              fontSize: 12,
              color: "#FF6B6B",
              lineHeight: 1.4,
              display: "flex",
              alignItems: "flex-start",
              gap: 10
            }}
          >
            <ShieldAlert size={18} className="shrink-0 text-[#E84040] mt-0.5" />
            <span style={{ wordBreak: "break-word" }}>{errMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 24,
            width: "100%",
            minHeight: 48,
            background: loading ? "rgba(13,184,126,0.5)" : "#0DB87E",
            color: "#0B1B3E",
            fontFamily: "Syne",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 999,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s"
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin text-[#0B1B3E]" />
              <span>Autenticando...</span>
            </>
          ) : (
            <span>Acessar Painel</span>
          )}
        </button>
      </form>
    </div>
  );
}
