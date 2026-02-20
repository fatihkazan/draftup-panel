-- Atomic invoice counter increment for agency_settings.
-- Ensures concurrency-safe increment and returns the new value.

ALTER TABLE agency_settings
ADD COLUMN IF NOT EXISTS invoice_counter INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN agency_settings.invoice_counter IS 'Monotonically incremented per new invoice; use increment_agency_invoice_counter() for atomic increment.';

CREATE OR REPLACE FUNCTION increment_agency_invoice_counter(p_agency_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_counter INTEGER;
BEGIN
  UPDATE agency_settings
  SET invoice_counter = COALESCE(invoice_counter, 0) + 1
  WHERE id = p_agency_id
  RETURNING invoice_counter INTO new_counter;

  IF new_counter IS NULL THEN
    RAISE EXCEPTION 'agency_settings row not found for id %', p_agency_id;
  END IF;

  RETURN new_counter;
END;
$$;

COMMENT ON FUNCTION increment_agency_invoice_counter(UUID) IS 'Atomically increments agency_settings.invoice_counter for the given agency and returns the new value.';
