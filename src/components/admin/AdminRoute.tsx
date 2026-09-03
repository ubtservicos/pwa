import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const ADMIN_ROLES = ["operator", "operations_manager", "financeiro", "moderador", "admin", "super_admin", "superadmin", "kyc", "auditoria", "analytics"];

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permission?: string;
}

export const AdminRoute = ({ children, allowedRoles, permission }: AdminRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let role = user.email === "ubt.servicos@gmail.com" ? "super_admin" : null;

          if (!role) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();
            role = profile?.role;
          }

          if (!role) {
            const { data: dbUser } = await supabase
              .from("usuarios")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();
            role = dbUser?.role;
          }

          if (!role) {
            role = (user.user_metadata?.role as string) || (user.app_metadata?.role as string) || "tomador";
          }
          
          if (role === "super_admin" || role === "superadmin") {
            setIsAuthorized(true);
          } else if (permission) {
            const { data: hasPerm } = await supabase.rpc("has_permission", {
              p_user_id: user.id,
              p_permission_code: permission,
            });
            if (hasPerm) {
              setIsAuthorized(true);
            } else if (allowedRoles && allowedRoles.includes(role)) {
              setIsAuthorized(true);
            }
          } else if (allowedRoles && allowedRoles.length > 0) {
            if (allowedRoles.includes(role)) {
              setIsAuthorized(true);
            }
          } else {
            if (ADMIN_ROLES.includes(role)) {
              setIsAuthorized(true);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao validar credenciais admin RBAC:", err);
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, [allowedRoles, permission]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0F172A", color: "#fff", fontFamily: "DM Sans" }}>
        Validando credenciais administrativas (RBAC)...
      </div>
    );
  }

  return isAuthorized ? <>{children}</> : <Navigate to="/admin/login" replace />;
};
