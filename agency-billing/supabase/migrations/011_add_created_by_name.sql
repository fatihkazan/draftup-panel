-- Add created_by_name to proposals and invoices
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_name text;
