-- Replace the bill-number prefix scan with indexed exact lookups.
ALTER TABLE public.centers
ADD COLUMN IF NOT EXISTS bill_counter INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_next_bill_number(p_center_id UUID)
RETURNS TABLE (
    next_counter INTEGER,
    center_short VARCHAR,
    formatted_bill_no VARCHAR
) AS $$
DECLARE
    v_short VARCHAR(2);
    v_cid VARCHAR;
    v_prefix VARCHAR;
    v_next INTEGER;
    v_candidate VARCHAR;
BEGIN
    SELECT c.short_name, c.cid
      INTO v_short, v_cid
      FROM public.centers AS c
     WHERE c.id = p_center_id;

    IF NOT FOUND OR v_cid IS NULL THEN
        RAISE EXCEPTION 'Center with ID % not found', p_center_id;
    END IF;

    v_prefix := CASE
        WHEN v_short IS NOT NULL AND CHAR_LENGTH(v_short) = 2 THEN v_short
        ELSE v_cid
    END;

    PERFORM pg_advisory_xact_lock(hashtext(v_prefix)::BIGINT);

    SELECT COALESCE(c.bill_counter, 0) + 1
      INTO v_next
      FROM public.centers AS c
     WHERE c.id = p_center_id
     FOR UPDATE;

    LOOP
        v_candidate := v_prefix || '-' || LPAD(v_next::TEXT, 5, '0');

        IF NOT EXISTS (
            SELECT 1
              FROM public.bills AS b
             WHERE b.bill_no = v_candidate
        ) THEN
            UPDATE public.centers AS c
               SET bill_counter = v_next
             WHERE c.id = p_center_id;

            RETURN QUERY
            SELECT v_next, v_prefix, v_candidate;
            RETURN;
        END IF;

        v_next := v_next + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_next_bill_number(UUID)
TO anon, authenticated;
