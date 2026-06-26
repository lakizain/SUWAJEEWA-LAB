-- Add center_id column to admin_users table and set up foreign key relationship

-- Step 1: Add the column (allow NULL initially for existing users)
ALTER TABLE admin_users 
ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- Step 2: Optional - Add index for better performance
CREATE INDEX idx_admin_users_center_id ON admin_users(center_id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added center_id column to admin_users table with foreign key constraint';
END $$;
