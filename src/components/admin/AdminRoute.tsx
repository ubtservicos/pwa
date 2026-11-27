import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const ADMIN_ROLES = ["operator", "operations_manager", "financeiro", "moderador", "admin", "super_admin", "superadmin", "kyc", "auditoria", "analytics"];

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permission?: string;
  associationCategory?: "mototaxi" | "carro";
}

export const AdminRoute = ({
  children,
  allowedRoles,
  permission,
  associationCategory,
}: AdminRouteProps) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string>("/admin/login");

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

          if (!role || role === "tomador" || role === "prestador" || role === "user") {
            const { data: cocoColab } = await supabase
              .from("coco_colaboradores")
              .select("perfil, status_aprovacao, is_ativo")
              .eq("user_id", user.id)
              .eq("status_aprovacao", "aprovado")
              .eq("is_ativo", true)
              .maybeSingle();
            if (cocoColab && (cocoColab.perfil === "alta_gestao" || cocoColab.perfil === "colaborador_administrativo")) {
              role = cocoColab.perfil === "alta_gestao" ? "cocoecia-dirigentes" : "cocoecia-colaborador";
            }
          }

          if (!role) {
            role = (user.user_metadata?.role as string) || (user.app_metadata?.role as string) || "tomador";
          }

          const isAssocRole = role === "associacao" || role === "associacao_lider";

          if (role === "super_admin" || role === "superadmin") {
            setIsAuthorized(true);
          } else if (isAssocRole) {
            let assocCat = "mototaxi";
            if (typeof (supabase as any).rpc === "function") {
              try {
                const { data: scope } = await (supabase as any).rpc("get_my_association_scope");
                if (scope && typeof scope === "object" && (scope as any).associacao_categoria) {
                  assocCat = String((scope as any).associacao_categoria).toLowerCase().trim() || "mototaxi";
                }
              } catch {
                // fallback to mototaxi
              }
            }
            const assocHome = assocCat === "carro" ? "/admin/carros" : "/admin/mototaxistas/dashboard";
            const roleAllowed = Boolean(allowedRoles && allowedRoles.includes(role));
            const categoryAllowed = !associationCategory || associationCategory === assocCat;

            if (roleAllowed && categoryAllowed) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
              setRedirectPath(assocHome);
            }
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
  }, [allowedRoles, permission, associationCategory]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0F172A", color: "#fff", fontFamily: "DM Sans" }}>
        Validando credenciais administrativas (RBAC)...
      </div>
    );
  }

  return isAuthorized ? <>{children}</> : <Navigate to={redirectPath} replace />;
};
