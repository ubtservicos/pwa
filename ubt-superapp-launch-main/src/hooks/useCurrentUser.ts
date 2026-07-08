import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type RealUser = {
  uid: string;
  name: string;
  email?: string;
  role: "tomador" | "prestador" | "admin" | "cocoecia" | "cocoecia-colaborador" | "cocoecia-dirigentes";
  plate?: string;
  modalidade?: "carona_entrega" | "so_entrega" | "so_carona";
  cpf?: string;
  sexo?: "masculino" | "feminino" | string;
  kycStatus?: string;
  status?: string;
};

export const useCurrentUser = (): RealUser => {
  const [user, setUser] = useState<RealUser>({
    uid: "",
    name: "Visitante",
    role: "tomador",
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async (authUser: any) => {
      if (!authUser) return;
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
          role: authUser.email === "ubt.servicos@gmail.com" ? "admin" : ((dbUser?.role as any) || "tomador"),
          kycStatus: authUser.user_metadata?.mototaxi_status === "kyc-pending" ? "approved" : (authUser.user_metadata?.mototaxi_status || "none"),
          modalidade: authUser.user_metadata?.modalidade_moto,
          plate: authUser.user_metadata?.placa_moto,
          cpf: authUser.user_metadata?.cpf,
          sexo: authUser.user_metadata?.sexo,
          status: userStatus,
        });
      } catch (err) {
        console.error("Erro ao carregar perfil do db:", err);
      }
    };

    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && active) {
          await loadProfile(authUser);
        }
      } catch (err) {
        console.error("Erro em fetchUser:", err);
      }
    };
    
    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && active) {
        // Executar busca do db de forma assíncrona não-bloqueante na próxima microtask
        setTimeout(() => {
          if (active) {
            loadProfile(session.user);
          }
        }, 50);
      } else if (!session && active) {
        setUser({
          uid: "",
          name: "Visitante",
          role: "tomador",
        });
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
