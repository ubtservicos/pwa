-- ==============================================================================
-- MIGRATION: 20261020140000_rls_telemetry_and_unique_constraints.sql
-- Descrição:
--   1. Resolução definitiva dos erros 401 Unauthorized para visitantes anônimos
--      em analytics_events e system_logs (Grants + RLS Policies).
--   2. Blindagem e Unicidade Absoluta de CPF e E-mail em:
--      - public.waitlist (e compatibilidade com waitlist_leads)
--      - public.usuarios
--      - public.kyc_profiles (document_number / CPF)
--   3. Deduplicação inteligente preventiva para suportar bases com dados legados.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: CORREÇÃO DE RLS E PERMISSÕES (ANALYTICS_EVENTS & SYSTEM_LOGS)
-- ==============================================================================

-- 1.1 Garantir que as tabelas de telemetria existam com as colunas completas
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name text NOT NULL,
    event_category text NOT NULL,
    created_at_utc timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    timezone text DEFAULT 'UTC' NOT NULL,
    session_id text NOT NULL,
    device_id text NOT NULL,
    user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    anonymous_id text,
    platform text,
    app_version text,
    origin text,
    vertical text,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.system_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now() NOT NULL,
    severity text NOT NULL CHECK (severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    module text NOT NULL,
    service text,
    operation text,
    status text NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'started', 'timeout')),
    execution_time_ms integer,
    user_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    request_id text NOT NULL,
    correlation_id text NOT NULL,
    error_code text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- 1.2 Conceder permissões de esquema e tabela para os papéis do Supabase (anon, authenticated, service_role)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT INSERT ON TABLE public.analytics_events TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.analytics_events TO authenticated, service_role;

GRANT INSERT ON TABLE public.system_logs TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.system_logs TO authenticated, service_role;

-- 1.3 Habilitar RLS em ambas as tabelas
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 1.4 Políticas RLS para analytics_events
DROP POLICY IF EXISTS "Permitir inserções públicas no analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "Allow public inserts on analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "anon_insert_analytics_events" ON public.analytics_events;
CREATE POLICY "anon_insert_analytics_events"
    ON public.analytics_events
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de analytics restrita a proprietário e admin" ON public.analytics_events;
DROP POLICY IF EXISTS "Allow admin select on analytics_events" ON public.analytics_events;
DROP POLICY IF EXISTS "admin_select_analytics_events" ON public.analytics_events;
CREATE POLICY "admin_select_analytics_events"
    ON public.analytics_events
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id 
        OR (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin', 'operator')
        OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
    );

-- 1.5 Políticas RLS para system_logs
DROP POLICY IF EXISTS "Permitir inserções públicas em system_logs" ON public.system_logs;
DROP POLICY IF EXISTS "anon_insert_system_logs" ON public.system_logs;
CREATE POLICY "anon_insert_system_logs"
    ON public.system_logs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de logs restrita apenas a administradores" ON public.system_logs;
DROP POLICY IF EXISTS "admin_select_system_logs" ON public.system_logs;
CREATE POLICY "admin_select_system_logs"
    ON public.system_logs
    FOR SELECT
    TO authenticated
    USING (
        (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin', 'operator')
        OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
    );


-- ==============================================================================
-- PARTE 2: DEDUPLICAÇÃO E UNICIDADE DE CPF E E-MAIL (WAITLIST / WAITLIST_LEADS)
-- ==============================================================================

-- 2.1 Garantir colunas necessárias na tabela waitlist
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS email text;

-- Limpar strings vazias para NULL para evitar colisões espúrias
UPDATE public.waitlist
   SET cpf = NULL
 WHERE cpf IS NOT NULL AND TRIM(cpf) = '';

UPDATE public.waitlist
   SET email = NULL
 WHERE email IS NOT NULL AND TRIM(email) = '';

-- 2.2 Deduplicação preventiva em public.waitlist por E-MAIL (mantendo o registro mais recente)
DELETE FROM public.waitlist w1
 USING public.waitlist w2
 WHERE w1.id <> w2.id
   AND LOWER(TRIM(w1.email)) = LOWER(TRIM(w2.email))
   AND w1.created_at_utc < w2.created_at_utc;

-- Se houver empates de timestamp, desempate pelo UUID
DELETE FROM public.waitlist w1
 USING public.waitlist w2
 WHERE w1.id <> w2.id
   AND LOWER(TRIM(w1.email)) = LOWER(TRIM(w2.email))
   AND w1.id < w2.id;

-- 2.3 Deduplicação preventiva em public.waitlist por CPF (normalizado apenas dígitos)
DELETE FROM public.waitlist w1
 USING public.waitlist w2
 WHERE w1.id <> w2.id
   AND w1.cpf IS NOT NULL AND w2.cpf IS NOT NULL
   AND REGEXP_REPLACE(w1.cpf, '\D', '', 'g') = REGEXP_REPLACE(w2.cpf, '\D', '', 'g')
   AND REGEXP_REPLACE(w1.cpf, '\D', '', 'g') <> ''
   AND w1.created_at_utc < w2.created_at_utc;

DELETE FROM public.waitlist w1
 USING public.waitlist w2
 WHERE w1.id <> w2.id
   AND w1.cpf IS NOT NULL AND w2.cpf IS NOT NULL
   AND REGEXP_REPLACE(w1.cpf, '\D', '', 'g') = REGEXP_REPLACE(w2.cpf, '\D', '', 'g')
   AND REGEXP_REPLACE(w1.cpf, '\D', '', 'g') <> ''
   AND w1.id < w2.id;

-- 2.4 Criação de Índices UNIQUE para public.waitlist
DROP INDEX IF EXISTS public.idx_waitlist_email_unique;
CREATE UNIQUE INDEX idx_waitlist_email_unique
    ON public.waitlist (LOWER(TRIM(email)))
 WHERE email IS NOT NULL AND TRIM(email) <> '';

DROP INDEX IF EXISTS public.idx_waitlist_cpf_unique;
CREATE UNIQUE INDEX idx_waitlist_cpf_unique
    ON public.waitlist (REGEXP_REPLACE(cpf, '\D', '', 'g'))
 WHERE cpf IS NOT NULL AND REGEXP_REPLACE(cpf, '\D', '', 'g') <> '';

-- 2.5 Tratamento caso a tabela física se chame 'waitlist_leads'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' 
           AND table_name = 'waitlist_leads'
           AND table_type = 'BASE TABLE'
    ) THEN
        -- Adicionar colunas se faltarem
        ALTER TABLE public.waitlist_leads ADD COLUMN IF NOT EXISTS cpf text;
        ALTER TABLE public.waitlist_leads ADD COLUMN IF NOT EXISTS email text;

        UPDATE public.waitlist_leads SET cpf = NULL WHERE cpf IS NOT NULL AND TRIM(cpf) = '';
        UPDATE public.waitlist_leads SET email = NULL WHERE email IS NOT NULL AND TRIM(email) = '';

        -- Deduplicar waitlist_leads
        DELETE FROM public.waitlist_leads l1
         USING public.waitlist_leads l2
         WHERE l1.id <> l2.id
           AND LOWER(TRIM(l1.email)) = LOWER(TRIM(l2.email))
           AND l1.id < l2.id;

        DELETE FROM public.waitlist_leads l1
         USING public.waitlist_leads l2
         WHERE l1.id <> l2.id
           AND l1.cpf IS NOT NULL AND l2.cpf IS NOT NULL
           AND REGEXP_REPLACE(l1.cpf, '\D', '', 'g') = REGEXP_REPLACE(l2.cpf, '\D', '', 'g')
           AND REGEXP_REPLACE(l1.cpf, '\D', '', 'g') <> ''
           AND l1.id < l2.id;

        DROP INDEX IF EXISTS public.idx_waitlist_leads_email_unique;
        CREATE UNIQUE INDEX idx_waitlist_leads_email_unique
            ON public.waitlist_leads (LOWER(TRIM(email)))
         WHERE email IS NOT NULL AND TRIM(email) <> '';

        DROP INDEX IF EXISTS public.idx_waitlist_leads_cpf_unique;
        CREATE UNIQUE INDEX idx_waitlist_leads_cpf_unique
            ON public.waitlist_leads (REGEXP_REPLACE(cpf, '\D', '', 'g'))
         WHERE cpf IS NOT NULL AND REGEXP_REPLACE(cpf, '\D', '', 'g') <> '';
    ELSE
        -- Se não for tabela física, criar View para compatibilidade universal
        CREATE OR REPLACE VIEW public.waitlist_leads AS 
        SELECT * FROM public.waitlist;
    END IF;
END $$;


-- ==============================================================================
-- PARTE 3: DEDUPLICAÇÃO E UNICIDADE DE CPF E E-MAIL (USUARIOS)
-- ==============================================================================

-- 3.1 Garantir colunas necessárias na tabela usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cpf text;

-- Sincronizar e-mail de auth.users caso esteja nulo em usuarios
UPDATE public.usuarios u
   SET email = LOWER(TRIM(a.email))
  FROM auth.users a
 WHERE u.id = a.id
   AND (u.email IS NULL OR TRIM(u.email) = '');

-- Limpar strings vazias
UPDATE public.usuarios SET cpf = NULL WHERE cpf IS NOT NULL AND TRIM(cpf) = '';
UPDATE public.usuarios SET email = NULL WHERE email IS NOT NULL AND TRIM(email) = '';

-- 3.2 Deduplicação preventiva em public.usuarios por E-MAIL (mantendo o registro com role mais relevante ou id mais recente)
DELETE FROM public.usuarios u1
 USING public.usuarios u2
 WHERE u1.id <> u2.id
   AND u1.email IS NOT NULL AND u2.email IS NOT NULL
   AND LOWER(TRIM(u1.email)) = LOWER(TRIM(u2.email))
   AND u1.created_at < u2.created_at;

DELETE FROM public.usuarios u1
 USING public.usuarios u2
 WHERE u1.id <> u2.id
   AND u1.email IS NOT NULL AND u2.email IS NOT NULL
   AND LOWER(TRIM(u1.email)) = LOWER(TRIM(u2.email))
   AND u1.id < u2.id;

-- 3.3 Deduplicação preventiva em public.usuarios por CPF
DELETE FROM public.usuarios u1
 USING public.usuarios u2
 WHERE u1.id <> u2.id
   AND u1.cpf IS NOT NULL AND u2.cpf IS NOT NULL
   AND REGEXP_REPLACE(u1.cpf, '\D', '', 'g') = REGEXP_REPLACE(u2.cpf, '\D', '', 'g')
   AND REGEXP_REPLACE(u1.cpf, '\D', '', 'g') <> ''
   AND u1.created_at < u2.created_at;

DELETE FROM public.usuarios u1
 USING public.usuarios u2
 WHERE u1.id <> u2.id
   AND u1.cpf IS NOT NULL AND u2.cpf IS NOT NULL
   AND REGEXP_REPLACE(u1.cpf, '\D', '', 'g') = REGEXP_REPLACE(u2.cpf, '\D', '', 'g')
   AND REGEXP_REPLACE(u1.cpf, '\D', '', 'g') <> ''
   AND u1.id < u2.id;

-- 3.4 Criação de Índices UNIQUE para public.usuarios
DROP INDEX IF EXISTS public.idx_usuarios_email_unique;
CREATE UNIQUE INDEX idx_usuarios_email_unique
    ON public.usuarios (LOWER(TRIM(email)))
 WHERE email IS NOT NULL AND TRIM(email) <> '';

DROP INDEX IF EXISTS public.idx_usuarios_cpf_unique;
CREATE UNIQUE INDEX idx_usuarios_cpf_unique
    ON public.usuarios (REGEXP_REPLACE(cpf, '\D', '', 'g'))
 WHERE cpf IS NOT NULL AND REGEXP_REPLACE(cpf, '\D', '', 'g') <> '';


-- ==============================================================================
-- PARTE 4: TABELA KYC_PROFILES E UNICIDADE DO CPF / DOCUMENT_NUMBER
-- ==============================================================================

-- 4.1 Garantir a criação da tabela kyc_profiles caso ainda não exista
CREATE TABLE IF NOT EXISTS public.kyc_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
    document_number text,
    document_type text NOT NULL DEFAULT 'CPF',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS em kyc_profiles
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.kyc_profiles TO authenticated, service_role;

DROP POLICY IF EXISTS "kyc_profiles_owner_access" ON public.kyc_profiles;
CREATE POLICY "kyc_profiles_owner_access"
    ON public.kyc_profiles
    FOR ALL
    TO authenticated
    USING (
        auth.uid() = user_id
        OR (SELECT role FROM public.usuarios WHERE id = auth.uid()) IN ('super_admin', 'admin', 'operator')
        OR (auth.jwt() ->> 'email') = 'ubt.servicos@gmail.com'
    );

-- 4.2 Limpar strings vazias
UPDATE public.kyc_profiles
   SET document_number = NULL
 WHERE document_number IS NOT NULL AND TRIM(document_number) = '';

-- 4.3 Deduplicação preventiva em public.kyc_profiles por document_number (CPF)
DELETE FROM public.kyc_profiles k1
 USING public.kyc_profiles k2
 WHERE k1.id <> k2.id
   AND k1.document_number IS NOT NULL AND k2.document_number IS NOT NULL
   AND REGEXP_REPLACE(k1.document_number, '\D', '', 'g') = REGEXP_REPLACE(k2.document_number, '\D', '', 'g')
   AND REGEXP_REPLACE(k1.document_number, '\D', '', 'g') <> ''
   AND k1.created_at < k2.created_at;

DELETE FROM public.kyc_profiles k1
 USING public.kyc_profiles k2
 WHERE k1.id <> k2.id
   AND k1.document_number IS NOT NULL AND k2.document_number IS NOT NULL
   AND REGEXP_REPLACE(k1.document_number, '\D', '', 'g') = REGEXP_REPLACE(k2.document_number, '\D', '', 'g')
   AND REGEXP_REPLACE(k1.document_number, '\D', '', 'g') <> ''
   AND k1.id < k2.id;

-- 4.4 Criação de Índice UNIQUE para public.kyc_profiles (document_number normalizado)
DROP INDEX IF EXISTS public.idx_kyc_profiles_doc_unique;
CREATE UNIQUE INDEX idx_kyc_profiles_doc_unique
    ON public.kyc_profiles (REGEXP_REPLACE(document_number, '\D', '', 'g'))
 WHERE document_number IS NOT NULL AND REGEXP_REPLACE(document_number, '\D', '', 'g') <> '';

-- 4.5 Blindagem adicional nas tabelas satélites de perfil prestador se existirem
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        UPDATE public.profiles SET cpf = NULL WHERE cpf IS NOT NULL AND TRIM(cpf) = '';
        DROP INDEX IF EXISTS public.idx_profiles_cpf_unique;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf_unique
            ON public.profiles (REGEXP_REPLACE(cpf, '\D', '', 'g'))
         WHERE cpf IS NOT NULL AND REGEXP_REPLACE(cpf, '\D', '', 'g') <> '';
    END IF;
END $$;

-- ==============================================================================
-- FINALIZAÇÃO E NOTIFICAÇÃO DO POSTGREST
-- ==============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
