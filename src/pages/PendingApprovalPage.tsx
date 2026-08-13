import { useNavigate } from "react-router-dom";
import { ShieldAlert, LogOut, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className="min-h-[100svh] bg-[#09090B] text-white flex flex-col justify-between p-6"
      style={{ fontFamily: "DM Sans" }}
    >
      {/* Header */}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldAlert size={26} color="#00FF66" />
          <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 800 }}>UBT Serviços</span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "8px 16px",
            color: "#E84040",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <LogOut size={15} /> Sair
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto my-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6 relative"
          style={{
            background: "rgba(0, 255, 102, 0.08)",
            border: "2px solid rgba(0, 255, 102, 0.2)",
          }}
        >
          <Clock size={36} className="text-[#00FF66]" />
          {/* Neon pulse animation outer ring */}
          <span
            className="absolute inset-0 rounded-full border border-[#00FF66] opacity-30 animate-ping"
            style={{ animationDuration: "2s" }}
          />
        </div>

        <h1
          style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, marginBottom: 12 }}
          className="tracking-tight"
        >
          Cadastro em Análise ⚡
        </h1>
        
        <p className="text-[15px] text-[#A1A1AA] leading-relaxed mb-6">
          Olá, <strong className="text-white">{user.name || "parceiro"}</strong>! Recebemos seus dados com sucesso.
        </p>

        <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-5 w-full text-left">
          <p className="text-[13px] text-[#A1A1AA] leading-relaxed margin-0">
            Nossa equipe de segurança e compliance está analisando seu cadastro para liberar seu acesso ao Superapp.
          </p>
          <div className="flex items-center gap-2 mt-4 text-[12px] font-semibold text-[#00FF66]">
            <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />
            Prazo estimado de liberação: em até 24h
          </div>
        </div>
      </main>

      {/* Footer support branding */}
      <footer className="text-center text-[11px] text-[#A1A1AA]/50 uppercase tracking-widest pb-4">
        UBT Ubatuba Technology &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
