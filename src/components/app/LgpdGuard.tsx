import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const checkConsents = async () => {
      // If visitor/not logged in yet, wait or allow public access (App.tsx handles login routing)
      if (!user || !user.uid) {
        setChecking(false);
        return;
      }

      // Check fast session cache
      const cached = sessionStorage.getItem(`ubt_lgpd_verified_${user.uid}`);
      if (cached === "true") {
        if (location.pathname === "/app/consentimento") {
          navigate("/app/home");
        }
        setChecking(false);
        return;
      }

      try {
        // Query accepted consents for this user
        const { data, error } = await supabase
          .from("user_consents")
          .select("document_type, document_version")
          .eq("user_id", user.uid);

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
          sessionStorage.setItem(`ubt_lgpd_verified_${user.uid}`, "true");
          
          if (location.pathname === "/app/consentimento") {
            navigate("/app/home");
          }
        } else {
          // Missing one or more consents -> Redirect to consent page
          if (location.pathname !== "/app/consentimento") {
            navigate("/app/consentimento", { replace: true });
          }
        }
      } catch (err) {
        console.error("Erro ao verificar consentimentos LGPD:", err);
      } finally {
        if (active) setChecking(false);
      }
    };

    checkConsents();

    return () => {
      active = false;
    };
  }, [user, location.pathname, navigate]);

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
