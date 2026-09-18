-- =============================================
-- CENTER-WISE BILL NUMBERING MIGRATION
-- Adds bill_counter column to centers table and
-- creates RPC function for atomic counter management
-- =============================================

-- 1. Add bill_counter column to centers table
ALTER TABLE centers 
ADD COLUMN IF NOT EXISTS bill_counter INTEGER NOT NULL DEFAULT 0;

-- 2. Initialize bill_counter for existing centers based on their bills
-- Supports all 3 formats: SHORT-NNNNN (NEW), CIDxxx-BNNN (previous), BNNN (old global)
-- Counter is set to MAX numeric part of EXISTING bills so next bill is +1 (sequential)
DO $$ 
DECLARE
    center_record RECORD;
    max_bill_num INTEGER;
BEGIN
    FOR center_record IN SELECT id FROM centers LOOP
        SELECT COALESCE(
            MAX(
                CASE 
                    -- New format: SHORT-NNNNN  (e.g. PA-00001 -> 1)
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

        -- Update the center's counter to match existing max bill
        -- Next bill will be max_bill_num + 1 (atomic increment in RPC)
        UPDATE centers 
        SET bill_counter = COALESCE(max_bill_num, 0)
        WHERE id = center_record.id;
    END LOOP;
END $$;

-- 3. Create RPC function for atomic get-and-increment of bill counter
-- This prevents race conditions when multiple bills are created simultaneously
-- NEW FORMAT: SHORT_NAME-NNNNN  (e.g. PA-00001, YT-00042)
-- Falls back to CID prefix if short_name is not set (for backward compat)
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

    UPDATE centers
       SET bill_counter = bill_counter + 1
     WHERE id = p_center_id
    RETURNING bill_counter INTO v_next;

    IF v_next IS NULL THEN
        RAISE EXCEPTION 'Failed to increment bill counter for center %', p_center_id;
    END IF;

    SELECT COALESCE(
        MAX(
            CAST(SUBSTRING(bill_no FROM (LENGTH(v_prefix) + 2)) AS INTEGER)
        ),
        0
    )
    INTO v_global_max
    FROM bills
    WHERE bill_no LIKE v_prefix || '-%'
      AND SUBSTRING(bill_no FROM (LENGTH(v_prefix) + 2)) ~ '^[0-9]+$';

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

-- 4. Grant execute permission on the RPC function
GRANT EXECUTE ON FUNCTION get_next_bill_number(UUID) TO anon, authenticated;

-- 5. Add index on bills(center_id, bill_no) for faster lookups
CREATE INDEX IF NOT EXISTS idx_bills_center_bill_no ON bills(center_id, bill_no);

-- =============================================
-- OPTIONAL: Migration to reformat existing bill numbers to CID-prefixed format
-- Uncomment and run if you want to update all existing bill_no values
-- =============================================
/*
DO $$
DECLARE
    bill_record RECORD;
    v_cid VARCHAR;
    v_num_suffix VARCHAR;
    v_new_bill_no VARCHAR;
BEGIN
    FOR bill_record IN 
        SELECT b.id, b.bill_no, b.center_id 
        FROM bills b
        WHERE b.bill_no NOT LIKE '%-B%'  -- Only process non-prefixed ones
    LOOP
        -- Get center CID
        SELECT c.cid INTO v_cid FROM centers c WHERE c.id = bill_record.center_id;
        
        IF v_cid IS NOT NULL THEN
            -- Extract the numeric part (handles B001 -> 001)
            v_num_suffix := SUBSTRING(bill_record.bill_no FROM '^B([0-9]+)');
            
            IF v_num_suffix IS NOT NULL THEN
                v_new_bill_no := v_cid || '-B' || v_num_suffix;
                
                -- Update the bill
                UPDATE bills SET bill_no = v_new_bill_no WHERE id = bill_record.id;
                
                RAISE NOTICE 'Updated bill % -> %', bill_record.bill_no, v_new_bill_no;
            END IF;
        END IF;
    END LOOP;
END $$;
*/
