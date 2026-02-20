-- Invoice PDF Lifecycle Migration
-- This migration adds the required fields for the PDF lifecycle system

-- Add pdf_url column to store the generated PDF URL
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT NULL;

-- Add sent_at column to track when invoice was finalized
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NULL;

-- Add user_id column if it doesn't exist (needed for agency_settings lookup)
-- This may already exist in your schema
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_pdf_url ON invoices(pdf_url) WHERE pdf_url IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN invoices.pdf_url IS 'URL to the generated PDF stored in Supabase Storage';
COMMENT ON COLUMN invoices.sent_at IS 'Timestamp when the invoice was finalized (marked as sent)';

-- Ensure public_token exists and is unique
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();

-- Make public_token unique if not already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'invoices_public_token_key'
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_public_token_key UNIQUE (public_token);
    END IF;
END $$;

-- Create index on public_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token);
