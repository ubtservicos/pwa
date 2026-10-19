-- Migration: 20260907_kyc_storage_and_mototaxi_docs.sql
-- Add document URL columns to prestador_mototaxi and setup kyc-documents storage bucket

-- 1. Add document URL columns to prestador_mototaxi
ALTER TABLE public.prestador_mototaxi
ADD COLUMN IF NOT EXISTS crlv_url text,
ADD COLUMN IF NOT EXISTS moto_photo_url text,
ADD COLUMN IF NOT EXISTS selfie_url text,
ADD COLUMN IF NOT EXISTS cnh_frente_url text,
ADD COLUMN IF NOT EXISTS cnh_verso_url text;

-- 2. Ensure storage bucket for kyc-documents exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];

-- 3. Storage Policies for kyc-documents
-- Allow any authenticated user to upload to kyc-documents
DROP POLICY IF EXISTS "Authenticated users can upload kyc documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload kyc documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'kyc-documents');

-- Allow users and admins to read kyc documents
DROP POLICY IF EXISTS "Public and authenticated can read kyc documents" ON storage.objects;
CREATE POLICY "Public and authenticated can read kyc documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'kyc-documents');

-- Allow authenticated users to update/delete their own kyc documents
DROP POLICY IF EXISTS "Users can update own kyc documents" ON storage.objects;
CREATE POLICY "Users can update own kyc documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'kyc-documents');

NOTIFY pgrst, 'reload schema';
