-- Store the optional company name entered for Out Medical center bills.
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);