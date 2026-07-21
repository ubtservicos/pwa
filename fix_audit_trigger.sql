-- Redefine public.log_financial_audit() to match public.audit_events schema
CREATE OR REPLACE FUNCTION public.log_financial_audit()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.audit_events (actor_id, actor_role, event_type, metadata)
    VALUES (
        auth.uid(),
        'system_financial_trigger',
        TG_OP || '_' || TG_TABLE_NAME,
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'record_id', COALESCE(NEW.id, OLD.id),
            'payload', row_to_json(COALESCE(NEW, OLD))
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
