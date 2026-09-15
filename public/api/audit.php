<?php
// ==============================================================================
// AUDIT TRAIL API ENDPOINT (Company scoped)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

if ($action === 'log') {
    $input = getJsonInput();
    if (empty($input['action']) || empty($input['module'])) {
        jsonError("Action and module are required", 400);
    }

    $id = $input['id'] ?? ('AUD-' . strtoupper(substr(bin2hex(random_bytes(6)), 0, 12)));
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    $stmt = $pdo->prepare("
        INSERT INTO audit_logs (
            id, company_id, user_id, user_name, user_role,
            action, module, record_id, record_name, description,
            before_data, after_data, ip_address, status
        ) VALUES (
            :id, :company_id, :user_id, :user_name, :user_role,
            :action, :module, :record_id, :record_name, :description,
            :before_data, :after_data, :ip_address, :status
        )
    ");

    $stmt->execute([
        'id' => $id,
        'company_id' => $companyId,
        'user_id' => $session['userId'],
        'user_name' => $session['name'],
        'user_role' => $session['role'],
        'action' => $input['action'],
        'module' => $input['module'],
        'record_id' => $input['recordId'] ?? '',
        'record_name' => $input['recordName'] ?? '',
        'description' => $input['description'] ?? '',
        'before_data' => !empty($input['beforeData']) ? json_encode($input['beforeData']) : null,
        'after_data' => !empty($input['afterData']) ? json_encode($input['afterData']) : null,
        'ip_address' => $ip,
        'status' => $input['status'] ?? 'Success',
    ]);

    jsonResponse(['success' => true, 'id' => $id]);
}

if ($action === 'clear') {
    requirePermission($session, 'AUDIT_CLEAR');
    $stmt = $pdo->prepare("DELETE FROM audit_logs WHERE company_id = :company_id");
    $stmt->execute(['company_id' => $companyId]);

    jsonResponse(['success' => true, 'message' => "Audit trail cleared"]);
}

jsonError("Unknown action", 404);
