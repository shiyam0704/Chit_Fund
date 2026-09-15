<?php
// ==============================================================================
// USERS MANAGEMENT API ENDPOINT (Strict Multi-Tenant Scoping)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

// 1. LIST USERS (Strictly scoped to authenticated user's company)
if ($action === 'list') {
    requirePermission($session, 'users.view');
    
    $stmt = $pdo->prepare("
        SELECT id, company_id, name, email, role, custom_role_name, status, permissions, created_at 
        FROM users 
        WHERE company_id = :company_id 
        ORDER BY created_at DESC
    ");
    $stmt->execute(['company_id' => $companyId]);
    
    $raw = $stmt->fetchAll();
    $users = [];

    foreach ($raw as $u) {
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

    jsonResponse(['success' => true, 'companyId' => $companyId, 'users' => $users]);
}

// 2. CREATE USER (Strictly inherits authenticated Admin's company_id)
if ($action === 'create') {
    requirePermission($session, 'users.create');
    $input = getJsonInput();
    if (empty($input['name']) || empty($input['email']) || empty($input['password'])) {
        jsonError("Name, email, and password are required", 400);
    }

    $email = strtolower(trim($input['email']));
    $role = $input['role'] ?? 'Staff';

    // Disallow regular admins from creating a Super Admin account
    if ($role === 'Super Admin' && $session['role'] !== 'Super Admin') {
        jsonError("Cannot create a Super Admin account", 403);
    }

    // Check if email already exists globally
    $chk = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1");
    $chk->execute(['email' => $email]);
    if ($chk->fetch() || $email === SUPERADMIN_EMAIL) {
        jsonError("A user with this email address already exists", 409);
    }

    $id = $input['id'] ?? ('USR-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));
    $passwordHash = password_hash($input['password'], PASSWORD_BCRYPT);
    
    // SECURITY: Always inherit the authenticated admin's company_id! Never trust client input.
    $targetCompanyId = $companyId;

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

// 3. UPDATE USER (Strictly isolated to company)
if ($action === 'update' || $action === 'update_permissions') {
    requirePermission($session, 'users.edit');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    if (empty($id)) {
        jsonError("User ID is required", 400);
    }

    // Verify user exists and belongs to the authenticated admin's company
    $chkStmt = $pdo->prepare("SELECT id, role FROM users WHERE id = :id AND company_id = :company_id LIMIT 1");
    $chkStmt->execute(['id' => $id, 'company_id' => $companyId]);
    $targetUser = $chkStmt->fetch();
    if (!$targetUser) {
        jsonError("User not found or does not belong to your company", 404);
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
    $params = ['id' => $id, 'company_id' => $companyId];

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
        $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id = :id AND company_id = :company_id");
        $stmt->execute($params);
    }

    jsonResponse(['success' => true, 'id' => $id, 'message' => "User updated successfully"]);
}

// 4. RESET PASSWORD (Strictly scoped to company)
if ($action === 'reset_password') {
    requirePermission($session, 'users.edit');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    $newPassword = $input['password'] ?? '';
    if (empty($id) || empty($newPassword)) {
        jsonError("User ID and new password are required", 400);
    }

    $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = :password_hash WHERE id = :id AND company_id = :company_id");
    $stmt->execute([
        'password_hash' => $passwordHash,
        'id' => $id,
        'company_id' => $companyId,
    ]);

    if ($stmt->rowCount() === 0) {
        jsonError("User not found or does not belong to your company", 404);
    }

    jsonResponse(['success' => true, 'message' => "Password reset successfully"]);
}

// 5. TOGGLE STATUS (Strictly scoped to company)
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

    $stmt = $pdo->prepare("SELECT status FROM users WHERE id = :id AND company_id = :company_id LIMIT 1");
    $stmt->execute(['id' => $id, 'company_id' => $companyId]);
    $user = $stmt->fetch();
    if (!$user) {
        jsonError("User not found or does not belong to your company", 404);
    }

    $newStatus = ($user['status'] === 'Active') ? 'Disabled' : 'Active';
    $uStmt = $pdo->prepare("UPDATE users SET status = :status WHERE id = :id AND company_id = :company_id");
    $uStmt->execute([
        'status' => $newStatus,
        'id' => $id,
        'company_id' => $companyId,
    ]);

    jsonResponse(['success' => true, 'newStatus' => $newStatus, 'message' => "User status updated to $newStatus"]);
}

// 6. DELETE USER (Strictly scoped to company)
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

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id AND company_id = :company_id");
    $stmt->execute(['id' => $id, 'company_id' => $companyId]);

    if ($stmt->rowCount() === 0) {
        jsonError("User not found or does not belong to your company", 404);
    }

    jsonResponse(['success' => true, 'message' => "User deleted successfully"]);
}

jsonError("Unknown action", 404);
