-- =============================================
-- CENTER-WISE BILL NUMBERING MIGRATION
-- Adds bill_counter column to centers table and
-- creates RPC function for atomic counter management
-- =============================================

-- 1. Add bill_counter column to centers table
ALTER TABLE centers 
ADD COLUMN IF NOT EXISTS bill_counter INTEGER NOT NULL DEFAULT 0;

-- 2. Initialize bill_counter for existing centers based on their bills
-- This calculates the max bill number per center and sets the counter accordingly
DO $$ 
DECLARE
    center_record RECORD;
    max_bill_num INTEGER;
BEGIN
    FOR center_record IN SELECT id FROM centers LOOP
        -- Find the max numeric suffix from bills for this center
        -- Format expected: CIDxxx-BNNN or just BNNN
        SELECT COALESCE(
            MAX(
                CASE 
                    WHEN b.bill_no ~ '-B[0-9]+$' THEN 
                        CAST(SUBSTRING(b.bill_no FROM '-B([0-9]+)$') AS INTEGER)
                    WHEN b.bill_no ~ '^B[0-9]+' THEN
                        CAST(SUBSTRING(b.bill_no FROM '^B([0-9]+)') AS INTEGER)
                    ELSE 0
                END
            ), 0
        ) INTO max_bill_num
        FROM bills b
        WHERE b.center_id = center_record.id;

        -- Update the center's counter to match existing max bill
        UPDATE centers 
        SET bill_counter = COALESCE(max_bill_num, 0)
        WHERE id = center_record.id;
    END LOOP;
END $$;

-- 3. Create RPC function for atomic get-and-increment of bill counter
-- This prevents race conditions when multiple bills are created simultaneously
CREATE OR REPLACE FUNCTION get_next_bill_number(p_center_id UUID)
RETURNS TABLE (
    next_counter INTEGER,
    center_cid VARCHAR,
    formatted_bill_no VARCHAR
) AS $$
DECLARE
    v_cid VARCHAR;
    v_next INTEGER;
BEGIN
    -- Check if center exists and get CID
    SELECT c.cid INTO v_cid
    FROM centers c
    WHERE c.id = p_center_id;

    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Center with ID % not found', p_center_id;
    END IF;

    -- Atomically increment the counter and return the new value
    UPDATE centers
    SET bill_counter = bill_counter + 1
    WHERE id = p_center_id
    RETURNING bill_counter INTO v_next;

    -- If no row was updated (shouldn't happen since we already validated), raise error
    IF v_next IS NULL THEN
        RAISE EXCEPTION 'Failed to increment bill counter for center %', p_center_id;
    END IF;

    -- Return results: counter, CID, and formatted bill number
    RETURN QUERY
    SELECT 
        v_next AS next_counter,
        v_cid AS center_cid,
        v_cid || '-B' || LPAD(v_next::TEXT, 3, '0') AS formatted_bill_no;
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
