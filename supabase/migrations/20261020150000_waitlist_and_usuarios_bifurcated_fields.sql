-- ==============================================================================
-- MIGRATION: 20261020150000_waitlist_and_usuarios_bifurcated_fields.sql
-- Descrição:
--   Suporte aos novos campos do fluxo bifurcado de Cadastro de Fundadores (PF vs PJ)
--   nas tabelas public.waitlist e public.usuarios, com saneamento automático de
--   registros duplicados de testes anteriores, índices de unicidade e políticas RLS.
-- ==============================================================================

BEGIN;

-- 1. Campos para a tabela public.waitlist
ALTER TABLE public.waitlist
    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo_pessoa text DEFAULT 'PF',
    ADD COLUMN IF NOT EXISTS cnpj text,
    ADD COLUMN IF NOT EXISTS razao_social text,
    ADD COLUMN IF NOT EXISTS responsavel_legal text,
    ADD COLUMN IF NOT EXISTS cpf_responsavel text,
    ADD COLUMN IF NOT EXISTS regiao_atuacao text,
    ADD COLUMN IF NOT EXISTS bairro_hospedagem text;

-- 2. Campos para a tabela public.usuarios
ALTER TABLE public.usuarios
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS tipo_pessoa text DEFAULT 'PF',
    ADD COLUMN IF NOT EXISTS cnpj text,
    ADD COLUMN IF NOT EXISTS responsavel_legal text,
    ADD COLUMN IF NOT EXISTS cpf_responsavel text,
    ADD COLUMN IF NOT EXISTS regiao_atuacao text;

-- 3. Saneamento: Limpeza de registros duplicados de testes anteriores
-- (Mantém apenas o registro mais recente para cada e-mail, CPF e CNPJ antes de criar os índices de unicidade)

-- 3.1 Remover eventuais referências em user_onboarding para os registros duplicados que serão eliminados
DO $$
BEGIN
    DELETE FROM public.user_onboarding
    WHERE waitlist_id IN (
        SELECT id FROM public.waitlist
        WHERE ctid NOT IN (
            SELECT max(ctid)
            FROM public.waitlist
            WHERE email IS NOT NULL AND email != ''
            GROUP BY lower(email)
        )
        AND email IS NOT NULL AND email != ''
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 3.2 Deduplicação por E-mail (mantém a linha mais recente por ctid)
DELETE FROM public.waitlist
WHERE ctid NOT IN (
    SELECT max(ctid)
    FROM public.waitlist
    WHERE email IS NOT NULL AND email != ''
    GROUP BY lower(email)
)
AND email IS NOT NULL AND email != '';

-- 3.3 Deduplicação por CPF (mantém a linha mais recente por ctid)
DELETE FROM public.waitlist
WHERE ctid NOT IN (
    SELECT max(ctid)
    FROM public.waitlist
    WHERE cpf IS NOT NULL AND cpf != ''
    GROUP BY regexp_replace(cpf, '\D', '', 'g')
)
AND cpf IS NOT NULL AND cpf != '';

-- 3.4 Deduplicação por CNPJ (mantém a linha mais recente por ctid)
DELETE FROM public.waitlist
WHERE ctid NOT IN (
    SELECT max(ctid)
    FROM public.waitlist
    WHERE cnpj IS NOT NULL AND cnpj != ''
    GROUP BY regexp_replace(cnpj, '\D', '', 'g')
)
AND cnpj IS NOT NULL AND cnpj != '';

-- 4. Criação dos Índices de Unicidade na Waitlist
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx 
    ON public.waitlist (lower(email)) 
    WHERE email IS NOT NULL AND email != '';

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_cpf_unique_idx 
    ON public.waitlist (cpf) 
    WHERE cpf IS NOT NULL AND cpf != '';

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_cnpj_unique_idx 
    ON public.waitlist (cnpj) 
    WHERE cnpj IS NOT NULL AND cnpj != '';

-- 5. Garantia de Permissões RLS para inserções públicas e anônimas
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'waitlist' AND policyname = 'Allow anonymous and authenticated insert to waitlist'
    ) THEN
        CREATE POLICY "Allow anonymous and authenticated insert to waitlist"
            ON public.waitlist
            FOR INSERT
            TO anon, authenticated
            WITH CHECK (true);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
