import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(false);
    
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error || !authData.user) {
        setErr(true);
      } else {
        // Fetch user role from database
        const { data: dbUser } = await supabase
          .from("usuarios")
          .select("role")
          .eq("id", authData.user.id)
          .maybeSingle();

        const role = email === "ubt.servicos@gmail.com" ? "admin" : (dbUser?.role || "tomador");
        
        if (role === "admin") {
          navigate("/admin");
        } else {
          // If not admin, log out and show error
          await supabase.auth.signOut();
          setErr(true);
        }
      }
    } catch (error) {
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 44,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 10,
    padding: "0 14px 0 40px",
    color: "#fff",
    fontFamily: "DM Sans",
    fontSize: 14,
    outline: "none",
  };

  return (
    <div
      style={{
        background: "#0F172A",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 16,
          padding: 40,
          width: "100%",
          maxWidth: 360,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#fff" }}>UBT.</div>
          <div style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.50)", marginTop: 4 }}>
            Painel Administrativo
          </div>
        </div>

        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ position: "relative" }}>
            <Mail size={16} color="rgba(255,255,255,0.40)" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              type="email"
              placeholder="admin@ubt.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
          </div>
          <div style={{ position: "relative" }}>
            <Lock size={16} color="rgba(255,255,255,0.40)" style={{ position: "absolute", left: 14, top: 14 }} />
            <input
              type={show ? "text" : "password"}
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ ...inputStyle, paddingRight: 40 }}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              style={{ position: "absolute", right: 12, top: 12, background: "none", border: "none", cursor: "pointer", padding: 2 }}
              aria-label="Mostrar senha"
            >
              {show ? <EyeOff size={16} color="rgba(255,255,255,0.50)" /> : <Eye size={16} color="rgba(255,255,255,0.50)" />}
            </button>
          </div>
        </div>

        {err && (
          <div
            style={{
              marginTop: 14,
              background: "rgba(232,64,64,0.10)",
              border: "1px solid #E84040",
              borderRadius: 8,
              padding: "10px 14px",
              fontFamily: "DM Sans",
              fontSize: 13,
              color: "#E84040",
            }}
          >
            Credenciais inválidas.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 20,
            width: "100%",
            minHeight: 48,
            background: "#0DB87E",
            color: "#fff",
            fontFamily: "Syne",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 999,
            border: "none",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Acessando..." : "Acessar painel"}
        </button>

        <div style={{ marginTop: 12, textAlign: "center", fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
          Use admin@ubt.com / admin123
        </div>
      </form>
    </div>
  );
}
