import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Settings, LogOut, ShieldAlert } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { supabase } from "../lib/supabase";

export const AssociacaoLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useCurrentUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/app/associacao/dashboard" },
    { label: "Membros", icon: Users, path: "/app/associacao/membros" },
    { label: "Mensageria", icon: MessageSquare, path: "/app/associacao/mensageria" },
    { label: "Configurações", icon: Settings, path: "/app/associacao/config" },
  ];

  return (
    <div className="min-h-[100svh] bg-[#09090B] text-white flex flex-col md:flex-row" style={{ fontFamily: "DM Sans" }}>
      {/* Sidebar / Left Navigation */}
      <aside className="w-full md:w-64 bg-[#18181B] border-b md:border-b-0 md:border-r border-[#27272A] flex flex-col shrink-0">
        {/* Header Branding */}
        <div className="p-6 flex items-center justify-between border-b border-[#27272A]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={24} className="text-[#00FF66]" />
            <span style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 18 }} className="tracking-wide">
              UBT B2B
            </span>
          </div>
          <span className="text-[10px] bg-[#27272A] border border-[#3f3f46] text-[#00FF66] px-2 py-0.5 rounded-full font-bold uppercase">
            Portal
          </span>
        </div>

        {/* Association Mini Profile */}
        <div className="p-4 mx-4 my-2 bg-[#09090B] border border-[#27272A] rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#18181B] border border-[#27272A] flex items-center justify-center font-bold text-[#00FF66]">
            {user.name ? user.name.substring(0, 2).toUpperCase() : "AS"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate margin-0">{user.name || "Associação"}</p>
            <p className="text-[11px] text-white/50 truncate margin-0">Presidente / Gestor</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-4 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible scrollbar-none">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all flex-shrink-0 md:flex-shrink ${
                  active
                    ? "bg-[#00FF66] text-[#09090B] font-bold shadow-lg shadow-[#00FF66]/10"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#27272A] hidden md:block">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut size={18} />
            <span>Sair do Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-24 md:pb-0">
        {/* Mobile Top Navbar Header */}
        <header className="bg-[#18181B] border-b border-[#27272A] px-6 py-4 flex items-center justify-between md:hidden">
          <h2 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700 }}>
            {navItems.find((n) => n.path === location.pathname)?.label || "Portal"}
          </h2>
          <button
            onClick={handleLogout}
            className="text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-6 md:p-8 flex-1 max-w-5xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
