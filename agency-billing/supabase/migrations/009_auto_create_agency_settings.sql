-- Auto-create agency_settings when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.agency_settings (
    id,
    user_id,
    subscription_plan,
    billing_cycle,
    subscription_status,
    invoice_counter,
    currency,
    default_tax_rate
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    'freelancer',
    'monthly',
    'inactive',
    0,
    'USD',
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
