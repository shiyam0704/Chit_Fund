<?php
// ==============================================================================
// REPORTS API ENDPOINT (Server-side RBAC enforced)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'summary';
$pdo = Database::getConnection();

// Strictly enforce reports.view permission
requirePermission($session, 'reports.view');

if ($action === 'summary') {
    // Total chits count and total value
    $cStmt = $pdo->prepare("SELECT COUNT(*) as total_chits, COALESCE(SUM(chit_amount), 0) as total_value, COALESCE(SUM(collected_amount), 0) as total_collected FROM chits WHERE company_id = :cid");
    $cStmt->execute(['cid' => $companyId]);
    $chitsData = $cStmt->fetch();

    // Total members count
    $mStmt = $pdo->prepare("SELECT COUNT(*) as total_members FROM members WHERE company_id = :cid");
    $mStmt->execute(['cid' => $companyId]);
    $membersData = $mStmt->fetch();

    // Total collections
    $tStmt = $pdo->prepare("SELECT COUNT(*) as total_transactions, COALESCE(SUM(amount), 0) as total_amount FROM transactions WHERE company_id = :cid");
    $tStmt->execute(['cid' => $companyId]);
    $txnsData = $tStmt->fetch();

    jsonResponse([
        'success' => true,
        'companyId' => $companyId,
        'summary' => [
            'totalChits' => (int)($chitsData['total_chits'] ?? 0),
            'totalChitValue' => (float)($chitsData['total_value'] ?? 0),
            'totalCollected' => (float)($chitsData['total_collected'] ?? 0),
            'totalMembers' => (int)($membersData['total_members'] ?? 0),
            'totalTransactions' => (int)($txnsData['total_transactions'] ?? 0),
            'totalRevenue' => (float)($txnsData['total_amount'] ?? 0),
        ]
    ]);
}

if ($action === 'export') {
    requirePermission($session, 'reports.export');
    jsonResponse([
        'success' => true,
        'message' => 'Export authorized',
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z')
    ]);
}

jsonError("Unknown action", 404);
