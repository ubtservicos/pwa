-- migration: 12_user_consents_lgpd.sql
-- Tabela de Consentimentos de Usuários (LGPD)

CREATE TABLE IF NOT EXISTS public.user_consents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    document_version text NOT NULL,
    accepted_at timestamp with time zone NOT NULL DEFAULT now(),
    ip_address inet,
    user_agent text,
    CONSTRAINT unique_user_document_version UNIQUE (user_id, document_type, document_version)
);

-- Habilitar RLS
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- 1. Usuário autenticado lê apenas seus próprios registros
CREATE POLICY "Usuarios leem seus proprios consentimentos" ON public.user_consents
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- 2. Usuário autenticado insere apenas seus próprios registros
CREATE POLICY "Usuarios inserem seus proprios consentimentos" ON public.user_consents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger para capturar automaticamente o IP e o User-Agent a partir dos cabeçalhos HTTP do Supabase
CREATE OR REPLACE FUNCTION public.capture_consent_headers()
RETURNS trigger AS $$
DECLARE
    headers_text text;
    headers_json jsonb;
    client_ip text;
    user_agent text;
BEGIN
    headers_text := current_setting('request.headers', true);
    IF headers_text IS NOT NULL AND headers_text <> '' THEN
        headers_json := headers_text::jsonb;
        client_ip := headers_json->>'x-forwarded-for';
        user_agent := headers_json->>'user-agent';
        
        -- Se houver múltiplos IPs proxy (comma-separated), extrai o primeiro da cadeia
        IF client_ip LIKE '%,%' THEN
            client_ip := split_part(client_ip, ',', 1);
        END IF;
        
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            BEGIN
                NEW.ip_address := client_ip::inet;
            EXCEPTION WHEN OTHERS THEN
                -- Previne falha caso o cabeçalho contenha string incompatível com formato inet
                NEW.ip_address := NULL;
            END;
        END IF;
        
        IF user_agent IS NOT NULL AND user_agent <> '' THEN
            NEW.user_agent := user_agent;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_capture_consent_headers
  BEFORE INSERT ON public.user_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_consent_headers();

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_user_consents_user ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_doc_version ON public.user_consents(document_type, document_version);
