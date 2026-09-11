SET search_path = public;

CREATE TABLE IF NOT EXISTS learning_assignments (id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', due_at BIGINT NOT NULL, time_limit_minutes INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')), created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS assignment_targets (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, group_id TEXT REFERENCES student_groups(id) ON DELETE CASCADE, CHECK((user_id IS NOT NULL AND group_id IS NULL) OR (user_id IS NULL AND group_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS assignment_resources (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE, upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE, UNIQUE(assignment_id,upload_id));
CREATE TABLE IF NOT EXISTS assignment_submissions (id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES learning_assignments(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, started_at BIGINT NOT NULL, submitted_at BIGINT, status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','reviewed')), note TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '', updated_at BIGINT NOT NULL, UNIQUE(assignment_id,user_id));
CREATE TABLE IF NOT EXISTS submission_files (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE, upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE, UNIQUE(submission_id,upload_id));
CREATE INDEX IF NOT EXISTS idx_assignment_due ON learning_assignments(status,due_at);
CREATE INDEX IF NOT EXISTS idx_assignment_target_user ON assignment_targets(user_id,assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_target_group ON assignment_targets(group_id,assignment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_assignment_student_target ON assignment_targets(assignment_id,user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_assignment_group_target ON assignment_targets(assignment_id,group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submission_student ON assignment_submissions(user_id,assignment_id);

ALTER TABLE learning_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE learning_assignments, assignment_targets, assignment_resources, assignment_submissions, submission_files FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON learning_assignments, assignment_targets, assignment_resources, assignment_submissions, submission_files TO english_tech_server;
CREATE POLICY server_access ON learning_assignments FOR ALL TO english_tech_server USING (true) WITH CHECK (true);
CREATE POLICY server_access ON assignment_targets FOR ALL TO english_tech_server USING (true) WITH CHECK (true);
CREATE POLICY server_access ON assignment_resources FOR ALL TO english_tech_server USING (true) WITH CHECK (true);
CREATE POLICY server_access ON assignment_submissions FOR ALL TO english_tech_server USING (true) WITH CHECK (true);
CREATE POLICY server_access ON submission_files FOR ALL TO english_tech_server USING (true) WITH CHECK (true);
