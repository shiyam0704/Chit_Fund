<?php
// ==============================================================================
// COMPANIES API ENDPOINT (Multi-Tenant Management & Onboarding)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

// 1. PUBLIC / ADMIN TENANT REGISTRATION (Creates new isolated company + initial admin)
if ($action === 'register') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonError("Method not allowed", 405);
    }
    $input = getJsonInput();
    $companyName = trim($input['companyName'] ?? $input['name'] ?? '');
    $adminName = trim($input['adminName'] ?? $input['name'] ?? 'Company Admin');
    $adminEmail = strtolower(trim($input['adminEmail'] ?? $input['email'] ?? ''));
    $adminPassword = (string)($input['adminPassword'] ?? $input['password'] ?? '');

    if (empty($companyName)) {
        jsonError("Company name is required", 400);
    }
    if (empty($adminEmail) || empty($adminPassword)) {
        jsonError("Admin email and password are required", 400);
    }
    if (strlen($adminPassword) < 4) {
        jsonError("Password must be at least 4 characters long", 400);
    }

    // Ensure email is globally unique
    $checkUser = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1");
    $checkUser->execute(['email' => $adminEmail]);
    if ($checkUser->fetch() || $adminEmail === SUPERADMIN_EMAIL) {
        jsonError("A user with this email address already exists. Please choose a different email.", 409);
    }

    $companyId = $input['companyId'] ?? ('CMP-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)));
    $userId = 'USR-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
    $passwordHash = password_hash($adminPassword, PASSWORD_BCRYPT);

    $allAdminPerms = [
        "dashboard.view", "VIEW_DASHBOARD",
        "chits.view", "VIEW_CHITS", "chits.create", "CHITS_CREATE", "chits.edit", "CHITS_EDIT", "chits.delete", "CHITS_DELETE",
        "members.view", "VIEW_MEMBERS", "members.create", "MEMBERS_CREATE", "members.edit", "MEMBERS_EDIT", "members.delete", "MEMBERS_DELETE",
        "payments.view", "VIEW_PAYMENTS", "payments.create", "PAYMENTS_CREATE", "payments.edit", "PAYMENTS_EDIT", "payments.delete", "PAYMENTS_DELETE",
        "reports.view", "VIEW_REPORTS", "reports.export", "REPORTS_EXPORT",
        "settings.view", "VIEW_SETTINGS", "settings.edit", "SETTINGS_EDIT",
        "users.view", "VIEW_USERS", "users.create", "USERS_CREATE", "users.edit", "USERS_EDIT", "users.delete", "USERS_DELETE",
        "audit_trail.view", "VIEW_AUDIT_TRAIL", "audit_trail.export", "AUDIT_EXPORT",
    ];

    try {
        $pdo->beginTransaction();

        $cStmt = $pdo->prepare("INSERT INTO companies (id, name, status) VALUES (:id, :name, 'Active')");
        $cStmt->execute(['id' => $companyId, 'name' => $companyName]);

        $uStmt = $pdo->prepare("
            INSERT INTO users (id, company_id, name, email, password_hash, role, status, permissions)
            VALUES (:id, :company_id, :name, :email, :password_hash, 'Admin / Manager', 'Active', :permissions)
        ");
        $uStmt->execute([
            'id' => $userId,
            'company_id' => $companyId,
            'name' => $adminName,
            'email' => $adminEmail,
            'password_hash' => $passwordHash,
            'permissions' => json_encode($allAdminPerms),
        ]);

        $pdo->commit();

        jsonResponse([
            'success' => true,
            'message' => "Company and Admin registered successfully",
            'company' => [
                'id' => $companyId,
                'name' => $companyName,
                'status' => 'Active',
            ],
            'admin' => [
                'id' => $userId,
                'companyId' => $companyId,
                'name' => $adminName,
                'email' => $adminEmail,
                'role' => 'Admin / Manager',
            ],
        ], 201);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        jsonError("Failed to register company: " . $e->getMessage(), 500);
    }
}

// All actions below require authentication
$session = authenticateUser();

if ($action === 'list') {
    // Super Admin sees all companies; company admin/staff sees only their own company
    if ($session['role'] === 'Super Admin' && $session['email'] === SUPERADMIN_EMAIL) {
        $stmt = $pdo->query("SELECT id, name, status, created_at FROM companies ORDER BY name ASC");
        $companies = $stmt->fetchAll();
    } else {
        $stmt = $pdo->prepare("SELECT id, name, status, created_at FROM companies WHERE id = :company_id LIMIT 1");
        $stmt->execute(['company_id' => $session['companyId']]);
        $companies = $stmt->fetchAll();
    }
    jsonResponse(['success' => true, 'companies' => $companies]);
}

if ($action === 'create') {
    if ($session['role'] !== 'Super Admin') {
        jsonError("Only Super Administrator can create new companies directly", 403);
    }
    $input = getJsonInput();
    if (empty($input['name'])) {
        jsonError("Company name is required", 400);
    }

    $id = $input['id'] ?? ('CMP-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)));
    $stmt = $pdo->prepare("INSERT INTO companies (id, name, status) VALUES (:id, :name, 'Active')");
    $stmt->execute(['id' => $id, 'name' => $input['name']]);

    jsonResponse([
        'success' => true,
        'company' => [
            'id' => $id,
            'name' => $input['name'],
            'status' => 'Active',
            'createdAt' => date('Y-m-d H:i:s'),
        ]
    ]);
}

jsonError("Unknown action", 404);
