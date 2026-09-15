# Hostinger Production Deployment & Architecture Manual

This document explains the production deployment architecture of the Chit Fund web application on Hostinger, the unified client-server data model, RBAC permission security, and exact deployment steps.

---

## 1. System Architecture Overview

```
                          [ BROWSER CLIENTS ]
     ┌────────────────────────────┬────────────────────────────┐
     │                            │                            │
[ Admin Computer ]      [ Manager Computer ]          [ Staff Computer ]
(Full Permissions)     (Granular Permissions)       (Granular Permissions)
     │                            │                            │
     └────────────────────────────┼────────────────────────────┘
                                  │
                 HTTPS JSON REST API Requests
                 Bearer JWT / X-Auth-Token Headers
                                  │
                                  ▼
               [ HOSTINGER APACHE / LITESPEED ]
                 - .htaccess SPA Rewrites & Headers
                 - Pass-through HTTP_AUTHORIZATION
                                  │
                                  ▼
                     [ PHP 8.x BACKEND API ]
                 /api/auth.php         (JWT Authentication)
                 /api/middleware.php   (Token & RBAC Verification)
                 /api/users.php        (User Management & Passwords)
                 /api/sync.php         (Permission-Filtered Sync)
                 /api/chits.php        (Chit Schemes CRUD)
                 /api/members.php      (Member Directory CRUD)
                 /api/transactions.php (Collections & Receipts)
                 /api/payouts.php      (Auction Payouts)
                 /api/reports.php      (Financial Summaries & Export)
                 /api/settings.php     (Company Settings)
                 /api/audit.php        (Security Logs)
                                  │
                                  ▼
             [ HOSTINGER MySQL / MariaDB DATABASE ]
                 (Central Authoritative Single Source of Truth)
```

### Key Architectural Decisions:
1. **Single Source of Truth:** All Chits, Members, Collections, and Users reside exclusively in the centralized database.
2. **Zero Plaintext Passwords:** Passwords are never saved in LocalStorage, never exposed in client JavaScript bundles, and are hashed using standard bcrypt / SHA-256 on the server.
3. **No Business Data in LocalStorage:** Client LocalStorage is restricted solely to non-sensitive UI settings (e.g. `chitfund_theme`) and the active JWT session token (`chitfund_jwt_token`).
4. **Server-Side RBAC Enforcement:** Every backend endpoint independently validates user permissions via `requirePermission()` before reading or mutating records. Even if a user alters client-side code, the server blocks unauthorized data access with `403 Forbidden`.
5. **Continuous Cross-Device Synchronization:** Active client devices poll the authoritative `/api/sync.php` endpoint every 4.5 seconds and on window focus, keeping records synchronized across separate computers in real time.

---

## 2. Centralized Database Schema

The database schema (`public/api/schema.sql`) provides proper primary keys, foreign key constraints with `ON DELETE CASCADE`, indices, and multi-company support:

```sql
-- 1. Companies Table
CREATE TABLE companies (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users Table
CREATE TABLE users (
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

-- 3. Chits Table
CREATE TABLE chits (
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
CREATE TABLE members (
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

-- 5. Payment Transactions / Collections Table
CREATE TABLE transactions (
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
CREATE TABLE payouts (
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
CREATE TABLE company_settings (
  company_id VARCHAR(36) PRIMARY KEY,
  settings_json JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Audit Logs Table
CREATE TABLE audit_logs (
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
```

---

## 3. Authentication & Permission Flow

### Authentication Flow:
1. User enters email and password into the login form.
2. Request is dispatched directly to `POST /api/auth.php?action=login`.
3. Backend validates password hash (`password_verify()` or Super Admin credential verification).
4. If valid, backend generates an HMAC-SHA256 JWT containing `userId`, `companyId`, `role`, and `permissions`.
5. Frontend stores JWT token in `apiClient` storage (`chitfund_jwt_token`).
6. All subsequent requests send `Authorization: Bearer <token>` and `X-Auth-Token: <token>`.
7. `middleware.php` decrypts and verifies the JWT, loads user status from database, and confirms the account is Active.

### Granular Permission Resolution:
The permission engine supports bidirectional canonical mapping between frontend and backend formats:

| Action | Frontend Token | Backend Token |
|---|---|---|
| View Dashboard | `dashboard.view` | `VIEW_DASHBOARD` |
| View Chits | `chits.view` | `VIEW_CHITS` / `CHITS_VIEW` |
| Create Chit | `chits.create` | `CHITS_CREATE` |
| Edit Chit | `chits.edit` | `CHITS_EDIT` |
| Delete Chit | `chits.delete` | `CHITS_DELETE` |
| View Members | `members.view` | `VIEW_MEMBERS` / `MEMBERS_VIEW` |
| Create Member | `members.create` | `MEMBERS_CREATE` |
| Edit Member | `members.edit` | `MEMBERS_EDIT` |
| Delete Member | `members.delete` | `MEMBERS_DELETE` |
| View Collections | `payments.view` | `VIEW_PAYMENTS` / `PAYMENTS_VIEW` |
| Add Collection | `payments.create` | `PAYMENTS_CREATE` |
| Edit Collection | `payments.edit` | `PAYMENTS_EDIT` |
| Delete Collection | `payments.delete` | `PAYMENTS_DELETE` |
| View Reports | `reports.view` | `VIEW_REPORTS` / `REPORTS_VIEW` |
| Export Reports | `reports.export` | `REPORTS_EXPORT` |
| View Users | `users.view` | `VIEW_USERS` / `USERS_VIEW` |
| Create User | `users.create` | `USERS_CREATE` |
| Edit User / Permissions | `users.edit` | `USERS_EDIT` |
| Delete User | `users.delete` | `USERS_DELETE` |

---

## 4. Step-by-Step Hostinger Deployment Guide

### Prerequisites on Hostinger:
1. **PHP Version:** PHP 8.1 or 8.2 (configured in Hostinger hPanel -> Advanced -> PHP Configuration).
2. **Extensions Enabled:** `pdo_mysql`, `openssl`, `json`, `mbstring` (enabled by default on Hostinger).
3. **Web Server:** Apache or LiteSpeed with `mod_rewrite` enabled.

---

### Step 1: Create MySQL Database in Hostinger hPanel
1. Log in to your Hostinger hPanel.
2. Go to **Databases** -> **MySQL Databases**.
3. Create a new database:
   - **Database Name:** e.g. `u123456789_chitfund`
   - **Username:** e.g. `u123456789_chitadmin`
   - **Password:** Choose a strong password (e.g. `SecureChit@Db2026!`)
4. Note down your **Database Name**, **Username**, and **Password**.

---

### Step 2: Import the Database Schema
1. In hPanel, under **Databases**, click on **Enter phpMyAdmin** next to your newly created database.
2. Click the **Import** tab at the top.
3. Choose the file `public/api/schema.sql` from your project and click **Go**.
4. All 8 tables (`companies`, `users`, `chits`, `members`, `transactions`, `payouts`, `company_settings`, `audit_logs`) will be created automatically.

---

### Step 3: Configure Database Credentials in `public/api/config.php`
Open `public/api/config.php` and set your Hostinger database details:

```php
// Global Database Configuration for Hostinger
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'u123456789_chitfund');
define('DB_USER', getenv('DB_USER') ?: 'u123456789_chitadmin');
define('DB_PASS', getenv('DB_PASS') ?: 'SecureChit@Db2026!');
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'YOUR_RANDOM_LONG_SECRET_KEY_HERE_2026');

// Universal Fixed Admin Account
define('SUPERADMIN_EMAIL', 'chitfundadmin@gmail.com');
define('SUPERADMIN_PASS', 'adminchit@123'); // Change to your desired production admin password
```

---

### Step 4: Build the Production Frontend
On your computer, run the build command in the project directory:

```bash
npm run build
```

This compiles the React application into the `dist/` folder and bundles all static files and the `/api` directory.

---

### Step 5: Upload Files to Hostinger `public_html`
1. In Hostinger hPanel, open the **File Manager** (or connect via SFTP / FileZilla).
2. Navigate to your website's root directory: `public_html/`.
3. If there is a default `default.php` or `index.html` from Hostinger, delete it.
4. Upload all files and folders from inside the local `dist/` directory into `public_html/`:
   ```
   public_html/
   ├── .htaccess
   ├── index.html
   ├── icon.png
   ├── icon.ico
   ├── assets/
   │   ├── index-xxxx.js
   │   ├── index-xxxx.css
   │   └── ...
   └── api/
       ├── config.php
       ├── db.php
       ├── auth.php
       ├── middleware.php
       ├── users.php
       ├── sync.php
       ├── chits.php
       ├── members.php
       ├── transactions.php
       ├── payouts.php
       ├── reports.php
       ├── settings.php
       ├── audit.php
       ├── jwt.php
       ├── migrate.php
       └── schema.sql
   ```

---

### Step 6: Verify Authorization Header Passthrough on Hostinger
The included `public_html/.htaccess` contains rules to pass the HTTP Authorization header to PHP under Hostinger FastCGI/LiteSpeed:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{HTTP:Authorization} .
  RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
  
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteCond %{REQUEST_URI} ^/api/ [NC]
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>
```

In addition, `middleware.php` reads `HTTP_X_AUTH_TOKEN` and `REDIRECT_HTTP_X_AUTH_TOKEN` as redundant fallbacks, making it immune to Hostinger header-stripping.

---

## 5. Verification & Multi-Device Testing

### TEST 1: Admin Setup (Computer A)
1. Open browser on Computer A -> Navigate to your app domain.
2. Login with Admin credentials: `chitfundadmin@gmail.com` / password.
3. Create Chit: `Chit-100K-20M` (₹100,000, 20 months).
4. Add Member: `Ramesh Kumar` (Phone: `9876543210`).
5. Open Settings -> User Management -> Add User:
   - Name: `Staff User 001`
   - Email: `staff001@chitfund.com`
   - Password: `staffpassword123`
   - Role: `Staff`
   - Permissions:
     - Chits: View
     - Members: View + Add
     - Payments/Collections: View + Add
     - Reports: No Access
     - User Management: No Access
6. Click **Add User** -> Account is created directly in central database.

### TEST 2: Multi-Device Login (Computer B / Incognito)
1. Open browser on Computer B (or clean Incognito window).
2. Login as `staff001@chitfund.com` / `staffpassword123`.
3. Verify that `Chit-100K-20M` and `Ramesh Kumar` are immediately visible.
4. Verify Reports and Settings are not visible in the navigation sidebar.

### TEST 3: Staff Mutation Visible to Admin
1. On Computer B (logged in as Staff), click **Add Member**.
2. Add `Suresh Patel` (Phone: `9876543211`).
3. Switch to Computer A (logged in as Admin).
4. Within 4.5 seconds (or on window focus), `Suresh Patel` appears automatically in Admin's member directory.

### TEST 4: Admin Edit Reflected to Staff
1. On Computer A (Admin), edit member `Ramesh Kumar` -> update name to `Ramesh Kumar Sharma`.
2. On Computer B (Staff), the member name updates to `Ramesh Kumar Sharma` automatically.

### TEST 5: Direct Route Access Restriction
1. On Computer B (Staff), manually navigate in the browser URL bar to `https://yourdomain.com/reports`.
2. The UI renders the **Access Denied** guard screen with "You do not have permission to access this page".
3. Direct API call to `/api/reports.php` returns `403 Forbidden: Insufficient permissions for 'reports.view'`.

### TEST 6: Persistence After Browser Restart
1. Log out and close all browser windows on all devices.
2. Reopen browser and log in again.
3. All Chits, Members, Collections, and Users remain completely preserved from the central MySQL database.

### TEST 7: LocalStorage Resilience
1. Open browser developer tools on Staff computer -> Application -> Storage -> Local Storage.
2. Click **Clear All** (or execute `localStorage.clear()` in console).
3. Refresh the page and log in as Staff.
4. All Chits, Members, and Collections load completely from the central database.

---

## 6. Security Summary

- **Passwords:** Never saved in browser LocalStorage. Hashed with bcrypt on backend.
- **Tokens:** Signed with HMAC-SHA256 and expiration.
- **SQL Injection:** 100% prepared PDO statements with parameterized values throughout all endpoints.
- **Tenant Scope:** Scoped by `company_id` on all tables to prevent cross-company data leakage.
- **Access Control:** Verified at both router layer (React ProtectedRoute) and server layer (`requirePermission()`).
