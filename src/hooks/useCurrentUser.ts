import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { RealUser, RealUserRole } from "@/types/database.types";

export const useCurrentUser = (): RealUser => {
  const [user, setUser] = useState<RealUser>({
    uid: "",
    name: "Visitante",
    role: "tomador",
    isLoading: true, // Inicia como true para sinalizar carregamento assíncrono
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async (authUser: any) => {
      if (!authUser) {
        if (active) {
          setUser((prev) => ({ ...prev, isLoading: false }));
        }
        return;
      }
      try {
        const { data: dbUser } = await supabase
          .from("usuarios")
          .select("role, nome")
          .eq("id", authUser.id)
          .maybeSingle();

        if (!active) return;

        // Read status map from localStorage
        const savedStatuses = localStorage.getItem("ubt_users_status");
        let userStatus: string = "active";
        if (savedStatuses) {
          try {
            const parsed = JSON.parse(savedStatuses);
            if (parsed[authUser.id]) {
              userStatus = parsed[authUser.id];
            }
          } catch (e) {
            console.error(e);
          }
        }

        setUser({
          uid: authUser.id,
          name: dbUser?.nome || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || "Usuário",
          email: authUser.email,
          role: authUser.email === "ubt.servicos@gmail.com" ? "admin" : ((dbUser?.role as RealUserRole) || "tomador"),
          kycStatus: authUser.user_metadata?.mototaxi_status === "kyc-pending" ? "approved" : (authUser.user_metadata?.mototaxi_status || "none"),
          modalidade: authUser.user_metadata?.modalidade_moto,
          plate: authUser.user_metadata?.placa_moto,
          cpf: authUser.user_metadata?.cpf,
          sexo: authUser.user_metadata?.sexo,
          status: userStatus,
          mototaxiActive: authUser.user_metadata?.mototaxi_active !== false,
          isLoading: false, // Carregamento concluído com sucesso
        });
      } catch (err) {
        console.error("Erro ao carregar perfil do db:", err);
        if (active) {
          setUser((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };

    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && active) {
          await loadProfile(session.user);
        } else {
          if (active) {
            setUser((prev) => ({ ...prev, isLoading: false }));
          }
        }
      } catch (err) {
        console.error("Erro em fetchSession:", err);
        if (active) {
          setUser((prev) => ({ ...prev, isLoading: false }));
        }
      }
    };
    
    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && active) {
        // Executar busca do db de forma assíncrona não-bloqueante na próxima microtask
        setTimeout(() => {
          if (active) {
            loadProfile(session.user);
          }
        }, 50);
      } else if (!session && active) {
        // Session expired or user signed out — redirect to login
        setUser({
          uid: "",
          name: "Visitante",
          role: "tomador",
          isLoading: false,
        });

        if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          // Only redirect if we're on a protected page (not already on login/landing)
          const path = window.location.pathname;
          if (path !== "/login" && path !== "/" && !path.startsWith("/admin/login")) {
            window.location.href = "/login";
          }
        }
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return user;
};

export const setCurrentUid = (uid: string) => {
  console.warn("setCurrentUid: mock function disabled");
};
