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
  const [blockedInfo, setBlockedInfo] = useState<{
    until: string | null;
    durationLabel: string | null;
    reason: string | null;
  } | null>(null);

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

        // Check user role, status and active administrative block from database
        const { data: dbUser } = await supabase
          .from("usuarios")
          .select("role, status, is_blocked, blocked_until, block_duration_label, blocked_reason")
          .eq("id", authUser.id)
          .maybeSingle();

        const isBlockActive =
          Boolean(dbUser?.is_blocked) &&
          (!dbUser?.blocked_until || new Date(dbUser.blocked_until).getTime() > Date.now());

        if (isBlockActive) {
          await supabase.auth.signOut().catch(() => {});
          if (active) {
            setBlockedInfo({
              until: dbUser?.blocked_until || null,
              durationLabel: dbUser?.block_duration_label || null,
              reason: dbUser?.blocked_reason || null,
            });
            setChecking(false);
          }
          return;
        }

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

        // 2. Check fast persistent / session cache
        const isLocallyVerified =
          localStorage.getItem(`ubt_lgpd_verified_${authUser.id}`) === "true" ||
          localStorage.getItem(`ubt_terms_accepted_${authUser.id}`) === "true" ||
          localStorage.getItem("ubt_terms_accepted") === "true" ||
          sessionStorage.getItem(`ubt_lgpd_verified_${authUser.id}`) === "true";

        if (isLocallyVerified) {
          if (active) {
            setChecking(false);
            if (location.pathname === "/app/consentimento") {
              navigate("/app/home", { replace: true });
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

        // Verify if any or required versions are accepted
        const hasAnyConsent = data && data.length > 0;
        const acceptedMap = new Set(
          (data || []).map((c) => `${c.document_type}:${c.document_version}`)
        );

        const hasTerms = acceptedMap.has(`terms:${REQUIRED_VERSIONS.terms}`) || (data || []).some((c) => c.document_type === "terms");
        const hasPrivacy = acceptedMap.has(`privacy:${REQUIRED_VERSIONS.privacy}`) || (data || []).some((c) => c.document_type === "privacy");
        const hasCookies = acceptedMap.has(`cookies:${REQUIRED_VERSIONS.cookies}`) || (data || []).some((c) => c.document_type === "cookies");

        if ((hasTerms && hasPrivacy && hasCookies) || hasAnyConsent) {
          // Cache check result in persistent storage
          localStorage.setItem(`ubt_lgpd_verified_${authUser.id}`, "true");
          localStorage.setItem(`ubt_terms_accepted_${authUser.id}`, "true");
          localStorage.setItem("ubt_terms_accepted", "true");
          sessionStorage.setItem(`ubt_lgpd_verified_${authUser.id}`, "true");
          
          if (active) {
            setChecking(false);
            if (location.pathname === "/app/consentimento") {
              navigate("/app/home", { replace: true });
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

  if (blockedInfo) {
    const untilFormatted = blockedInfo.until
      ? new Date(blockedInfo.until).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "Tempo indefinido";

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0F14",
          color: "#fff",
          padding: 24,
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#111827",
            border: "1px solid rgba(239, 68, 68, 0.45)",
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🚫</div>
          <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 700, color: "#F87171", margin: 0 }}>
            Acesso Temporariamente Bloqueado
          </h2>
          <p style={{ fontSize: 14, color: "#D1D5DB", marginTop: 12, lineHeight: 1.5 }}>
            Sua conta está bloqueada pela administração da UBT.
          </p>
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.10)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              fontSize: 13,
              color: "#FCA5A5",
            }}
          >
            <div>
              <strong>Vigência:</strong> {blockedInfo.until ? `Até ${untilFormatted}` : "Tempo indefinido"}
              {blockedInfo.durationLabel ? ` (${blockedInfo.durationLabel})` : ""}
            </div>
            {blockedInfo.reason && (
              <div style={{ marginTop: 6 }}>
                <strong>Motivo:</strong> {blockedInfo.reason}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            style={{
              marginTop: 20,
              width: "100%",
              height: 44,
              borderRadius: 10,
              border: "none",
              background: "#10B981",
              color: "#04130D",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

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
