-- Add sort_order column to test_subcategories table for reordering
-- This will allow users to drag/move subcategories up/down and save the order

-- First, add the column as INTEGER (nullable initially) if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_subcategories' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE test_subcategories ADD COLUMN sort_order INTEGER;

        -- Update existing rows: set sort_order based on created_at (so existing order is preserved)
        -- For each test_id group, assign sort_order starting from 1
        WITH numbered_subcategories AS (
            SELECT 
                id,
                test_id,
                ROW_NUMBER() OVER (
                    PARTITION BY test_id 
                    ORDER BY created_at ASC
                ) AS new_sort_order
            FROM test_subcategories
        )
        UPDATE test_subcategories ts
        SET sort_order = ns.new_sort_order
        FROM numbered_subcategories ns
        WHERE ts.id = ns.id;

        -- Now, make sort_order NOT NULL
        ALTER TABLE test_subcategories ALTER COLUMN sort_order SET NOT NULL;

        -- Add an index on test_id and sort_order for faster queries
        CREATE INDEX IF NOT EXISTS idx_test_subcategories_test_id_sort_order 
        ON test_subcategories (test_id, sort_order);
    END IF;
END $$;

-- Optional: Add a default value for new rows (though we'll handle it in code)
-- ALTER TABLE test_subcategories ALTER COLUMN sort_order SET DEFAULT 0;