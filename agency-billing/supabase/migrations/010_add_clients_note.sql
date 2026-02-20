-- Add note column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS note text;
