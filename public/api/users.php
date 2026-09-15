<?php
// ==============================================================================
// USERS MANAGEMENT API ENDPOINT (Company scoped, Central Persistent Storage)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

// 1. LIST USERS
if ($action === 'list') {
    requirePermission($session, 'users.view');
    
    // In universal single-company mode or Super Admin, list all users for the company
    $stmt = $pdo->prepare("SELECT id, company_id, name, email, role, custom_role_name, status, permissions, created_at FROM users WHERE company_id = :company_id OR :is_super = 1 ORDER BY created_at DESC");
    $stmt->execute([
        'company_id' => $companyId,
        'is_super' => ($session['role'] === 'Super Admin') ? 1 : 0
    ]);
    
    $raw = $stmt->fetchAll();
    $users = [];
    $hasSuperAdminInList = false;

    foreach ($raw as $u) {
        if ($u['email'] === SUPERADMIN_EMAIL || $u['role'] === 'Super Admin') {
            $hasSuperAdminInList = true;
        }
        $users[] = [
            'id' => $u['id'],
            'companyId' => $u['company_id'],
            'name' => $u['name'],
            'email' => $u['email'],
            'role' => $u['role'],
            'customRoleName' => $u['custom_role_name'],
            'status' => $u['status'],
            'permissions' => is_string($u['permissions']) ? json_decode($u['permissions'], true) : ($u['permissions'] ?? []),
            'createdAt' => $u['created_at'],
        ];
    }

    // Always ensure Super Admin is visible to Admin
    if (!$hasSuperAdminInList) {
        array_unshift($users, [
            'id' => 'USR-ROOT-001',
            'companyId' => $companyId,
            'name' => 'Super Administrator',
            'email' => SUPERADMIN_EMAIL,
            'role' => 'Super Admin',
            'status' => 'Active',
            'permissions' => ["VIEW_DASHBOARD","VIEW_CHITS","CHITS_CREATE","CHITS_EDIT","CHITS_DELETE","VIEW_MEMBERS","MEMBERS_CREATE","MEMBERS_EDIT","MEMBERS_DELETE","VIEW_PAYMENTS","PAYMENTS_CREATE","PAYMENTS_EDIT","PAYMENTS_DELETE","VIEW_REPORTS","REPORTS_EXPORT","REPORTS_PRINT","VIEW_SETTINGS","SETTINGS_EDIT","VIEW_USERS","USERS_CREATE","USERS_EDIT","USERS_DELETE","VIEW_BACKUP","BACKUP_CREATE","BACKUP_RESTORE","VIEW_AUDIT_TRAIL","AUDIT_EXPORT","AUDIT_CLEAR"],
            'createdAt' => '2026-01-01 00:00:00',
        ]);
    }

    jsonResponse(['success' => true, 'users' => $users]);
}

// 2. CREATE USER
if ($action === 'create') {
    requirePermission($session, 'users.create');
    $input = getJsonInput();
    if (empty($input['name']) || empty($input['email']) || empty($input['password'])) {
        jsonError("Name, email, and password are required", 400);
    }

    $email = strtolower(trim($input['email']));
    // Prevent normal users from creating Super Admin
    $role = $input['role'] ?? 'Staff';
    if ($role === 'Super Admin' && $session['role'] !== 'Super Admin') {
        jsonError("Cannot create a Super Admin account", 403);
    }

    // Check if email already exists
    $chk = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1");
    $chk->execute(['email' => $email]);
    if ($chk->fetch() || $email === SUPERADMIN_EMAIL) {
        jsonError("A user with this email address already exists", 409);
    }

    $id = $input['id'] ?? ('USR-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));
    $passwordHash = password_hash($input['password'], PASSWORD_BCRYPT);
    $targetCompanyId = (!empty($input['companyId'])) ? $input['companyId'] : $companyId;

    $permissions = $input['permissions'] ?? [];
    if (empty($permissions)) {
        if ($role === 'Admin / Manager' || $role === 'Manager') {
            $permissions = ["dashboard.view", "chits.view", "chits.create", "chits.edit", "members.view", "members.create", "members.edit", "payments.view", "payments.create", "payments.edit", "reports.view", "reports.export", "audit_trail.view"];
        } else {
            $permissions = ["dashboard.view", "members.view", "payments.view", "payments.create", "reports.view"];
        }
    }

    $stmt = $pdo->prepare("
        INSERT INTO users (id, company_id, name, email, password_hash, role, custom_role_name, status, permissions)
        VALUES (:id, :company_id, :name, :email, :password_hash, :role, :custom_role_name, :status, :permissions)
    ");

    $stmt->execute([
        'id' => $id,
        'company_id' => $targetCompanyId,
        'name' => trim($input['name']),
        'email' => $email,
        'password_hash' => $passwordHash,
        'role' => $role,
        'custom_role_name' => $input['customRoleName'] ?? null,
        'status' => $input['status'] ?? 'Active',
        'permissions' => json_encode($permissions),
    ]);

    jsonResponse([
        'success' => true,
        'id' => $id,
        'user' => [
            'id' => $id,
            'companyId' => $targetCompanyId,
            'name' => trim($input['name']),
            'email' => $email,
            'role' => $role,
            'status' => $input['status'] ?? 'Active',
            'permissions' => $permissions,
        ],
        'message' => "User created successfully"
    ]);
}

// 3. UPDATE USER
if ($action === 'update' || $action === 'update_permissions') {
    requirePermission($session, 'users.edit');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    if (empty($id)) {
        jsonError("User ID is required", 400);
    }

    // Protect Super Admin root account
    if ($id === 'USR-ROOT-001' || $id === 'USR-SUPERADMIN') {
        if (isset($input['status']) && $input['status'] === 'Disabled') {
            jsonError("Super Admin account cannot be disabled", 400);
        }
        if (isset($input['role']) && $input['role'] !== 'Super Admin') {
            jsonError("Super Admin role cannot be changed", 400);
        }
    }

    $fields = [];
    $params = ['id' => $id];

    if (isset($input['name'])) {
        $fields[] = "name = :name";
        $params['name'] = trim($input['name']);
    }
    if (isset($input['email'])) {
        $fields[] = "email = :email";
        $params['email'] = strtolower(trim($input['email']));
    }
    if (isset($input['role'])) {
        $fields[] = "role = :role";
        $params['role'] = $input['role'];
    }
    if (isset($input['status'])) {
        $fields[] = "status = :status";
        $params['status'] = $input['status'];
    }
    if (isset($input['customRoleName'])) {
        $fields[] = "custom_role_name = :custom_role_name";
        $params['custom_role_name'] = $input['customRoleName'];
    }
    if (isset($input['permissions'])) {
        $fields[] = "permissions = :permissions";
        $params['permissions'] = json_encode($input['permissions']);
    }
    if (!empty($input['password'])) {
        $fields[] = "password_hash = :password_hash";
        $params['password_hash'] = password_hash($input['password'], PASSWORD_BCRYPT);
    }

    if (!empty($fields)) {
        $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = :id");
        $stmt->execute($params);
    }

    jsonResponse(['success' => true, 'id' => $id, 'message' => "User updated successfully"]);
}

// 4. RESET PASSWORD
if ($action === 'reset_password') {
    requirePermission($session, 'users.edit');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    $newPassword = $input['password'] ?? '';
    if (empty($id) || empty($newPassword)) {
        jsonError("User ID and new password are required", 400);
    }

    $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = :password_hash WHERE id = :id");
    $stmt->execute(['password_hash' => $passwordHash, 'id' => $id]);

    jsonResponse(['success' => true, 'message' => "Password reset successfully"]);
}

// 5. TOGGLE STATUS
if ($action === 'toggle_status') {
    requirePermission($session, 'users.edit');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    if (empty($id)) {
        jsonError("User ID is required", 400);
    }
    if ($id === 'USR-ROOT-001' || $id === 'USR-SUPERADMIN' || $id === $session['userId']) {
        jsonError("Cannot change status of primary admin or own account", 400);
    }

    $stmt = $pdo->prepare("SELECT status FROM users WHERE id = :id LIMIT 1");
    $stmt->execute(['id' => $id]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonError("User not found", 404);
    }

    $newStatus = ($user['status'] === 'Active') ? 'Disabled' : 'Active';
    $uStmt = $pdo->prepare("UPDATE users SET status = :status WHERE id = :id");
    $uStmt->execute(['status' => $newStatus, 'id' => $id]);

    jsonResponse(['success' => true, 'newStatus' => $newStatus, 'message' => "User status updated to $newStatus"]);
}

// 6. DELETE USER
if ($action === 'delete') {
    requirePermission($session, 'users.delete');
    $input = getJsonInput();
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        jsonError("User ID is required", 400);
    }

    if ($id === $session['userId'] || $id === 'USR-ROOT-001' || $id === 'USR-SUPERADMIN') {
        jsonError("Cannot delete Super Admin or your own user account", 400);
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
    $stmt->execute(['id' => $id]);

    jsonResponse(['success' => true, 'message' => "User deleted successfully"]);
}

jsonError("Unknown action", 404);
