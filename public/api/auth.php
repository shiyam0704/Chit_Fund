<?php
// ==============================================================================
// AUTHENTICATION API ENDPOINT (Login, Profile, Verification)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$action = $_GET['action'] ?? 'login';
$pdo = Database::getConnection();

if ($action === 'login') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError("Method not allowed", 405);
    }

    $input = getJsonInput();
    $email = trim(strtolower($input['email'] ?? $input['username'] ?? ''));
    $password = (string)($input['password'] ?? '');

    if (empty($email) || empty($password)) {
        jsonError("Email and password are required", 400);
    }

    // 1. Universal Super Admin Fallback check (Always succeeds)
    if ($email === SUPERADMIN_EMAIL && $password === SUPERADMIN_PASS) {
        // Ensure default company exists
        $cStmt = $pdo->prepare("SELECT id, name FROM companies WHERE id = 'CMP-001' LIMIT 1");
        $cStmt->execute();
        $comp = $cStmt->fetch();
        if (!$comp) {
            $pdo->prepare("INSERT INTO companies (id, name, status) VALUES ('CMP-001', 'Chit Fund Management', 'Active')")->execute();
            $comp = ['id' => 'CMP-001', 'name' => 'Chit Fund Management'];
        }

        $allPerms = [
            "VIEW_DASHBOARD","VIEW_CHITS","CHITS_CREATE","CHITS_EDIT","CHITS_DELETE",
            "VIEW_MEMBERS","MEMBERS_CREATE","MEMBERS_EDIT","MEMBERS_DELETE",
            "VIEW_PAYMENTS","PAYMENTS_CREATE","PAYMENTS_EDIT","PAYMENTS_DELETE",
            "VIEW_REPORTS","REPORTS_EXPORT","REPORTS_PRINT",
            "VIEW_SETTINGS","SETTINGS_EDIT",
            "VIEW_USERS","USERS_CREATE","USERS_EDIT","USERS_DELETE",
            "VIEW_BACKUP","BACKUP_CREATE","BACKUP_RESTORE",
            "VIEW_AUDIT_TRAIL","AUDIT_EXPORT","AUDIT_CLEAR"
        ];

        $userPayload = [
            'userId' => 'USR-ROOT-001',
            'companyId' => 'CMP-001',
            'name' => 'Super Administrator',
            'email' => SUPERADMIN_EMAIL,
            'role' => 'Super Admin',
            'permissions' => $allPerms,
        ];

        $token = JWT::encode($userPayload);
        jsonResponse([
            'success' => true,
            'token' => $token,
            'user' => [
                'id' => 'USR-ROOT-001',
                'name' => 'Super Administrator',
                'email' => SUPERADMIN_EMAIL,
                'companyId' => 'CMP-001',
                'companyName' => $comp['name'],
                'role' => 'Super Admin',
                'status' => 'Active',
                'permissions' => $allPerms,
                'createdAt' => '2026-01-01T00:00:00.000Z',
            ],
            'company' => [
                'id' => 'CMP-001',
                'name' => $comp['name'],
                'status' => 'Active'
            ]
        ]);
    }

    // 2. Standard Company User Login from Database
    $stmt = $pdo->prepare("
        SELECT u.id, u.company_id, u.name, u.email, u.password_hash, u.role, u.custom_role_name, u.status, u.permissions, u.created_at,
               c.name as company_name, c.status as company_status
        FROM users u
        JOIN companies c ON u.company_id = c.id
        WHERE LOWER(u.email) = :email
        LIMIT 1
    ");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonError("Invalid email or password", 401);
    }

    if ($user['status'] !== 'Active' || $user['company_status'] !== 'Active') {
        jsonError("Account or company is suspended. Contact your administrator.", 403);
    }

    // Verify password (supports password_verify or PBKDF2/sha256 matching)
    $passwordValid = password_verify($password, $user['password_hash']);
    if (!$passwordValid && strlen($user['password_hash']) === 64) {
        // SHA-256 fallback for compatibility
        $passwordValid = hash_equals($user['password_hash'], hash('sha256', $password));
    }

    if (!$passwordValid) {
        jsonError("Invalid email or password", 401);
    }

    $permissions = is_string($user['permissions']) ? json_decode($user['permissions'], true) : ($user['permissions'] ?? []);

    $tokenPayload = [
        'userId' => $user['id'],
        'companyId' => $user['company_id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'permissions' => $permissions,
    ];

    $token = JWT::encode($tokenPayload);

    jsonResponse([
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $user['id'],
            'companyId' => $user['company_id'],
            'companyName' => $user['company_name'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'customRoleName' => $user['custom_role_name'],
            'status' => $user['status'],
            'permissions' => $permissions,
            'createdAt' => $user['created_at'] ?? date('c'),
        ],
        'company' => [
            'id' => $user['company_id'],
            'name' => $user['company_name'],
            'status' => $user['company_status']
        ]
    ]);
}

if ($action === 'me') {
    $session = authenticateUser();
    $cStmt = $pdo->prepare("SELECT name, status FROM companies WHERE id = :company_id LIMIT 1");
    $cStmt->execute(['company_id' => $session['companyId']]);
    $comp = $cStmt->fetch();

    jsonResponse([
        'success' => true,
        'user' => [
            'id' => $session['userId'],
            'companyId' => $session['companyId'],
            'companyName' => $comp['name'] ?? 'Primary Company',
            'name' => $session['name'],
            'email' => $session['email'],
            'role' => $session['role'],
            'permissions' => $session['permissions'],
            'createdAt' => date('c'),
        ],
        'company' => [
            'id' => $session['companyId'],
            'name' => $comp['name'] ?? 'Primary Company',
            'status' => $comp['status'] ?? 'Active'
        ]
    ]);
}

if ($action === 'resolve_code') {
    $code = strtoupper(trim($_GET['code'] ?? ''));
    if (empty($code)) {
        jsonError("Activation code required", 400);
    }
    $stmt = $pdo->prepare("SELECT credential_json FROM activations WHERE UPPER(code) = :code LIMIT 1");
    $stmt->execute(['code' => $code]);
    $row = $stmt->fetch();
    if ($row && !empty($row['credential_json'])) {
        $cred = json_decode($row['credential_json'], true);
        jsonResponse(['success' => true, 'credential' => $cred]);
    }
    jsonError("Activation code not found or expired", 404);
}

if ($action === 'register_activation') {
    $input = getJsonInput();
    $code = strtoupper(trim($input['code'] ?? ''));
    $userId = $input['userId'] ?? '';
    $companyId = $input['companyId'] ?? '';
    $credential = $input['credential'] ?? null;
    if ($code && $credential) {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO activations (code, user_id, company_id, credential_json) VALUES (:c, :u, :comp, :cred)");
        $stmt->execute([
            'c' => $code,
            'u' => $userId,
            'comp' => $companyId,
            'cred' => json_encode($credential)
        ]);
        jsonResponse(['success' => true]);
    }
    jsonError("Invalid activation parameters", 400);
}

if ($action === 'invalidate_code') {
    $input = getJsonInput();
    $code = strtoupper(trim($input['code'] ?? ''));
    if ($code) {
        $stmt = $pdo->prepare("DELETE FROM activations WHERE UPPER(code) = :code");
        $stmt->execute(['code' => $code]);
    }
    jsonResponse(['success' => true]);
}

jsonError("Unknown action", 404);
