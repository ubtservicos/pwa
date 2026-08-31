import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "operator",
  "moderador",
  "financeiro",
  "operations_manager",
  "marketing"
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
      setErrMessage("Informe o e-mail e a senha de acesso.");
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: senha,
      });

      if (error || !authData.user) {
        setErrMessage(error?.message || "E-mail ou senha incorretos.");
        return;
      }

      // Buscar a role do usuário na tabela profiles (com fallback para usuarios)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      let userRole = profile?.role;

      if (!userRole) {
        const { data: dbUser } = await supabase
          .from("usuarios")
          .select("role")
          .eq("id", authData.user.id)
          .maybeSingle();
        userRole = dbUser?.role;
      }

      // Redirecionamento baseado na role
      if (userRole && COCO_ROLES.includes(userRole)) {
        navigate("/admin/coco");
      } else if (userRole && (ADMIN_ROLES.includes(userRole) || userRole === "superadmin")) {
        navigate("/admin");
      } else {
        // Usuário não possui permissão administrativa
        await supabase.auth.signOut();
        setErrMessage("Acesso não autorizado: Esta conta não possui privilégios administrativos.");
      }
    } catch (error: any) {
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
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", padding: 2 }}
              aria-label="Mostrar senha"
            >
              {show ? <EyeOff size={16} className="text-zinc-500" /> : <Eye size={16} className="text-zinc-500" />}
            </button>
          </div>
        </div>

        {errMessage && (
          <div
            style={{
              marginTop: 16,
              background: "rgba(232,64,64,0.10)",
              border: "1px solid #E84040",
              borderRadius: 10,
              padding: "10px 14px",
              fontFamily: "DM Sans",
              fontSize: 12,
              color: "#E84040",
              lineHeight: 1.4,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <ShieldAlert size={18} className="shrink-0 text-[#E84040]" />
            <span>{errMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 24,
            width: "100%",
            minHeight: 48,
            background: "#0DB87E",
            color: "#0B1B3E",
            fontFamily: "Syne",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 999,
            border: "none",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "all 0.2s"
          }}
        >
          {loading ? "Autenticando..." : "Acessar Painel"}
        </button>
      </form>
    </div>
  );
}
