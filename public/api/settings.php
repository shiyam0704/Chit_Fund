<?php
// ==============================================================================
// COMPANY SETTINGS API ENDPOINT
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'get';
$pdo = Database::getConnection();

if ($action === 'get') {
    requirePermission($session, 'VIEW_SETTINGS');
    $stmt = $pdo->prepare("SELECT settings_json FROM company_settings WHERE company_id = :companyId LIMIT 1");
    $stmt->execute(['companyId' => $companyId]);
    $row = $stmt->fetch();

    $settings = $row && !empty($row['settings_json']) ? json_decode($row['settings_json'], true) : null;
    jsonResponse(['success' => true, 'settings' => $settings]);
}

if ($action === 'update') {
    requirePermission($session, 'SETTINGS_EDIT');
    $input = getJsonInput();
    $settings = $input['settings'] ?? $input;

    if (!is_array($settings)) {
        jsonError("Invalid settings data", 400);
    }

    $jsonStr = json_encode($settings);
    if (Database::getDriver() === 'sqlite') {
        $stmt = $pdo->prepare("INSERT INTO company_settings (company_id, settings_json) VALUES (:id, :settings) ON CONFLICT(company_id) DO UPDATE SET settings_json = :settings");
    } else {
        $stmt = $pdo->prepare("INSERT INTO company_settings (company_id, settings_json) VALUES (:id, :settings) ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)");
    }
    $stmt->execute(['id' => $companyId, 'settings' => $jsonStr]);

    jsonResponse(['success' => true, 'message' => "Settings saved successfully"]);
}

jsonError("Unknown action", 404);
