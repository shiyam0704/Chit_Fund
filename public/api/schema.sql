-- ==============================================================================
-- CHIT FUND MULTI-COMPANY SHARED DATA SCHEMA (MySQL / MariaDB / Hostinger)
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  custom_role_name VARCHAR(100) NULL,
  status VARCHAR(20) DEFAULT 'Active',
  permissions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_email (email),
  INDEX idx_user_company (company_id),
  CONSTRAINT fk_user_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Chit Schemes Table
CREATE TABLE IF NOT EXISTS chits (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  chit_amount DECIMAL(15, 2) NOT NULL,
  duration_months INT NOT NULL,
  members_count INT NOT NULL,
  monthly_installment DECIMAL(15, 2) NOT NULL,
  base_monthly_amount DECIMAL(15, 2) NOT NULL,
  initial_bid_amount DECIMAL(15, 2) DEFAULT 0,
  bid_reduction_method VARCHAR(50) DEFAULT 'Auto',
  bid_reduction_value DECIMAL(15, 2) DEFAULT 0,
  collected_amount DECIMAL(15, 2) DEFAULT 0,
  pending_amount DECIMAL(15, 2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date VARCHAR(50) NULL,
  commission_percentage DECIMAL(5, 2) DEFAULT 5,
  grace_period_days INT DEFAULT 5,
  status VARCHAR(50) DEFAULT 'Active',
  description TEXT NULL,
  installment_type VARCHAR(50) DEFAULT 'Fixed',
  monthly_increase_amount DECIMAL(15, 2) DEFAULT 0,
  step_up_config JSON NULL,
  auctions JSON NULL,
  is_configured TINYINT(1) DEFAULT 1,
  enrolled_member_ids JSON NULL,
  month_member_assignments JSON NULL,
  month_overrides JSON NULL,
  month_statuses JSON NULL,
  month_payouts JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_chit_company (company_id),
  CONSTRAINT fk_chit_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Members Table
CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  id_proof_type VARCHAR(100) NULL,
  id_proof_number VARCHAR(100) NULL,
  join_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'Active',
  enrolled_chit_ids JSON NULL,
  chit_id VARCHAR(36) NULL,
  chit_name VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_member_company (company_id),
  CONSTRAINT fk_member_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Payment Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  chit_id VARCHAR(36) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode VARCHAR(50) NOT NULL,
  reference_no VARCHAR(100) NULL,
  month_number INT NULL,
  month_id VARCHAR(100) NULL,
  type VARCHAR(50) DEFAULT 'Collection',
  status VARCHAR(50) DEFAULT 'Completed',
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_txn_company (company_id),
  INDEX idx_txn_chit (chit_id),
  INDEX idx_txn_member (member_id),
  CONSTRAINT fk_txn_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Payouts Table
CREATE TABLE IF NOT EXISTS payouts (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  chit_id VARCHAR(36) NOT NULL,
  member_id VARCHAR(36) NOT NULL,
  month_number INT NOT NULL,
  net_amount DECIMAL(15, 2) NOT NULL,
  dividend_amount DECIMAL(15, 2) DEFAULT 0,
  bid_amount DECIMAL(15, 2) DEFAULT 0,
  commission_amount DECIMAL(15, 2) DEFAULT 0,
  payout_date DATE NOT NULL,
  payout_mode VARCHAR(50) NOT NULL,
  reference_no VARCHAR(100) NULL,
  status VARCHAR(50) DEFAULT 'Completed',
  notes TEXT NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payout_company (company_id),
  INDEX idx_payout_chit (chit_id),
  CONSTRAINT fk_payout_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
  company_id VARCHAR(36) PRIMARY KEY,
  settings_json JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  module VARCHAR(100) NOT NULL,
  record_id VARCHAR(100) NULL,
  record_name VARCHAR(255) NULL,
  description TEXT NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  ip_address VARCHAR(45) NULL,
  status VARCHAR(20) DEFAULT 'Success',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_company (company_id),
  INDEX idx_audit_time (created_at),
  CONSTRAINT fk_audit_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed Default Primary Company
INSERT INTO companies (id, name, status)
VALUES ('CMP-001', 'Chit Fund Management', 'Active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Seed Default Universal Super Admin (Password: adminchit@123)
-- bcrypt hash for 'adminchit@123'
INSERT INTO users (id, company_id, name, email, password_hash, role, status, permissions)
VALUES (
  'USR-ROOT-001',
  'CMP-001',
  'Super Administrator',
  'chitfundadmin@gmail.com',
  '$2y$10$iM5T4eEre8kY/b3cE0v8Z.eM2qA1qf2o9V.eQ2kS5t7M1Y9aG2d4W', -- fallback / verified dynamically
  'Super Admin',
  'Active',
  '["VIEW_DASHBOARD","VIEW_CHITS","CHITS_CREATE","CHITS_EDIT","CHITS_DELETE","VIEW_MEMBERS","MEMBERS_CREATE","MEMBERS_EDIT","MEMBERS_DELETE","VIEW_PAYMENTS","PAYMENTS_CREATE","PAYMENTS_EDIT","PAYMENTS_DELETE","VIEW_REPORTS","REPORTS_EXPORT","REPORTS_PRINT","VIEW_SETTINGS","SETTINGS_EDIT","VIEW_USERS","USERS_CREATE","USERS_EDIT","USERS_DELETE","VIEW_BACKUP","BACKUP_CREATE","BACKUP_RESTORE","VIEW_AUDIT_TRAIL","AUDIT_EXPORT","AUDIT_CLEAR"]'
)
ON DUPLICATE KEY UPDATE name = VALUES(name);
