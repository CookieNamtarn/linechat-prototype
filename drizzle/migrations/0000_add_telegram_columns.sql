ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS telegram_chat_id text;
UPDATE public.conversations SET telegram_chat_id = line_user_id WHERE telegram_chat_id IS NULL;
ALTER TABLE public.conversations ALTER COLUMN line_user_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_telegram_chat_id_key ON public.conversations (telegram_chat_id);

ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS telegram_chat_id text;
UPDATE public.workers SET telegram_chat_id = line_user_id WHERE telegram_chat_id IS NULL;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "app_settings readable" ON public.app_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "app_settings writable" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;