<?php
// ==============================================================================
// USERS MANAGEMENT API ENDPOINT (Company scoped)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

if ($action === 'list') {
    requirePermission($session, 'VIEW_USERS');
    // If Super Admin, can optionally see all or filtered; for company admin, strictly company_id
    if ($session['role'] === 'Super Admin' && isset($_GET['all'])) {
        $stmt = $pdo->prepare("SELECT id, company_id, name, email, role, custom_role_name, status, permissions, created_at FROM users ORDER BY created_at DESC");
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare("SELECT id, company_id, name, email, role, custom_role_name, status, permissions, created_at FROM users WHERE company_id = :company_id ORDER BY created_at DESC");
        $stmt->execute(['company_id' => $companyId]);
    }
    
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

    jsonResponse(['success' => true, 'users' => $users]);
}

if ($action === 'create') {
    requirePermission($session, 'USERS_CREATE');
    $input = getJsonInput();
    if (empty($input['name']) || empty($input['email']) || empty($input['password'])) {
        jsonError("Name, email, and password are required", 400);
    }

    $email = strtolower(trim($input['email']));
    // Check if email already exists
    $chk = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1");
    $chk->execute(['email' => $email]);
    if ($chk->fetch()) {
        jsonError("A user with this email address already exists", 409);
    }

    $id = $input['id'] ?? ('USR-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));
    $passwordHash = password_hash($input['password'], PASSWORD_BCRYPT);
    $targetCompanyId = ($session['role'] === 'Super Admin' && !empty($input['companyId'])) 
        ? $input['companyId'] 
        : $companyId;

    $permissions = $input['permissions'] ?? [];
    if (empty($permissions)) {
        // Default role permissions
        if ($input['role'] === 'Admin') {
            $permissions = ["VIEW_DASHBOARD","VIEW_CHITS","CHITS_CREATE","CHITS_EDIT","CHITS_DELETE","VIEW_MEMBERS","MEMBERS_CREATE","MEMBERS_EDIT","MEMBERS_DELETE","VIEW_PAYMENTS","PAYMENTS_CREATE","PAYMENTS_EDIT","PAYMENTS_DELETE","VIEW_REPORTS","REPORTS_EXPORT","REPORTS_PRINT","VIEW_SETTINGS","SETTINGS_EDIT","VIEW_USERS","USERS_CREATE","USERS_EDIT","USERS_DELETE","VIEW_BACKUP","BACKUP_CREATE","BACKUP_RESTORE","VIEW_AUDIT_TRAIL","AUDIT_EXPORT"];
        } elseif ($input['role'] === 'Manager') {
            $permissions = ["VIEW_DASHBOARD","VIEW_CHITS","CHITS_CREATE","CHITS_EDIT","VIEW_MEMBERS","MEMBERS_CREATE","MEMBERS_EDIT","VIEW_PAYMENTS","PAYMENTS_CREATE","PAYMENTS_EDIT","VIEW_REPORTS","REPORTS_EXPORT","VIEW_AUDIT_TRAIL"];
        } else {
            $permissions = ["VIEW_DASHBOARD","VIEW_CHITS","VIEW_MEMBERS","VIEW_PAYMENTS","PAYMENTS_CREATE","VIEW_REPORTS"];
        }
    }

    $stmt = $pdo->prepare("
        INSERT INTO users (id, company_id, name, email, password_hash, role, custom_role_name, status, permissions)
        VALUES (:id, :company_id, :name, :email, :password_hash, :role, :custom_role_name, :status, :permissions)
    ");

    $stmt->execute([
        'id' => $id,
        'company_id' => $targetCompanyId,
        'name' => $input['name'],
        'email' => $email,
        'password_hash' => $passwordHash,
        'role' => $input['role'] ?? 'Staff',
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
            'name' => $input['name'],
            'email' => $email,
            'role' => $input['role'] ?? 'Staff',
            'status' => $input['status'] ?? 'Active',
            'permissions' => $permissions,
        ],
        'message' => "User created successfully"
    ]);
}

if ($action === 'update') {
    requirePermission($session, 'USERS_EDIT');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    if (empty($id)) {
        jsonError("User ID is required", 400);
    }

    // Verify company scope
    if ($session['role'] !== 'Super Admin') {
        $chk = $pdo->prepare("SELECT id FROM users WHERE id = :id AND company_id = :company_id LIMIT 1");
        $chk->execute(['id' => $id, 'company_id' => $companyId]);
        if (!$chk->fetch()) {
            jsonError("User not found or unauthorized", 404);
        }
    }

    $fields = [];
    $params = ['id' => $id];

    if (isset($input['name'])) {
        $fields[] = "name = :name";
        $params['name'] = $input['name'];
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

if ($action === 'delete') {
    requirePermission($session, 'USERS_DELETE');
    $input = getJsonInput();
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        jsonError("User ID is required", 400);
    }

    if ($id === $session['userId']) {
        jsonError("Cannot delete your own user account", 400);
    }

    if ($session['role'] !== 'Super Admin') {
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id AND company_id = :company_id");
        $stmt->execute(['id' => $id, 'company_id' => $companyId]);
    } else {
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
        $stmt->execute(['id' => $id]);
    }

    jsonResponse(['success' => true, 'message' => "User deleted successfully"]);
}

jsonError("Unknown action", 404);
