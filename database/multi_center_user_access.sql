-- Allow one staff account to work at multiple laboratory centers.
-- Keep admin_users.center_id as the primary/legacy center for compatibility.

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_admin_users_center_id ON admin_users(center_id);

CREATE TABLE IF NOT EXISTS admin_user_centers (
    admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_user_id, center_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_centers_center_id
    ON admin_user_centers(center_id);

-- Preserve existing single-center assignments.
INSERT INTO admin_user_centers (admin_user_id, center_id)
SELECT id, center_id
FROM admin_users
WHERE center_id IS NOT NULL
ON CONFLICT (admin_user_id, center_id) DO NOTHING;

ALTER TABLE admin_user_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON admin_user_centers;
DROP POLICY IF EXISTS "Allow all for anon" ON admin_user_centers;

-- Match the existing admin_users access model used by this application.
CREATE POLICY "Allow all for authenticated" ON admin_user_centers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon" ON admin_user_centers
    FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE admin_user_centers TO anon, authenticated;

CREATE OR REPLACE FUNCTION set_admin_user_centers(
    p_admin_user_id UUID,
    p_center_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = p_admin_user_id) THEN
        RAISE EXCEPTION 'Admin user does not exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p_center_ids, ARRAY[]::UUID[])) AS requested(center_id)
        LEFT JOIN centers c ON c.id = requested.center_id
        WHERE c.id IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more selected centers do not exist';
    END IF;

    DELETE FROM admin_user_centers WHERE admin_user_id = p_admin_user_id;

    INSERT INTO admin_user_centers (admin_user_id, center_id)
    SELECT p_admin_user_id, selected.center_id
    FROM (
        SELECT DISTINCT unnest(COALESCE(p_center_ids, ARRAY[]::UUID[])) AS center_id
    ) AS selected;
END;
$$;

REVOKE ALL ON FUNCTION set_admin_user_centers(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_admin_user_centers(UUID, UUID[]) TO anon, authenticated;
