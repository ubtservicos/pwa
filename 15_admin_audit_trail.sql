-- migration: 15_admin_audit_trail.sql
-- Trilha de Auditoria Administrativa Imutavel LGPD / Compliance

-- 1. Garantir que a coluna status existe em usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- 2. Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS public.admin_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    action_type text NOT NULL,
    entity_type text,
    entity_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Politicas RLS
-- Apenas administradores ou triggers de sistema leem
CREATE POLICY "Admins leem trilha de auditoria" ON public.admin_actions
    FOR SELECT USING (public.is_admin());

-- Insercoes permitidas a qualquer usuario autenticado (as triggers rodam sob o contexto do usuario logado)
CREATE POLICY "Insercao de logs via triggers ou admins" ON public.admin_actions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- NENHUMA politica para UPDATE ou DELETE existe -> Operacoes bloqueadas por padrao

-- 3. Funcao da Trigger para logar acoes de usuarios
CREATE OR REPLACE FUNCTION public.process_usuarios_audit()
RETURNS TRIGGER AS $$
DECLARE
    current_admin_id uuid;
BEGIN
    -- Captura o UID do admin autenticado na conexao Supabase
    current_admin_id := auth.uid();
    
    -- Se nao houver conexao autenticada (ex: update via script/worker local), nao bloqueia, mas loga
    
    -- Caso 1: Aprovacao/Reprovacao de KYC (Alteracao de role)
    IF OLD.role <> NEW.role THEN
        IF NEW.role = 'prestador' THEN
            INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
            VALUES (current_admin_id, NEW.id, 'kyc_approved', 'usuarios', NEW.id::text, jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role));
        ELSIF NEW.role = 'tomador' AND OLD.role = 'prestador' THEN
            INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
            VALUES (current_admin_id, NEW.id, 'kyc_rejected', 'usuarios', NEW.id::text, jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role));
        END IF;
    END IF;

    -- Caso 2: Suspensao/Desbloqueio (Alteracao de status)
    IF OLD.status <> NEW.status THEN
        IF NEW.status = 'active' THEN
            INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
            VALUES (current_admin_id, NEW.id, 'user_unsuspended', 'usuarios', NEW.id::text, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        ELSE
            INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
            VALUES (current_admin_id, NEW.id, 'user_suspended', 'usuarios', NEW.id::text, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_usuarios_audit
    AFTER UPDATE ON public.usuarios
    FOR EACH ROW
    EXECUTE FUNCTION public.process_usuarios_audit();


-- 4. Funcao da Trigger para logar acoes de payouts
CREATE OR REPLACE FUNCTION public.process_payouts_audit()
RETURNS TRIGGER AS $$
DECLARE
    current_admin_id uuid;
BEGIN
    current_admin_id := auth.uid();
    
    IF OLD.status <> NEW.status AND NEW.status = 'paid' THEN
        INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
        VALUES (current_admin_id, NEW.recipient_id, 'payout_approved', 'payouts', NEW.id::text, jsonb_build_object('amount', NEW.amount, 'recipient_id', NEW.recipient_id));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_payouts_audit
    AFTER UPDATE ON public.payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.process_payouts_audit();


-- 5. Funcao da Trigger para logar acoes de disputas
CREATE OR REPLACE FUNCTION public.process_disputes_audit()
RETURNS TRIGGER AS $$
DECLARE
    current_admin_id uuid;
BEGIN
    current_admin_id := auth.uid();
    
    IF OLD.status <> NEW.status AND NEW.status IN ('resolved_customer', 'resolved_provider', 'closed') THEN
        INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
        VALUES (current_admin_id, NEW.operator_id, 'dispute_resolved', 'disputes', NEW.id::text, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'amount', NEW.amount));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_disputes_audit
    AFTER UPDATE ON public.disputes
    FOR EACH ROW
    EXECUTE FUNCTION public.process_disputes_audit();


-- 6. Funcao da Trigger para logar acoes de refunds (estornos)
CREATE OR REPLACE FUNCTION public.process_refunds_audit()
RETURNS TRIGGER AS $$
DECLARE
    current_admin_id uuid;
BEGIN
    current_admin_id := auth.uid();
    
    INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
    VALUES (current_admin_id, NULL, 'refund_processed', 'refunds', NEW.id::text, jsonb_build_object('payment_id', NEW.payment_id, 'amount', NEW.amount, 'reason', NEW.reason));

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_refunds_audit
    AFTER INSERT ON public.refunds
    FOR EACH ROW
    EXECUTE FUNCTION public.process_refunds_audit();


-- 7. Funcao da Trigger para logar acoes de payment_splits (alteracao de split)
CREATE OR REPLACE FUNCTION public.process_splits_audit()
RETURNS TRIGGER AS $$
DECLARE
    current_admin_id uuid;
BEGIN
    current_admin_id := auth.uid();
    
    IF OLD.amount <> NEW.amount OR OLD.status <> NEW.status THEN
        INSERT INTO public.admin_actions (admin_id, target_user_id, action_type, entity_type, entity_id, metadata)
        VALUES (current_admin_id, NEW.recipient_id, 'split_updated', 'payment_splits', NEW.id::text, jsonb_build_object('old_amount', OLD.amount, 'new_amount', NEW.amount, 'old_status', OLD.status, 'new_status', NEW.status));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_splits_audit
    AFTER UPDATE ON public.payment_splits
    FOR EACH ROW
    EXECUTE FUNCTION public.process_splits_audit();
