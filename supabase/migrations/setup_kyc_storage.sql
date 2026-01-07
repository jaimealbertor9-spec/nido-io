-- ═══════════════════════════════════════════════════════════════════════════
-- SUPABASE STORAGE: kyc-documents Bucket Setup
-- Run this in Supabase SQL Editor to create/configure the bucket
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Step 2: Drop existing policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can upload KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own KYC documents" ON storage.objects;

-- Step 3: Allow authenticated users to INSERT (upload) files to their own folder
CREATE POLICY "Authenticated users can upload KYC documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 4: Allow users to SELECT (view/download) their own files
CREATE POLICY "Users can view their own KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 5: Allow users to DELETE their own files
CREATE POLICY "Users can delete their own KYC documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 6: Allow service_role full access (for admin operations)
CREATE POLICY "Service role has full access to KYC documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'kyc-documents')
WITH CHECK (bucket_id = 'kyc-documents');

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY user_verifications TABLE RLS POLICIES
-- Make sure authenticated users can insert records
-- ═══════════════════════════════════════════════════════════════════════════

-- Check if RLS is enabled
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own verifications" ON public.user_verifications;
DROP POLICY IF EXISTS "Users can view their own verifications" ON public.user_verifications;

-- Allow authenticated users to INSERT their own verification records
CREATE POLICY "Users can insert their own verifications"
ON public.user_verifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to SELECT their own verification records
CREATE POLICY "Users can view their own verifications"
ON public.user_verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow service_role full access
CREATE POLICY "Service role has full access to verifications"
ON public.user_verifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
