-- migration: 37_user_onboarding_schema.sql
-- UBT SuperApp — User Onboarding & Waitlist Approval Automation

-- 1. Create user_onboarding table
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id uuid UNIQUE REFERENCES public.waitlist(id) ON DELETE SET NULL,
  user_id uuid UNIQUE REFERENCES public.usuarios(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'WAITLIST_APPROVED' CHECK (status IN (
    'WAITLIST_APPROVED',
    'REGISTRATION_NOT_STARTED',
    'REGISTRATION_IN_PROGRESS',
    'REGISTRATION_COMPLETED',
    'KYC_PENDING',
    'KYC_APPROVED',
    'KYC_REJECTED',
    'ACTIVE'
  )),
  approved_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  approved_at timestamptz DEFAULT now(),
  communication_status text NOT NULL DEFAULT 'pending' CHECK (communication_status IN ('pending', 'sent', 'failed')),
  communication_error text,
  onboarding_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Indexes for onboarding table
CREATE INDEX IF NOT EXISTS idx_user_onboarding_waitlist ON public.user_onboarding(waitlist_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user ON public.user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_status ON public.user_onboarding(status);

-- 3. Enable RLS
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Enable read access for authenticated on user_onboarding" ON public.user_onboarding;
CREATE POLICY "Enable read access for authenticated on user_onboarding"
  ON public.user_onboarding FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin', 'marketing')
    OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );

DROP POLICY IF EXISTS "Enable write access for admins on user_onboarding" ON public.user_onboarding;
CREATE POLICY "Enable write access for admins on user_onboarding"
  ON public.user_onboarding FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin')
    OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
  );

-- 5. Stored Procedure RPC to Approve Waitlist Leads
CREATE OR REPLACE FUNCTION approve_waitlist_leads(
  p_lead_ids uuid[],
  p_admin_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  telefone text,
  onboarding_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id uuid;
  v_real_admin_id uuid := COALESCE(p_admin_id, auth.uid());
  v_lead_record RECORD;
  v_onboarding_url text;
BEGIN
  -- Verify requester is admin or superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE id = v_real_admin_id AND role IN ('super_admin', 'admin')
  ) AND (auth.jwt() ->> 'email') != 'ubt.servicos@gmail.com' THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem aprovar a waitlist.';
  END IF;

  -- Create temporary table to hold results
  CREATE TEMP TABLE temp_approved_leads (
    id uuid,
    nome text,
    email text,
    telefone text,
    onboarding_url text
  ) ON COMMIT DROP;

  -- Iterate through lead IDs
  FOREACH v_lead_id IN ARRAY p_lead_ids
  LOOP
    -- 1. Fetch lead info
    SELECT * INTO v_lead_record FROM public.waitlist WHERE waitlist.id = v_lead_id;
    
    IF FOUND AND v_lead_record.status != 'approved' AND v_lead_record.status != 'WAITLIST_APPROVED' THEN
      
      -- 2. Update status in waitlist table
      UPDATE public.waitlist
      SET status = 'approved'
      WHERE waitlist.id = v_lead_id;

      -- 3. Define token-based onboarding URL
      v_onboarding_url := 'https://ubtsuperapp.com.br/onboarding?token=' || v_lead_id::text;

      -- 4. Upsert user_onboarding row
      INSERT INTO public.user_onboarding (waitlist_id, status, approved_by, approved_at, onboarding_url)
      VALUES (v_lead_id, 'WAITLIST_APPROVED', v_real_admin_id, NOW(), v_onboarding_url)
      ON CONFLICT (waitlist_id) DO UPDATE
      SET status = 'WAITLIST_APPROVED',
          approved_by = v_real_admin_id,
          approved_at = NOW(),
          onboarding_url = v_onboarding_url;

      -- 5. Insert into temp table for return
      INSERT INTO temp_approved_leads (id, nome, email, telefone, onboarding_url)
      VALUES (v_lead_record.id, v_lead_record.nome, v_lead_record.email, v_lead_record.telefone, v_onboarding_url);

      -- 6. Log admin audit event
      PERFORM log_admin_action(
        p_admin_id => v_real_admin_id,
        p_acao => 'waitlist_lead_approved',
        p_categoria => 'Waitlist',
        p_modulo => 'Onboarding Manager',
        p_entidade => 'waitlist',
        p_registro_id => v_lead_id::text,
        p_valor_anterior => jsonb_build_object('status', v_lead_record.status),
        p_valor_novo => jsonb_build_object('status', 'approved', 'onboarding_url', v_onboarding_url),
        p_motivo => p_motivo,
        p_criticidade => 'MEDIA',
        p_metadata => jsonb_build_object('nome', v_lead_record.nome, 'email', v_lead_record.email)
      );

    END IF;
  END LOOP;

  RETURN QUERY SELECT * FROM temp_approved_leads;
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION approve_waitlist_leads(uuid[], uuid, text) TO authenticated, service_role;

-- Notify cache reload
NOTIFY pgrst, 'reload schema';
