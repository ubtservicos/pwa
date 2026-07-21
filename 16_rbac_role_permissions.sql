-- migration: 16_rbac_role_permissions.sql
-- Modelagem de controle de acesso baseado em papeis (RBAC)

-- Atualizar a funcao is_admin para reconhecer todos os papeis administrativos do RBAC
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
    current_role text;
BEGIN
    SELECT role INTO current_role 
    FROM public.usuarios 
    WHERE id = auth.uid();
    
    RETURN current_role IN ('operator', 'financeiro', 'moderador', 'admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
