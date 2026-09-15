<?php
// ==============================================================================
// DATABASE CONNECTION (MySQL / MariaDB with Local SQLite Fallback)
// ==============================================================================

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;
    private static string $driver = 'mysql';

    public static function getConnection(): PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        // Try MySQL first
        try {
            $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_TIMEOUT            => 3,
            ];
            self::$instance = new PDO($dsn, DB_USER, DB_PASS, $options);
            self::$driver = 'mysql';
            self::initMysqlSchema(self::$instance);
            return self::$instance;
        } catch (PDOException $e) {
            // In production if MySQL is down, or locally if MySQL not installed, fallback to SQLite
            $dataDir = __DIR__ . '/data';
            if (!is_dir($dataDir)) {
                @mkdir($dataDir, 0755, true);
            }
            $sqliteFile = $dataDir . '/chitfund.sqlite';
            try {
                $options = [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ];
                self::$instance = new PDO("sqlite:" . $sqliteFile, null, null, $options);
                self::$driver = 'sqlite';
                self::initSqliteSchema(self::$instance);
                return self::$instance;
            } catch (Exception $sqliteEx) {
                jsonError("Database connection error: " . $e->getMessage(), 500);
            }
        }
    }

    public static function getDriver(): string {
        return self::$driver;
    }

    private static function initMysqlSchema(PDO $pdo): void {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS companies (
                    id VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(50) DEFAULT 'Active'
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(100) PRIMARY KEY,
                    company_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(191) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    custom_role_name VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'Active',
                    permissions LONGTEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS chits (
                    id VARCHAR(100) PRIMARY KEY,
                    company_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    chit_amount DOUBLE NOT NULL,
                    duration_months INT NOT NULL,
                    members_count INT NOT NULL,
                    monthly_installment DOUBLE NOT NULL,
                    base_monthly_amount DOUBLE NOT NULL,
                    initial_bid_amount DOUBLE DEFAULT 0,
                    bid_reduction_method VARCHAR(50) DEFAULT 'Auto',
                    bid_reduction_value DOUBLE DEFAULT 0,
                    collected_amount DOUBLE DEFAULT 0,
                    pending_amount DOUBLE DEFAULT 0,
                    start_date VARCHAR(50) NOT NULL,
                    end_date VARCHAR(50),
                    commission_percentage DOUBLE DEFAULT 5,
                    grace_period_days INT DEFAULT 5,
                    status VARCHAR(50) DEFAULT 'Active',
                    description LONGTEXT,
                    installment_type VARCHAR(50) DEFAULT 'Fixed',
                    monthly_increase_amount DOUBLE DEFAULT 0,
                    step_up_config LONGTEXT,
                    auctions LONGTEXT,
                    is_configured INT DEFAULT 1,
                    enrolled_member_ids LONGTEXT,
                    month_member_assignments LONGTEXT,
                    month_overrides LONGTEXT,
                    month_statuses LONGTEXT,
                    month_payouts LONGTEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_chit_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS members (
                    id VARCHAR(100) PRIMARY KEY,
                    company_id VARCHAR(100) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    phone VARCHAR(50) NOT NULL,
                    email VARCHAR(191),
                    address LONGTEXT,
                    id_proof_type VARCHAR(100),
                    id_proof_number VARCHAR(100),
                    join_date VARCHAR(50) NOT NULL,
                    status VARCHAR(50) DEFAULT 'Active',
                    enrolled_chit_ids LONGTEXT,
                    chit_id VARCHAR(100),
                    chit_name VARCHAR(255),
                    notes LONGTEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_member_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS transactions (
                    id VARCHAR(100) PRIMARY KEY,
                    company_id VARCHAR(100) NOT NULL,
                    chit_id VARCHAR(100) NOT NULL,
                    member_id VARCHAR(100) NOT NULL,
                    amount DOUBLE NOT NULL,
                    payment_date VARCHAR(50) NOT NULL,
                    payment_mode VARCHAR(50) NOT NULL,
                    reference_no VARCHAR(100),
                    month_number INT,
                    month_id VARCHAR(100),
                    type VARCHAR(50) DEFAULT 'Collection',
                    status VARCHAR(50) DEFAULT 'Completed',
                    notes LONGTEXT,
                    created_by VARCHAR(100),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_txn_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS payouts (
                    id VARCHAR(100) PRIMARY KEY,
                    company_id VARCHAR(100) NOT NULL,
                    chit_id VARCHAR(100) NOT NULL,
                    member_id VARCHAR(100) NOT NULL,
                    month_number INT NOT NULL,
                    net_amount DOUBLE NOT NULL,
                    dividend_amount DOUBLE DEFAULT 0,
                    bid_amount DOUBLE DEFAULT 0,
                    commission_amount DOUBLE DEFAULT 0,
                    payout_date VARCHAR(50) NOT NULL,
                    payout_mode VARCHAR(50) NOT NULL,
                    reference_no VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'Completed',
                    notes LONGTEXT,
                    created_by VARCHAR(100),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_payout_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS company_settings (
                    company_id VARCHAR(100) PRIMARY KEY,
                    settings_json LONGTEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id VARCHAR(100) PRIMARY KEY,
                    company_id VARCHAR(100) NOT NULL,
                    user_id VARCHAR(100) NOT NULL,
                    user_name VARCHAR(255) NOT NULL,
                    user_role VARCHAR(50) NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    module VARCHAR(100) NOT NULL,
                    record_id VARCHAR(100),
                    record_name VARCHAR(255),
                    description LONGTEXT NOT NULL,
                    before_data LONGTEXT,
                    after_data LONGTEXT,
                    ip_address VARCHAR(100),
                    status VARCHAR(50) DEFAULT 'Success',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_audit_company (company_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                CREATE TABLE IF NOT EXISTS activations (
                    code VARCHAR(100) PRIMARY KEY,
                    user_id VARCHAR(100) NOT NULL,
                    company_id VARCHAR(100) NOT NULL,
                    credential_json LONGTEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                INSERT IGNORE INTO companies (id, name, status) VALUES ('CMP-001', 'Chit Fund Management', 'Active');
            ");
        } catch (Exception $e) {
            error_log("Failed to auto-init MySQL schema: " . $e->getMessage());
        }
    }

    private static function initSqliteSchema(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS companies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'Active'
            );
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                custom_role_name TEXT,
                status TEXT DEFAULT 'Active',
                permissions TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS chits (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                chit_amount REAL NOT NULL,
                duration_months INTEGER NOT NULL,
                members_count INTEGER NOT NULL,
                monthly_installment REAL NOT NULL,
                base_monthly_amount REAL NOT NULL,
                initial_bid_amount REAL DEFAULT 0,
                bid_reduction_method TEXT DEFAULT 'Auto',
                bid_reduction_value REAL DEFAULT 0,
                collected_amount REAL DEFAULT 0,
                pending_amount REAL DEFAULT 0,
                start_date TEXT NOT NULL,
                end_date TEXT,
                commission_percentage REAL DEFAULT 5,
                grace_period_days INTEGER DEFAULT 5,
                status TEXT DEFAULT 'Active',
                description TEXT,
                installment_type TEXT DEFAULT 'Fixed',
                monthly_increase_amount REAL DEFAULT 0,
                step_up_config TEXT,
                auctions TEXT,
                is_configured INTEGER DEFAULT 1,
                enrolled_member_ids TEXT,
                month_member_assignments TEXT,
                month_overrides TEXT,
                month_statuses TEXT,
                month_payouts TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT,
                address TEXT,
                id_proof_type TEXT,
                id_proof_number TEXT,
                join_date TEXT NOT NULL,
                status TEXT DEFAULT 'Active',
                enrolled_chit_ids TEXT,
                chit_id TEXT,
                chit_name TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                chit_id TEXT NOT NULL,
                member_id TEXT NOT NULL,
                amount REAL NOT NULL,
                payment_date TEXT NOT NULL,
                payment_mode TEXT NOT NULL,
                reference_no TEXT,
                month_number INTEGER,
                month_id TEXT,
                type TEXT DEFAULT 'Collection',
                status TEXT DEFAULT 'Completed',
                notes TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS payouts (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                chit_id TEXT NOT NULL,
                member_id TEXT NOT NULL,
                month_number INTEGER NOT NULL,
                net_amount REAL NOT NULL,
                dividend_amount REAL DEFAULT 0,
                bid_amount REAL DEFAULT 0,
                commission_amount REAL DEFAULT 0,
                payout_date TEXT NOT NULL,
                payout_mode TEXT NOT NULL,
                reference_no TEXT,
                status TEXT DEFAULT 'Completed',
                notes TEXT,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS company_settings (
                company_id TEXT PRIMARY KEY,
                settings_json TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                user_role TEXT NOT NULL,
                action TEXT NOT NULL,
                module TEXT NOT NULL,
                record_id TEXT,
                record_name TEXT,
                description TEXT NOT NULL,
                before_data TEXT,
                after_data TEXT,
                ip_address TEXT,
                status TEXT DEFAULT 'Success',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS activations (
                code TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                company_id TEXT NOT NULL,
                credential_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT OR IGNORE INTO companies (id, name, status) VALUES ('CMP-001', 'Chit Fund Management', 'Active');
        ");
    }
}
