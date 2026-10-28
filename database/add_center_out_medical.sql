-- Add the Out Medical setting to centers.
-- Existing centers receive false when the column is first added.
ALTER TABLE centers
ADD COLUMN IF NOT EXISTS is_out_medical BOOLEAN NOT NULL DEFAULT false;
