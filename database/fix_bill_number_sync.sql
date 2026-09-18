-- =============================================
-- FIX: Bill number counter sync with existing bills
-- Run this in Supabase SQL Editor to prevent
-- duplicate bill_no conflicts (e.g. PA-00002 already exists)
-- =============================================

-- 0. Helper: safely extract numeric sequence from any bill_no format
-- Handles: PA-00001, PA-00001-1086 (timestamp suffix), CID001-B001, B001
CREATE OR REPLACE FUNCTION extract_bill_sequence_number(p_bill_no TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_after_prefix TEXT;
BEGIN
    IF p_bill_no IS NULL OR TRIM(p_bill_no) = '' THEN
        RETURN 0;
    END IF;

    -- SHORT-NNNNN or SHORT-NNNNN-TTTT  (e.g. PA-00001, PA-00001-1086)
    IF p_bill_no ~ '^[A-Z]{2}-[0-9]+' THEN
        RETURN CAST(SUBSTRING(p_bill_no FROM '^[A-Z]{2}-([0-9]+)') AS INTEGER);
    END IF;

    -- CIDxxx-BNNN  (e.g. CID001-B001)
    IF p_bill_no ~ '-B[0-9]+' THEN
        RETURN CAST(SUBSTRING(p_bill_no FROM '-B([0-9]+)') AS INTEGER);
    END IF;

    -- Legacy BNNN  (e.g. B001)
    IF p_bill_no ~ '^B[0-9]+' THEN
        RETURN CAST(SUBSTRING(p_bill_no FROM '^B([0-9]+)') AS INTEGER);
    END IF;

    -- PREFIX-NNNNN or PREFIX-NNNNN-TTTT  (e.g. CID001-00005-1086)
    IF POSITION('-' IN p_bill_no) > 0 THEN
        v_after_prefix := SUBSTRING(p_bill_no FROM POSITION('-' IN p_bill_no) + 1);
        IF v_after_prefix ~ '^[0-9]+' THEN
            RETURN CAST(SPLIT_PART(v_after_prefix, '-', 1) AS INTEGER);
        END IF;
    END IF;

    RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Update RPC to always pick a globally unique number for the prefix
CREATE OR REPLACE FUNCTION get_next_bill_number(p_center_id UUID)
RETURNS TABLE (
    next_counter INTEGER,
    center_short VARCHAR,
    formatted_bill_no VARCHAR
) AS $$
DECLARE
    v_short VARCHAR(2);
    v_cid   VARCHAR;
    v_prefix VARCHAR;
    v_pad_len INTEGER;
    v_next  INTEGER;
    v_global_max INTEGER;
BEGIN
    SELECT c.short_name, c.cid
      INTO v_short, v_cid
      FROM centers c
     WHERE c.id = p_center_id;

    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Center with ID % not found', p_center_id;
    END IF;

    IF v_short IS NOT NULL AND CHAR_LENGTH(v_short) = 2 THEN
        v_prefix := v_short;
        v_pad_len := 5;
    ELSE
        v_prefix := v_cid;
        v_pad_len := 5;
    END IF;

    -- Atomically increment center counter
    UPDATE centers
       SET bill_counter = bill_counter + 1
     WHERE id = p_center_id
    RETURNING bill_counter INTO v_next;

    IF v_next IS NULL THEN
        RAISE EXCEPTION 'Failed to increment bill counter for center %', p_center_id;
    END IF;

    -- bill_no is globally unique — ensure we skip numbers already used by any center
    SELECT COALESCE(
        MAX(extract_bill_sequence_number(bill_no)),
        0
    )
    INTO v_global_max
    FROM bills
    WHERE bill_no LIKE v_prefix || '%';

    IF v_global_max >= v_next THEN
        v_next := v_global_max + 1;
        UPDATE centers
           SET bill_counter = v_next
         WHERE id = p_center_id;
    END IF;

    RETURN QUERY
    SELECT
        v_next,
        v_prefix,
        v_prefix || '-' || LPAD(v_next::TEXT, v_pad_len, '0');
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_next_bill_number(UUID) TO anon, authenticated;

-- 2. Re-sync all center counters from existing bills (one-time fix)
DO $$
DECLARE
    center_record RECORD;
    max_bill_num INTEGER;
BEGIN
    FOR center_record IN
        SELECT id FROM centers
    LOOP
        SELECT COALESCE(
            MAX(extract_bill_sequence_number(b.bill_no)),
            0
        )
        INTO max_bill_num
        FROM bills b
        WHERE b.center_id = center_record.id;

        UPDATE centers
           SET bill_counter = COALESCE(max_bill_num, 0)
         WHERE id = center_record.id;
    END LOOP;
END $$;
