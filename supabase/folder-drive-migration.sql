BEGIN;

ALTER TABLE content DROP CONSTRAINT IF EXISTS content_kind_check;
ALTER TABLE content
  ADD CONSTRAINT content_kind_check
  CHECK (kind IN ('subject', 'folder', 'chapter', 'topic', 'video'));

-- Preserve all existing learning paths while changing their presentation.
-- Former modules and module sections become ordinary folders.
UPDATE content SET kind = 'folder' WHERE kind IN ('chapter', 'topic');

ALTER TABLE content DROP CONSTRAINT IF EXISTS content_kind_check;
ALTER TABLE content
  ADD CONSTRAINT content_kind_check
  CHECK (kind IN ('subject', 'folder', 'video'));

CREATE INDEX IF NOT EXISTS idx_content_parent_kind
  ON content(parent_id, kind, status);

COMMIT;
