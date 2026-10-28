-- Stores an unguessable token used by the public report-download page.
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS report_access_token TEXT UNIQUE;
