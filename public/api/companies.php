<?php
// ==============================================================================
// COMPANIES API ENDPOINT
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

if ($action === 'list') {
    // Super Admin can list all companies; other users see their own company
    if ($session['role'] === 'Super Admin') {
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
        jsonError("Only Super Administrator can create new companies", 403);
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
