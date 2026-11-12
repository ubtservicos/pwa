-- Migration: Alter system_logs user_id foreign key to reference auth.users(id)
-- Description: Ensures user_id in system_logs allows NULL and references auth.users(id) on delete set null.

ALTER TABLE public.system_logs DROP CONSTRAINT IF EXISTS system_logs_user_id_fkey;
ALTER TABLE public.system_logs 
  ADD CONSTRAINT system_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
