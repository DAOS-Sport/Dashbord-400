-- Task #12 保留主管批准/退回日報的稽核紀錄
-- Adds work_log_review_actions table to keep a full audit trail of
-- supervisor approve / return actions on daily report submissions.
-- Without this trail, repeated reviews would overwrite the previous
-- reviewedBy / reviewNote on daily_report_submissions and the original
-- return reason would be lost. Idempotent so it can run safely on
-- environments where drizzle-kit push has already been applied.

CREATE TABLE IF NOT EXISTS work_log_review_actions (
  id serial PRIMARY KEY,
  submission_id integer NOT NULL REFERENCES daily_report_submissions(id) ON DELETE CASCADE,
  action text NOT NULL,
  reviewer_employee_number text NOT NULL,
  reviewer_name text,
  note text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_log_review_actions_submission
  ON work_log_review_actions (submission_id, created_at);
