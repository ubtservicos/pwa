-- ==============================================================================
-- MIGRATION: 20261028173000_add_bairros_hospedagem_and_usuarios_sync_trigger.sql
-- Descrição:
--   1. Garante coluna bairros_hospedagem (text[]) na waitlist.
--   2. Garante colunas telefone, metadata, role e updated_at em usuarios.
--   3. Saneia duplicatas de telefone na waitlist e cria índice único para upsert.
--   4. Cria trigger SECURITY DEFINER sync_waitlist_to_usuarios para sincronizar
--      cadastros completos em usuarios automaticamente, eliminando 401 Unauthorized.
-- ==============================================================================

BEGIN;

-- 1. Garante todas as colunas de localização e suporte na waitlist
ALTER TABLE public.waitlist 
  ADD COLUMN IF NOT EXISTS bairros_hospedagem text[],
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'morador';

-- 2. Garante colunas necessárias na tabela usuarios
ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'morador',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Saneamento de duplicatas por telefone na waitlist antes de criar índice único
DELETE FROM public.waitlist
WHERE ctid NOT IN (
  SELECT max(ctid)
  FROM public.waitlist
  WHERE telefone IS NOT NULL AND trim(telefone) != ''
  GROUP BY telefone
)
AND telefone IS NOT NULL AND trim(telefone) != '';

-- 4. Cria índice único de telefone na waitlist para viabilizar upsert ON CONFLICT (telefone)
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_telefone_unique_idx 
  ON public.waitlist (telefone) 
  WHERE telefone IS NOT NULL AND telefone != '';

-- 5. Cria índice único de telefone em usuarios para viabilizar ON CONFLICT (telefone)
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_telefone_unique_idx 
  ON public.usuarios (telefone) 
  WHERE telefone IS NOT NULL AND telefone != '';

-- 6. Trigger SECURITY DEFINER para sincronizar waitlist -> usuarios
CREATE OR REPLACE FUNCTION public.sync_waitlist_to_usuarios()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_role text := COALESCE(
    NEW.role, 
    CASE WHEN NEW.perfil IS NOT NULL AND array_length(NEW.perfil, 1) > 0 THEN NEW.perfil[1] ELSE 'morador' END,
    'morador'
  );
BEGIN
  IF NEW.cadastro_completo = true THEN
    INSERT INTO public.usuarios (id, nome, email, telefone, role, status, metadata)
    VALUES (
      COALESCE(NEW.user_id, gen_random_uuid()),
      NEW.nome,
      NEW.email,
      NEW.telefone,
      v_role,
      'ativo',
      jsonb_build_object('origem', 'waitlist_founder')
    )
    ON CONFLICT (telefone) DO UPDATE
    SET 
      nome = EXCLUDED.nome,
      email = EXCLUDED.email,
      status = 'ativo',
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_waitlist_usuarios ON public.waitlist;
CREATE TRIGGER trg_sync_waitlist_usuarios
AFTER INSERT OR UPDATE ON public.waitlist
FOR EACH ROW
EXECUTE FUNCTION public.sync_waitlist_to_usuarios();

COMMIT;

-- 7. Recarrega o schema cache do PostgREST imediatamente
NOTIFY pgrst, 'reload config';
