-- Payments table: manual payment tracking against invoices
-- Currency inherited from invoice. No status column. Payment status derived from sum of payments.

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  method TEXT DEFAULT 'other' CHECK (method IN ('cash', 'bank_transfer', 'card', 'other')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);

COMMENT ON TABLE payments IS 'Manual payment records against invoices. paid_amount = sum(amount), balance_due = invoice.total - paid_amount.';

-- RLS: enable and add policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow reading payments for invoices that have a public_token (public invoice view)
CREATE POLICY "payments_select_public_invoices" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id AND i.public_token IS NOT NULL
    )
  );

-- Allow agency users to manage payments for their invoices
CREATE POLICY "payments_agency_all" ON payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN agency_settings a ON a.id = i.agency_id
      WHERE i.id = payments.invoice_id
      AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN agency_settings a ON a.id = i.agency_id
      WHERE i.id = payments.invoice_id
      AND a.user_id = auth.uid()
    )
  );
