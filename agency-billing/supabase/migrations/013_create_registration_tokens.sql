CREATE TABLE IF NOT EXISTS public.registration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  subscription_plan TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_tokens_email
  ON public.registration_tokens (email);

CREATE INDEX IF NOT EXISTS idx_registration_tokens_expires_at
  ON public.registration_tokens (expires_at);

ALTER TABLE public.registration_tokens ENABLE ROW LEVEL SECURITY;
