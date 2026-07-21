import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

let memoryCachePermissions: string[] | null = null;
let memoryCacheUserRole: string | null = null;

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>(memoryCachePermissions || []);
  const [userRole, setUserRole] = useState<string>(memoryCacheUserRole || "");
  const [loading, setLoading] = useState<boolean>(!memoryCachePermissions);

  const fetchPermissions = useCallback(async (force = false) => {
    if (!force && memoryCachePermissions) {
      setPermissions(memoryCachePermissions);
      setUserRole(memoryCacheUserRole || "");
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      // Check user role
      const { data: dbUser } = await supabase
        .from("usuarios")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = user.email === "ubt.servicos@gmail.com" ? "super_admin" : (dbUser?.role || "tomador");
      memoryCacheUserRole = role;
      setUserRole(role);

      // Super admin bypass
      if (role === "super_admin") {
        const { data: allPerms } = await supabase.from("permissions").select("codigo");
        const permCodes = allPerms ? allPerms.map((p) => p.codigo) : [];
        memoryCachePermissions = permCodes;
        setPermissions(permCodes);
        setLoading(false);
        return;
      }

      // Fetch RPC permissions
      const { data: rpcData, error } = await supabase.rpc("get_user_permissions", { p_user_id: user.id });
      if (error) throw error;

      const codes = (rpcData || []).map((p: any) => p.codigo);
      memoryCachePermissions = codes;
      setPermissions(codes);
    } catch (err) {
      console.error("Erro ao carregar permissões RBAC:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((permCode: string): boolean => {
    if (userRole === "super_admin" || permissions.includes("system.admin")) return true;
    return permissions.includes(permCode);
  }, [permissions, userRole]);

  return {
    permissions,
    userRole,
    loading,
    hasPermission,
    refresh: () => fetchPermissions(true),
  };
}

export function useCan(permissionCode: string): boolean {
  const { hasPermission, loading } = usePermissions();
  if (loading) return false;
  return hasPermission(permissionCode);
}

export function useRole(roleCode: string): boolean {
  const { userRole, loading } = usePermissions();
  if (loading) return false;
  return userRole === roleCode || userRole === "super_admin";
}
