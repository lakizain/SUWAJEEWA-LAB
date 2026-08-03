-- =============================================
-- CENTER MANAGEMENT FIELDS MIGRATION (COMPLETE FIX)
-- Adds ALL missing columns: phone, address, email, short_name
-- Use IF NOT EXISTS so it's safe to run multiple times
-- =============================================

-- 1. Add all missing columns (safe to re-run)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE centers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE centers ADD COLUMN IF NOT EXISTS short_name VARCHAR(2);
ALTER TABLE centers ADD COLUMN IF NOT EXISTS bill_counter INTEGER NOT NULL DEFAULT 0;

-- 2. Validation constraint for short_name (2 uppercase letters)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'centers_short_name_check'
    ) THEN
        ALTER TABLE centers
        ADD CONSTRAINT centers_short_name_check
        CHECK (short_name IS NULL OR short_name ~ '^[A-Z]{2}$');
    END IF;
END $$;

-- 3. Auto-fill short_name for existing centers (2 first letters of name)
DO $$
DECLARE
    center_rec RECORD;
    v_short VARCHAR(2);
    v_clean VARCHAR;
BEGIN
    FOR center_rec IN SELECT id, center_name FROM centers WHERE short_name IS NULL LOOP
        v_clean := UPPER(REGEXP_REPLACE(center_rec.center_name, '[^A-Za-z]', '', 'g'));
        v_short := SUBSTRING(v_clean FROM 1 FOR 2);
        
        IF CHAR_LENGTH(COALESCE(v_short, '')) < 2 THEN
            v_short := 'XX';
        END IF;

        UPDATE centers
        SET short_name = v_short
        WHERE id = center_rec.id;
    END LOOP;
END $$;

-- 4. Initialize bill_counter for existing centers based on bill number formats
-- Supports all formats: YT-00001 (NEW), CID001-B001 (previous), B001 (old global)
DO $$ 
DECLARE
    center_record RECORD;
    max_bill_num INTEGER;
BEGIN
    FOR center_record IN SELECT id FROM centers LOOP
        SELECT COALESCE(
            MAX(
                CASE 
                    -- New format: SHORT-NNNNN  (e.g. YT-00001 -> 1)
                    WHEN b.bill_no ~ '^[A-Z]{2}-[0-9]+$' THEN 
                        CAST(SUBSTRING(b.bill_no FROM '^[A-Z]{2}-([0-9]+)$') AS INTEGER)
                    -- Previous center-wise format: CIDxxx-BNNN (e.g. CID001-B001 -> 1)
                    WHEN b.bill_no ~ '-B[0-9]+$' THEN 
                        CAST(SUBSTRING(b.bill_no FROM '-B([0-9]+)$') AS INTEGER)
                    -- Old global format: BNNN (e.g. B001 -> 1)
                    WHEN b.bill_no ~ '^B[0-9]+' THEN
                        CAST(SUBSTRING(b.bill_no FROM '^B([0-9]+)') AS INTEGER)
                    ELSE 0
                END
            ), 0
        ) INTO max_bill_num
        FROM bills b
        WHERE b.center_id = center_record.id;

        UPDATE centers 
        SET bill_counter = COALESCE(max_bill_num, 0)
        WHERE id = center_record.id;
    END LOOP;
END $$;

-- =====================================================
-- 5) RPC FUNCTION (NEW FORMAT: SHORT_NAME-NNNNN)
-- Example:  YT-00001   (NOT CID001-B001 anymore)
-- Counter stored in centers.bill_counter, format uses short_name + 5 digit padding
-- Falls back to CID prefix + B if short_name is missing
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_bill_number(p_center_id UUID)
RETURNS TABLE (
    next_counter INTEGER,
    center_short VARCHAR,
    formatted_bill_no VARCHAR
) AS $$
DECLARE
    v_short VARCHAR(2);
    v_cid   VARCHAR;
    v_next  INTEGER;
BEGIN
    -- Get short_name first, fall back to cid if not set
    SELECT c.short_name, c.cid
      INTO v_short, v_cid
      FROM centers c
     WHERE c.id = p_center_id;

    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Center with ID % not found', p_center_id;
    END IF;

    -- Atomically increment the counter
    UPDATE centers
       SET bill_counter = bill_counter + 1
     WHERE id = p_center_id
     RETURNING bill_counter INTO v_next;

    IF v_next IS NULL THEN
        RAISE EXCEPTION 'Failed to increment bill counter for center %', p_center_id;
    END IF;

    -- NEW FORMAT:
    -- If short_name (2 letters) is set -> YT-00001
    -- Otherwise fallback to CID prefix for backward compat -> CID001-00001
    IF v_short IS NOT NULL AND CHAR_LENGTH(v_short) = 2 THEN
        RETURN QUERY
        SELECT 
            v_next,
            v_short,
            v_short || '-' || LPAD(v_next::TEXT, 5, '0');
    ELSE
        RETURN QUERY
        SELECT 
            v_next,
            v_cid,
            v_cid   || '-' || LPAD(v_next::TEXT, 5, '0');
    END IF;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_next_bill_number(UUID) TO anon, authenticated;

-- 5. Index for performance
CREATE INDEX IF NOT EXISTS idx_bills_center_bill_no ON bills(center_id, bill_no);
