-- Store the username of the staff member who created each bill.
ALTER TABLE bills
    ADD COLUMN IF NOT EXISTS cashier VARCHAR(120);
