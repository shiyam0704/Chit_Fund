-- ==============================================================================
-- CHIT FUND MULTI-TENANT DATABASE MIGRATION SCRIPT
-- Hostinger MySQL / MariaDB (Safe execution - preserves existing data)
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ensure companies table exists
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed default primary company for all existing data
INSERT INTO companies (id, name, status)
VALUES ('CMP-001', 'Primary Company', 'Active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 3. Ensure users have company_id and foreign key
UPDATE users 
SET company_id = 'CMP-001' 
WHERE company_id IS NULL OR company_id = '' OR company_id = 'CMP-DEFAULT';

-- 4. Ensure all business records are assigned to CMP-001
UPDATE chits 
SET company_id = 'CMP-001' 
WHERE company_id IS NULL OR company_id = '' OR company_id = 'CMP-DEFAULT';

UPDATE members 
SET company_id = 'CMP-001' 
WHERE company_id IS NULL OR company_id = '' OR company_id = 'CMP-DEFAULT';

UPDATE transactions 
SET company_id = 'CMP-001' 
WHERE company_id IS NULL OR company_id = '' OR company_id = 'CMP-DEFAULT';

UPDATE payouts 
SET company_id = 'CMP-001' 
WHERE company_id IS NULL OR company_id = '' OR company_id = 'CMP-DEFAULT';

UPDATE company_settings 
SET company_id = 'CMP-001' 
WHERE company_id IS NULL OR company_id = '' OR company_id = 'CMP-DEFAULT';

UPDATE audit_logs 
SET company_id = 'CMP-001' 
WHERE company_id IS NULL OR company_id = '' OR company_id = 'CMP-DEFAULT';

-- 5. Add multi-tenant performance indexes if not present
ALTER TABLE chits ADD INDEX IF NOT EXISTS idx_chit_company_created (company_id, created_at);
ALTER TABLE members ADD INDEX IF NOT EXISTS idx_member_company_created (company_id, created_at);
ALTER TABLE transactions ADD INDEX IF NOT EXISTS idx_txn_company_created (company_id, payment_date);
ALTER TABLE payouts ADD INDEX IF NOT EXISTS idx_payout_company_created (company_id, payout_date);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_user_company_role (company_id, role);

SET FOREIGN_KEY_CHECKS = 1;
