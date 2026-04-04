ALTER TABLE public.studios DROP CONSTRAINT IF EXISTS studios_subscription_status_check;

ALTER TABLE public.studios ADD CONSTRAINT studios_subscription_status_check CHECK (subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive', 'pending_approval', 'rejected'));
