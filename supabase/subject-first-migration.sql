-- English Tech subject-first migration
-- Final hierarchy: Subject -> Chapter -> Topic -> Video
BEGIN;

-- Keep existing English/UHV subjects when present and create either one if missing.
INSERT INTO content (
  id, kind, parent_id, name, description, thumbnail, status, public,
  duration, tags, notes, storage_key, caption_key, resource_key,
  publish_at, created_at, updated_at
)
SELECT
  gen_random_uuid()::text, 'subject', NULL, 'English',
  'Build communication, language, and confidence.', 'english',
  'published', 1, 0, '[]', '', '', '', '', NULL,
  (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
  (extract(epoch FROM clock_timestamp()) * 1000)::bigint
WHERE NOT EXISTS (
  SELECT 1 FROM content WHERE kind = 'subject' AND lower(trim(name)) = 'english'
);

INSERT INTO content (
  id, kind, parent_id, name, description, thumbnail, status, public,
  duration, tags, notes, storage_key, caption_key, resource_key,
  publish_at, created_at, updated_at
)
SELECT
  gen_random_uuid()::text, 'subject', NULL, 'UHV (Universal Human Values)',
  'Learn with purpose, respect, and responsibility.', 'biology',
  'published', 1, 0, '[]', '', '', '', '', NULL,
  (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
  (extract(epoch FROM clock_timestamp()) * 1000)::bigint
WHERE NOT EXISTS (
  SELECT 1 FROM content
  WHERE kind = 'subject'
    AND lower(regexp_replace(name, '[^a-zA-Z]', '', 'g')) IN
      ('uhv', 'uhvuniversalhumanvalues', 'universalhumanvalues')
);

UPDATE content
SET name = 'English', thumbnail = 'english', public = 1,
    updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::bigint
WHERE kind = 'subject' AND lower(trim(name)) = 'english';

UPDATE content
SET name = 'UHV (Universal Human Values)', public = 1,
    updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::bigint
WHERE kind = 'subject'
  AND lower(regexp_replace(name, '[^a-zA-Z]', '', 'g')) IN
    ('uhv', 'uhvuniversalhumanvalues', 'universalhumanvalues');

-- Preserve the newest direct access decision that was attached to each course.
INSERT INTO access_grants (id, user_id, group_id, content_id, status, created_at)
SELECT gen_random_uuid()::text, user_id, NULL, subject_id, status, created_at
FROM (
  SELECT DISTINCT ON (g.user_id, c.parent_id)
    g.user_id, c.parent_id AS subject_id, g.status, g.created_at
  FROM access_grants g
  JOIN content c ON c.id = g.content_id AND c.kind = 'course'
  JOIN content s ON s.id = c.parent_id AND s.kind = 'subject'
  WHERE g.user_id IS NOT NULL
    AND (
      lower(trim(s.name)) = 'english' OR
      lower(regexp_replace(s.name, '[^a-zA-Z]', '', 'g')) IN
        ('uhv', 'uhvuniversalhumanvalues', 'universalhumanvalues')
    )
  ORDER BY g.user_id, c.parent_id, g.created_at DESC
) migrated
ON CONFLICT (user_id, content_id) WHERE user_id IS NOT NULL
DO UPDATE SET status = EXCLUDED.status, created_at = EXCLUDED.created_at;

INSERT INTO access_grants (id, user_id, group_id, content_id, status, created_at)
SELECT gen_random_uuid()::text, NULL, group_id, subject_id, status, created_at
FROM (
  SELECT DISTINCT ON (g.group_id, c.parent_id)
    g.group_id, c.parent_id AS subject_id, g.status, g.created_at
  FROM access_grants g
  JOIN content c ON c.id = g.content_id AND c.kind = 'course'
  JOIN content s ON s.id = c.parent_id AND s.kind = 'subject'
  WHERE g.group_id IS NOT NULL
    AND (
      lower(trim(s.name)) = 'english' OR
      lower(regexp_replace(s.name, '[^a-zA-Z]', '', 'g')) IN
        ('uhv', 'uhvuniversalhumanvalues', 'universalhumanvalues')
    )
  ORDER BY g.group_id, c.parent_id, g.created_at DESC
) migrated
ON CONFLICT (group_id, content_id) WHERE group_id IS NOT NULL
DO UPDATE SET status = EXCLUDED.status, created_at = EXCLUDED.created_at;

-- Promote each existing chapter so it sits directly under its subject.
UPDATE content chapter
SET parent_id = course.parent_id,
    updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::bigint
FROM content course
WHERE chapter.kind = 'chapter'
  AND course.kind = 'course'
  AND chapter.parent_id = course.id;

-- Courses are now empty containers and can be removed.
DELETE FROM content WHERE kind = 'course';

-- Keep only the two requested subjects. Cascading foreign keys remove their content.
DELETE FROM content
WHERE kind = 'subject'
  AND lower(trim(name)) <> 'english'
  AND lower(regexp_replace(name, '[^a-zA-Z]', '', 'g')) NOT IN
    ('uhv', 'uhvuniversalhumanvalues', 'universalhumanvalues');

-- Remove obsolete interest choices from existing student profiles.
UPDATE users
SET interests = CASE
  WHEN interests::jsonb ? 'English' AND
       (interests::jsonb ? 'UHV' OR interests::jsonb ? 'UHV (Universal Human Values)')
    THEN '["English","UHV (Universal Human Values)"]'
  WHEN interests::jsonb ? 'English' THEN '["English"]'
  WHEN interests::jsonb ? 'UHV' OR interests::jsonb ? 'UHV (Universal Human Values)'
    THEN '["UHV (Universal Human Values)"]'
  ELSE '[]'
END,
updated_at = (extract(epoch FROM clock_timestamp()) * 1000)::bigint
WHERE role = 'student';

ALTER TABLE content DROP CONSTRAINT IF EXISTS content_kind_check;
ALTER TABLE content ADD CONSTRAINT content_kind_check
  CHECK (kind IN ('subject', 'chapter', 'topic', 'video'));

COMMIT;

-- Expected result: exactly English and UHV, with no course rows.
SELECT id, kind, parent_id, name, status FROM content
WHERE kind = 'subject' ORDER BY name;
SELECT kind, count(*) FROM content GROUP BY kind ORDER BY kind;
