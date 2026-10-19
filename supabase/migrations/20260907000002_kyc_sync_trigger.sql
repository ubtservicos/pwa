-- Migration: Sync prestador_mototaxi KYC lifecycle with usuarios and profiles

CREATE OR REPLACE FUNCTION public.sync_mototaxi_kyc_status()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- If mototaxi profile is deleted, reset under_review in usuarios
    UPDATE public.usuarios
    SET under_review = false
    WHERE id = OLD.user_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.kyc_status = 'pending' THEN
      UPDATE public.usuarios
      SET under_review = true
      WHERE id = NEW.user_id;
    ELSIF NEW.kyc_status = 'approved' THEN
      UPDATE public.usuarios
      SET role = 'prestador', status = 'active', under_review = false
      WHERE id = NEW.user_id;
      UPDATE public.profiles
      SET role = 'prestador', is_active = true
      WHERE id = NEW.user_id;
    ELSIF NEW.kyc_status = 'rejected' THEN
      UPDATE public.usuarios
      SET under_review = false
      WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_mototaxi_kyc ON public.prestador_mototaxi;
CREATE TRIGGER trg_sync_mototaxi_kyc
AFTER INSERT OR UPDATE OR DELETE ON public.prestador_mototaxi
FOR EACH ROW EXECUTE FUNCTION public.sync_mototaxi_kyc_status();
