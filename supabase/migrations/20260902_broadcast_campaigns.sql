-- Migration: Broadcast Campaigns & Scheduled Messages for SuperAdmin Messaging Panel
-- Target Environment: Homolog / Dev (xqujubbqcfqxkfczbidq)

CREATE TABLE IF NOT EXISTS public.broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'omnichannel', -- 'omnichannel' (default), 'whatsapp', 'push', 'sms', 'in_app'
    target_type TEXT NOT NULL DEFAULT 'broadcast', -- 'broadcast', 'niche', 'individual'
    niche TEXT, -- 'motoboy', 'diarista', 'tomadores', 'moradores', 'turistas', 'ambulantes'
    individual_recipient TEXT,
    message_template TEXT NOT NULL,
    scheduled_type TEXT NOT NULL DEFAULT 'now', -- 'now', 'scheduled'
    scheduled_for TIMESTAMP WITH TIME ZONE,
    recurrence TEXT NOT NULL DEFAULT 'none', -- 'none', 'daily', 'weekly', 'monthly'
    status TEXT NOT NULL DEFAULT 'concluido', -- 'agendado', 'em_andamento', 'concluido', 'falhou'
    sent_count INTEGER DEFAULT 0,
    total_targeted INTEGER DEFAULT 0,
    author_id UUID,
    author_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexing for quick querying in SuperAdmin table
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_created_at ON public.broadcast_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status ON public.broadcast_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_channel ON public.broadcast_campaigns(channel);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_niche ON public.broadcast_campaigns(niche);

-- RLS Configuration
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

-- Allow super_admin and admin full management
DROP POLICY IF EXISTS "Allow superadmin and admin full access to broadcast_campaigns" ON public.broadcast_campaigns;
CREATE POLICY "Allow superadmin and admin full access to broadcast_campaigns"
    ON public.broadcast_campaigns
    FOR ALL
    USING (
        auth.role() = 'authenticated'
    )
    WITH CHECK (
        auth.role() = 'authenticated'
    );
