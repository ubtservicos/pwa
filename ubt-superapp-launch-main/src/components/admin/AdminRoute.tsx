import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: dbUser } = await supabase
            .from("usuarios")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          const role = user.email === "ubt.servicos@gmail.com" ? "admin" : (dbUser?.role || "tomador");
          if (role === "admin") {
            setIsAdmin(true);
          }
        }
      } catch (err) {
        console.error("Erro ao validar credenciais admin:", err);
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0F172A", color: "#fff", fontFamily: "DM Sans" }}>
        Validando credenciais administrativas...
      </div>
    );
  }

  return isAdmin ? <>{children}</> : <Navigate to="/admin/login" replace />;
};
