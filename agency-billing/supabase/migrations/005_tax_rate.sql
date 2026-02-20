-- Tax rate snapshots: agency default, proposal/invoice store their own
-- Rate stored as decimal (e.g. 0.18 for 18%). Changing agency default does NOT affect existing documents.

-- Agency default tax rate (used when creating new proposals/invoices)
ALTER TABLE agency_settings
ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5, 4) DEFAULT 0;

-- Proposal tax rate snapshot
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) DEFAULT 0;

-- Invoice tax rate snapshot
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) DEFAULT 0;

-- Backfill: ensure existing rows have 0 (or could use 0.18 if previously hardcoded; spec says default 0)
UPDATE agency_settings SET default_tax_rate = 0 WHERE default_tax_rate IS NULL;
UPDATE proposals SET tax_rate = 0 WHERE tax_rate IS NULL;
UPDATE invoices SET tax_rate = 0 WHERE tax_rate IS NULL;
