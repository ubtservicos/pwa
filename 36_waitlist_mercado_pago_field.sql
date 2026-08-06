-- migration: 36_waitlist_mercado_pago_field.sql
-- UBT SuperApp — Adiciona campo possui_conta_mercado_pago à Waitlist

-- NOTA: Esta migration foi PREPARADA mas não aplicada automaticamente ao banco de dados em conformidade com o diagnóstico de prontidão UBT-PAY-002A.

ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS possui_conta_mercado_pago boolean DEFAULT NULL;

-- Recarregar cache do PostgREST
NOTIFY pgrst, 'reload schema';
