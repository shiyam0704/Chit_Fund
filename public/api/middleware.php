<?php
// ==============================================================================
// AUTHENTICATION & MULTI-TENANT AUTHORIZATION MIDDLEWARE
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/db.php';

function getBearerToken(): ?string {
    // 1. Direct custom header (immune to Apache/LiteSpeed Authorization stripping)
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim($_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    if (!empty($_SERVER['REDIRECT_HTTP_X_AUTH_TOKEN'])) {
        return trim($_SERVER['REDIRECT_HTTP_X_AUTH_TOKEN']);
    }

    // 2. Query / Request parameter fallback
    if (!empty($_REQUEST['token'])) {
        return trim($_REQUEST['token']);
    }
    if (!empty($_GET['token'])) {
        return trim($_GET['token']);
    }

    // 3. Standard HTTP Authorization header
    $headers = null;
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        } elseif (isset($requestHeaders['X-Auth-Token'])) {
            return trim($requestHeaders['X-Auth-Token']);
        }
    }

    if (!empty($headers)) {
        if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
            return $matches[1];
        }
        return $headers;
    }
    return null;
}

function authenticateUser(): array {
    setCorsHeaders();
    $token = getBearerToken();
    if (!$token) {
        jsonError("Unauthorized: Missing Bearer Token", 401);
    }

    $payload = JWT::decode($token);
    if (!$payload || empty($payload['userId']) || empty($payload['companyId'])) {
        jsonError("Unauthorized: Invalid or expired token", 401);
    }

    // Special check for universal Super Admin
    if ($payload['email'] === SUPERADMIN_EMAIL && $payload['role'] === 'Super Admin') {
        return $payload;
    }

    // Verify user exists and is active in database
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare("SELECT id, company_id, name, email, role, status, permissions FROM users WHERE id = :id AND company_id = :company_id LIMIT 1");
    $stmt->execute([
        'id' => $payload['userId'],
        'company_id' => $payload['companyId']
    ]);
    $user = $stmt->fetch();

    if (!$user || $user['status'] !== 'Active') {
        jsonError("Unauthorized: User account not found or deactivated", 401);
    }

    return [
        'userId' => $user['id'],
        'companyId' => $user['company_id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'permissions' => is_string($user['permissions']) ? json_decode($user['permissions'], true) : ($user['permissions'] ?? []),
    ];
}

function hasUserPermission(array $userSession, string $permission): bool {
    if (($userSession['role'] ?? '') === 'Super Admin' || ($userSession['email'] ?? '') === SUPERADMIN_EMAIL) {
        return true;
    }
    $permissions = $userSession['permissions'] ?? [];
    if (!is_array($permissions)) return false;

    static $aliases = [
        'dashboard.view' => ['dashboard.view', 'VIEW_DASHBOARD', 'DASHBOARD_VIEW'],
        'chits.view' => ['chits.view', 'VIEW_CHITS', 'CHITS_VIEW'],
        'chits.create' => ['chits.create', 'CHITS_CREATE', 'CREATE_CHITS'],
        'chits.edit' => ['chits.edit', 'CHITS_EDIT', 'EDIT_CHITS'],
        'chits.delete' => ['chits.delete', 'CHITS_DELETE', 'DELETE_CHITS'],
        'members.view' => ['members.view', 'VIEW_MEMBERS', 'MEMBERS_VIEW'],
        'members.create' => ['members.create', 'MEMBERS_CREATE', 'CREATE_MEMBERS'],
        'members.edit' => ['members.edit', 'MEMBERS_EDIT', 'EDIT_MEMBERS'],
        'members.delete' => ['members.delete', 'MEMBERS_DELETE', 'DELETE_MEMBERS'],
        'payments.view' => ['payments.view', 'VIEW_PAYMENTS', 'PAYMENTS_VIEW', 'COLLECTIONS_VIEW', 'VIEW_COLLECTIONS'],
        'payments.create' => ['payments.create', 'PAYMENTS_CREATE', 'CREATE_PAYMENTS', 'COLLECTIONS_CREATE', 'CREATE_COLLECTIONS'],
        'payments.edit' => ['payments.edit', 'PAYMENTS_EDIT', 'EDIT_PAYMENTS', 'COLLECTIONS_EDIT', 'EDIT_COLLECTIONS'],
        'payments.delete' => ['payments.delete', 'PAYMENTS_DELETE', 'DELETE_PAYMENTS', 'COLLECTIONS_DELETE', 'DELETE_COLLECTIONS'],
        'reports.view' => ['reports.view', 'VIEW_REPORTS', 'REPORTS_VIEW'],
        'reports.export' => ['reports.export', 'REPORTS_EXPORT', 'EXPORT_REPORTS'],
        'settings.view' => ['settings.view', 'VIEW_SETTINGS', 'SETTINGS_VIEW'],
        'settings.edit' => ['settings.edit', 'SETTINGS_EDIT', 'EDIT_SETTINGS'],
        'users.view' => ['users.view', 'VIEW_USERS', 'USERS_VIEW'],
        'users.create' => ['users.create', 'USERS_CREATE', 'CREATE_USERS'],
        'users.edit' => ['users.edit', 'USERS_EDIT', 'EDIT_USERS'],
        'users.delete' => ['users.delete', 'USERS_DELETE', 'DELETE_USERS'],
        'audit_trail.view' => ['audit_trail.view', 'VIEW_AUDIT_TRAIL', 'AUDIT_TRAIL_VIEW'],
        'backup.view' => ['backup.view', 'VIEW_BACKUP', 'BACKUP_VIEW'],
    ];

    if (in_array($permission, $permissions, true)) return true;

    foreach ($aliases as $canonical => $list) {
        if ($permission === $canonical || in_array($permission, $list, true)) {
            foreach ($list as $alias) {
                if (in_array($alias, $permissions, true)) return true;
            }
        }
    }

    foreach ($permissions as $up) {
        if (isset($aliases[$up]) && in_array($permission, $aliases[$up], true)) {
            return true;
        }
    }

    return false;
}

function requirePermission(array $userSession, string $permission): void {
    if (!hasUserPermission($userSession, $permission)) {
        jsonError("Forbidden: Insufficient permissions for '$permission'", 403);
    }
}

