import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface LgpdGuardProps {
  children?: React.ReactNode;
}

const REQUIRED_VERSIONS = {
  terms: "terms_v1",
  privacy: "privacy_v1",
  cookies: "cookies_v1",
};

export default function LgpdGuard({ children }: LgpdGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const checkConsents = async () => {
      try {
        // 1. Get current authenticated user securely from Supabase
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          // User not authenticated -> redirect to /login
          if (active) {
            setChecking(false);
            if (location.pathname !== "/login") {
              navigate("/login", { replace: true });
            }
          }
          return;
        }

        // Check user role and status from database to isolate association routes and pending state
        const { data: dbUser } = await supabase
          .from("usuarios")
          .select("role, status")
          .eq("id", authUser.id)
          .maybeSingle();

        const userRole = authUser.email === "ubt.servicos@gmail.com" ? "admin" : (dbUser?.role || "tomador");
        const userStatus = dbUser?.status || "active";

        if (userStatus === "pending") {
          if (location.pathname !== "/app/pendente") {
            if (active) {
              setChecking(false);
              navigate("/app/pendente", { replace: true });
            }
          } else {
            if (active) {
              setChecking(false);
            }
          }
          return;
        }

        if (userRole === "associacao") {
          if (!location.pathname.startsWith("/app/associacao/")) {
            if (active) {
              setChecking(false);
              navigate("/app/associacao/dashboard", { replace: true });
            }
          } else {
            if (active) {
              setChecking(false);
            }
          }
          return;
        }

        // 2. Check fast session cache
        const cached = sessionStorage.getItem(`ubt_lgpd_verified_${authUser.id}`);
        if (cached === "true") {
          if (active) {
            setChecking(false);
            if (location.pathname === "/app/consentimento") {
              navigate("/app/home");
            }
          }
          return;
        }

        // 3. Query accepted consents for this user
        const { data, error } = await supabase
          .from("user_consents")
          .select("document_type, document_version")
          .eq("user_id", authUser.id);

        if (error) throw error;

        // Verify if all required versions are accepted
        const acceptedMap = new Set(
          (data || []).map((c) => `${c.document_type}:${c.document_version}`)
        );

        const hasTerms = acceptedMap.has(`terms:${REQUIRED_VERSIONS.terms}`);
        const hasPrivacy = acceptedMap.has(`privacy:${REQUIRED_VERSIONS.privacy}`);
        const hasCookies = acceptedMap.has(`cookies:${REQUIRED_VERSIONS.cookies}`);

        if (hasTerms && hasPrivacy && hasCookies) {
          // Cache check result in session storage
          sessionStorage.setItem(`ubt_lgpd_verified_${authUser.id}`, "true");
          
          if (active) {
            setChecking(false);
            if (location.pathname === "/app/consentimento") {
              navigate("/app/home");
            }
          }
        } else {
          // Missing one or more consents -> Redirect to consent page
          if (active) {
            setChecking(false);
            if (location.pathname !== "/app/consentimento") {
              navigate("/app/consentimento", { replace: true });
            }
          }
        }
      } catch (err) {
        console.error("Erro ao verificar consentimentos LGPD:", err);
        if (active) setChecking(false);
      }
    };

    checkConsents();

    return () => {
      active = false;
    };
  }, [location.pathname, navigate]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100svh",
          background: "#0A1128",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "DM Sans",
          color: "rgba(255,255,255,0.70)",
        }}
      >
        <span>Verificando termos de conformidade...</span>
      </div>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
