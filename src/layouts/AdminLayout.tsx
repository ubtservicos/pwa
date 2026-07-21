import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart2,
  Divide,
  Building2,
  Zap,
  Scale,
  Megaphone,
  Recycle,
  Sparkles,
  LogOut,
  Menu,
  X,
  Clock,
  CreditCard,
  Landmark,
  ShieldAlert,
  RefreshCw,
  Ban,
  Activity,
  ShieldCheck,
  BarChart3
} from "lucide-react";
import { AdminToastProvider } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

export const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin", roles: ["operator", "financeiro", "moderador", "admin", "super_admin"] },
  { icon: Activity, label: "Saúde da Plataforma", path: "/admin/health", roles: ["operations_manager", "operator", "admin", "super_admin"] },
  { icon: Clock, label: "KYCs Pendentes", path: "/admin/kyc-pendentes", roles: ["operator", "admin", "super_admin"] },
  { icon: Users, label: "Clientes", path: "/admin/clientes", roles: ["operator", "moderador", "admin", "super_admin"] },
  { icon: BarChart2, label: "Financeiro", path: "/admin/financeiro", roles: ["financeiro", "admin", "super_admin"] },
  { icon: CreditCard, label: "Pagamentos", path: "/admin/payments", roles: ["financeiro", "admin", "super_admin"] },
  { icon: Landmark, label: "Saques / Payouts", path: "/admin/payouts", roles: ["financeiro", "admin", "super_admin"] },
  { icon: ShieldAlert, label: "Mediações", path: "/admin/disputes", roles: ["moderador", "admin", "super_admin"] },
  { icon: RefreshCw, label: "Estornos", path: "/admin/refunds", roles: ["financeiro", "admin", "super_admin"] },
  { icon: Ban, label: "Cancelamentos", path: "/admin/cancellations", roles: ["operator", "financeiro", "admin", "super_admin"] },
  { icon: Activity, label: "Operações Realtime", path: "/admin/operacoes", roles: ["operator", "admin", "super_admin"] },
  { icon: ShieldCheck, label: "Privacidade / LGPD", path: "/admin/lgpd", roles: ["super_admin"] },
  { icon: Clock, label: "Auditoria / Logs", path: "/admin/auditoria", roles: ["super_admin"] },
  { icon: ShieldAlert, label: "Antifraude", path: "/admin/antifraude", roles: ["admin", "super_admin"] },
  { icon: BarChart3, label: "Analytics Operacional", path: "/admin/analytics", roles: ["admin", "super_admin"] },
  { icon: ShieldCheck, label: "Permissões RBAC", path: "/admin/permissoes", roles: ["admin", "super_admin"] },
  { icon: CheckCircle2, label: "Quality Center", path: "/admin/quality", roles: ["admin", "super_admin"] },
  { icon: Shield, label: "Security Center", path: "/admin/security", roles: ["admin", "super_admin"] },
  { icon: Settings, label: "Configurações", path: "/admin/configuracoes", roles: ["admin", "super_admin"] },
  { icon: Divide, label: "Taxa de Serviço", path: "/admin/split", roles: ["financeiro", "admin", "super_admin"] },
  { icon: Building2, label: "Entidades", path: "/admin/entidades", roles: ["operator", "admin", "super_admin"] },
  { icon: Zap, label: "Preço Dinâmico", path: "/admin/preco", roles: ["operator", "admin", "super_admin"] },
  { icon: Scale, label: "Arbitragem", path: "/admin/arbitragem", roles: ["moderador", "admin", "super_admin"] },
  { icon: Megaphone, label: "Conteúdo", path: "/admin/conteudo", roles: ["operator", "admin", "super_admin"] },
  { icon: Recycle, label: "Côco & Cia", path: "/admin/coco", roles: ["operator", "admin", "super_admin"] },
  { icon: Sparkles, label: "Diaristas", path: "/admin/diaristas", roles: ["operator", "admin", "super_admin"] },
];

const sectionTitle = (path: string) => {
  if (path === "/admin") return "Dashboard";
  return NAV_ITEMS.find((n) => n.path === path)?.label ?? "Painel";
};

const Sidebar = ({ onItemClick }: { onItemClick?: () => void }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [role, setRole] = useState<string>("tomador");
  const [adminName, setAdminName] = useState<string>("Admin UBT");

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dbUser } = await supabase
          .from("usuarios")
          .select("nome, role")
          .eq("id", user.id)
          .maybeSingle();
        
        const resolvedRole = user.email === "ubt.servicos@gmail.com" ? "super_admin" : (dbUser?.role || "tomador");
        setRole(resolvedRole);
        setAdminName(dbUser?.nome || user.email || "Admin UBT");
      }
    };
    fetchUserRole();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const initials = adminName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const filteredItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });

  return (
    <aside
      style={{
        width: 240,
        background: "var(--admin-sidebar)",
        height: "100svh",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "24px 20px 16px", display: "flex", alignItems: "center" }}>
        <span style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#fff" }}>UBT.</span>
        <span
          style={{
            marginLeft: 8,
            background: "rgba(13,184,126,0.20)",
            color: "#0DB87E",
            fontFamily: "DM Sans",
            fontSize: 9,
            fontWeight: 600,
            borderRadius: 999,
            padding: "3px 8px",
            letterSpacing: 1,
            textTransform: "uppercase"
          }}
        >
          {role.replace("_", " ")}
        </span>
      </div>
      <nav style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {filteredItems.map((item) => {
          const active = pathname === item.path;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onItemClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                fontFamily: "DM Sans",
                fontSize: 14,
                fontWeight: 500,
                background: active ? "rgba(13,184,126,0.15)" : "transparent",
                color: active ? "#0DB87E" : "rgba(255,255,255,0.60)",
                transition: "background 150ms",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon size={18} color={active ? "#0DB87E" : "rgba(255,255,255,0.45)"} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div
        style={{
          padding: "16px 12px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "rgba(13,184,126,0.15)",
            color: "#0DB87E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "DM Sans",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.90)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
            {adminName}
          </span>
          <span style={{ fontFamily: "DM Sans", fontSize: 10, color: "rgba(255,255,255,0.40)", textTransform: "capitalize" }}>
            {role.replace("_", " ")}
          </span>
        </div>
        <button onClick={logout} aria-label="Sair" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <LogOut size={16} color="rgba(255,255,255,0.40)" />
        </button>
      </div>
    </aside>
  );
};

const TopBar = ({ onMenu }: { onMenu?: () => void }) => {
  const { pathname } = useLocation();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <header
      style={{
        height: 60,
        background: "var(--admin-surface)",
        borderBottom: "1px solid var(--admin-border)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onMenu && (
          <button onClick={onMenu} aria-label="Menu" style={{ background: "none", border: "none", cursor: "pointer" }}>
            <Menu size={20} color="#0F172A" />
          </button>
        )}
        <div style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8" }}>
          UBT Admin <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "#0F172A", fontWeight: 500 }}>{sectionTitle(pathname)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8" }}>
          {now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(13,184,126,0.10)",
            border: "1px solid rgba(13,184,126,0.25)",
            borderRadius: 999,
            padding: "3px 10px",
            fontFamily: "DM Sans",
            fontSize: 11,
            color: "#0DB87E",
          }}
        >
          <span className="admin-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: "#0DB87E", display: "inline-block" }} />
          Ao vivo
        </span>
      </div>
    </header>
  );
};

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;
  const [desktop, setDesktop] = useState(isDesktop);
  useEffect(() => {
    const onR = () => setDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  return (
    <AdminToastProvider>
      <div style={{ height: "100svh", display: "flex", overflow: "hidden", background: "var(--admin-bg)" }}>
        {desktop && <Sidebar />}
        {!desktop && drawerOpen && (
          <>
            <div
              onClick={() => setDrawerOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }}
            />
            <div style={{ position: "fixed", left: 0, top: 0, height: "100svh", zIndex: 70 }}>
              <Sidebar onItemClick={() => setDrawerOpen(false)} />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Fechar"
                style={{ position: "absolute", top: 18, right: -36, background: "#0F172A", border: "none", color: "#fff", padding: 6, borderRadius: 8, cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>
          </>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TopBar onMenu={!desktop ? () => setDrawerOpen(true) : undefined} />
          <main style={{ flex: 1, overflowY: "auto", background: "var(--admin-bg)" }}>{children}</main>
        </div>
      </div>
    </AdminToastProvider>
  );
};
