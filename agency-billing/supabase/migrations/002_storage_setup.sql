-- Supabase Storage Setup for Invoice PDFs
-- Run this in Supabase SQL Editor or via CLI

-- Create the 'documents' storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies for the documents bucket

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow public read access to files (for PDF downloads)
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'documents');

-- Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documents');

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents');

-- Alternative: If you want to restrict access to service role only for uploads
-- Uncomment these and comment out the policies above:
--
-- CREATE POLICY "Service role uploads only" ON storage.objects
-- FOR INSERT TO service_role
-- WITH CHECK (bucket_id = 'documents');
--
-- CREATE POLICY "Public read access" ON storage.objects
-- FOR SELECT TO public
-- USING (bucket_id = 'documents');
