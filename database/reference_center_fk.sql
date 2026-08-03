-- =============================================
-- REFERENCE MANAGEMENT MIGRATION
-- Adds center_id FK + contact columns to references
-- so each reference can be assigned to a specific center
-- with contact details (phone/email/address)
-- =============================================

-- 1. Add contact info columns (idempotent)
ALTER TABLE references ADD COLUMN IF NOT EXISTS phone   VARCHAR(20);
ALTER TABLE references ADD COLUMN IF NOT EXISTS email   VARCHAR(255);
ALTER TABLE references ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Add center_id column (FK to centers)
ALTER TABLE references 
ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_references_center_id ON references(center_id);
CREATE INDEX IF NOT EXISTS idx_references_name      ON references(name);
CREATE INDEX IF NOT EXISTS idx_references_active    ON references(is_active);

-- Summary:
--  - References with center_id = NULL are "Global" (visible/usable by ALL centers)
--  - References with center_id set belong only to that specific center
--  - If a center is deleted, ref.center_id becomes NULL (globalised) — not deleted
--  - phone/email/address give proper doctor/consultant contact info
--  - is_active toggle is also supported
