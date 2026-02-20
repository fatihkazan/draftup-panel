-- Subscription plan per agency. Single source of truth for limits is in app (lib/subscription-plans.ts).
-- This column stores which plan the agency is on; enforcement is in backend.

ALTER TABLE agency_settings
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'freelancer';

COMMENT ON COLUMN agency_settings.subscription_plan IS 'Plan key: freelancer, starter, growth, scale. Limits enforced in app.';
