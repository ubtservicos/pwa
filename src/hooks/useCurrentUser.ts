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
        let dbUser: any = null;
        let mototaxiData: any = null;
        let carroData: any = null;
        let resolvedUid: string = authUser.id;

        // 1. Prefer SECURITY DEFINER RPCs that support both standard and legacy accounts (auth.uid != usuarios.id)
        const [{ data: rpcProfile, error: rpcErr }, { data: carroRpcProfile, error: carroRpcErr }] =
          await Promise.all([
            supabase.rpc("get_my_mototaxi_profile"),
            supabase.rpc("get_my_carro_profile"),
          ]);

        if (!rpcErr && rpcProfile && (rpcProfile as any).ok) {
          const payload = rpcProfile as any;
          dbUser = payload.usuario || null;
          mototaxiData = payload.mototaxi || null;
          if (payload.usuario_id) {
            resolvedUid = payload.usuario_id;
          }
        } else {
          // Fallback to direct queries
          const { data: uData } = await supabase
            .from("usuarios")
            .select("id, role, nome, status, under_review")
            .eq("id", authUser.id)
            .maybeSingle();
          dbUser = uData;
          if (uData?.id) resolvedUid = uData.id;

          const { data: mData } = await supabase
            .from("prestador_mototaxi")
            .select("kyc_status, modalidade, plate, cpf, gender")
            .eq("user_id", resolvedUid)
            .maybeSingle();
          mototaxiData = mData;
        }

        if (!carroRpcErr && carroRpcProfile && typeof carroRpcProfile === "object") {
          carroData = (carroRpcProfile as any).record ?? carroRpcProfile;
        } else {
          const { data: cData } = await supabase
            .from("prestador_carro")
            .select("kyc_status, modalidade, plate, cpf, gender")
            .eq("user_id", resolvedUid)
            .maybeSingle();
          carroData = cData;
        }

        if (!active) return;

        // Read status map from localStorage
        const savedStatuses = localStorage.getItem("ubt_users_status");
        let userStatus: string = dbUser?.status || "active";
        if (savedStatuses) {
          try {
            const parsed = JSON.parse(savedStatuses);
            if (parsed[resolvedUid] || parsed[authUser.id]) {
              userStatus = parsed[resolvedUid] || parsed[authUser.id];
            }
          } catch (e) {
            console.error(e);
          }
        }

        // Accurately resolve KYC status strictly from each vertical SSOT
        const resolvedKycStatus: "approved" | "pending" | "none" | "rejected" =
          mototaxiData?.kyc_status ? (mototaxiData.kyc_status as any) : "none";
        const resolvedCarroKycStatus: "approved" | "pending" | "none" | "rejected" =
          carroData?.kyc_status ? (carroData.kyc_status as any) : "none";

        setUser({
          uid: resolvedUid,
          name: dbUser?.nome || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || "Usuário",
          email: authUser.email,
          role: authUser.email === "ubt.servicos@gmail.com" ? "admin" : ((dbUser?.role as RealUserRole) || "tomador"),
          kycStatus: resolvedKycStatus,
          carroKycStatus: resolvedCarroKycStatus,
          modalidade: mototaxiData?.modalidade || null,
          plate: mototaxiData?.plate || null,
          carroModalidade: carroData?.modalidade || null,
          carroPlate: carroData?.plate || null,
          cpf: mototaxiData?.cpf || carroData?.cpf || dbUser?.cpf || authUser.user_metadata?.cpf || null,
          sexo: mototaxiData?.gender || carroData?.gender || authUser.user_metadata?.sexo || null,
          status: userStatus,
          mototaxiActive: authUser.user_metadata?.mototaxi_active !== false,
          carroActive: authUser.user_metadata?.carro_active !== false,
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
