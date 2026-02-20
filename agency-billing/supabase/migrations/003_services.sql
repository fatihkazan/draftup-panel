-- Services table: agency price templates
-- Services are templates only; proposal and invoice items store their own snapshots.

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agency_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_unit_price NUMERIC(12, 2) NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('hours', 'days', 'project', 'item')),
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_agency_id ON services(agency_id);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(agency_id, is_active);

COMMENT ON TABLE services IS 'Agency price templates. Items in proposals/invoices store their own snapshots.';
