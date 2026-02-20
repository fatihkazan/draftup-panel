-- Polish: agency currency + separate item title/description
-- Title = short name, description = secondary text (no concatenation)

-- Agency default currency (single source)
ALTER TABLE agency_settings
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Proposal items: description separate from title
ALTER TABLE proposal_items
ADD COLUMN IF NOT EXISTS description TEXT;

-- Invoice items: description separate from title
ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS description TEXT;
