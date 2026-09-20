BEGIN;
CREATE TABLE IF NOT EXISTS public.content_assets (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  upload_id TEXT NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('video','file')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(content_id,upload_id)
);
CREATE INDEX IF NOT EXISTS idx_content_assets_content ON public.content_assets(content_id,asset_type,sort_order);
ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_assets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_assets TO english_tech_server;
DROP POLICY IF EXISTS server_access ON public.content_assets;
CREATE POLICY server_access ON public.content_assets FOR ALL TO english_tech_server USING (true) WITH CHECK (true);
COMMIT;
