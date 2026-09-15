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

function requirePermission(array $userSession, string $permission): void {
    if ($userSession['role'] === 'Super Admin') {
        return; // Super Admin has unrestricted access
    }
    $permissions = $userSession['permissions'] ?? [];
    if (!in_array($permission, $permissions, true)) {
        jsonError("Forbidden: Insufficient permissions for '$permission'", 403);
    }
}
