<?php
// ==============================================================================
// PAYOUTS API ENDPOINT (Strict Multi-Tenant Scoping & Integrity Validation)
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
    requirePermission($session, 'PAYMENTS_VIEW');
    $stmt = $pdo->prepare("SELECT * FROM payouts WHERE company_id = :company_id ORDER BY payout_date DESC");
    $stmt->execute(['company_id' => $companyId]);
    $raw = $stmt->fetchAll();
    jsonResponse(['success' => true, 'companyId' => $companyId, 'payouts' => $raw]);
}

if ($action === 'create') {
    requirePermission($session, 'PAYMENTS_CREATE');
    $input = getJsonInput();
    if (empty($input['chitId']) || empty($input['memberId']) || !isset($input['monthNumber'])) {
        jsonError("Chit ID, Member ID, and monthNumber are required", 400);
    }

    $chitId = trim($input['chitId']);
    $memberId = trim($input['memberId']);

    // Cross-company validation: Verify chit belongs to this company
    $cChk = $pdo->prepare("SELECT id FROM chits WHERE id = :chit_id AND company_id = :company_id LIMIT 1");
    $cChk->execute(['chit_id' => $chitId, 'company_id' => $companyId]);
    if (!$cChk->fetch()) {
        jsonError("Invalid payout: Chit does not exist or belongs to another company", 400);
    }

    // Cross-company validation: Verify member belongs to this company
    $mChk = $pdo->prepare("SELECT id FROM members WHERE id = :member_id AND company_id = :company_id LIMIT 1");
    $mChk->execute(['member_id' => $memberId, 'company_id' => $companyId]);
    if (!$mChk->fetch()) {
        jsonError("Invalid payout: Member does not exist or belongs to another company", 400);
    }

    $id = $input['id'] ?? ('PAY-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));

    $stmt = $pdo->prepare("
        INSERT INTO payouts (
            id, company_id, chit_id, member_id, month_number,
            net_amount, dividend_amount, bid_amount, commission_amount,
            payout_date, payout_mode, reference_no, status, notes, created_by
        ) VALUES (
            :id, :company_id, :chit_id, :member_id, :month_number,
            :net_amount, :dividend_amount, :bid_amount, :commission_amount,
            :payout_date, :payout_mode, :reference_no, :status, :notes, :created_by
        )
    ");

    $stmt->execute([
        'id' => $id,
        'company_id' => $companyId,
        'chit_id' => $chitId,
        'member_id' => $memberId,
        'month_number' => (int)$input['monthNumber'],
        'net_amount' => (float)($input['netAmount'] ?? 0),
        'dividend_amount' => (float)($input['dividendAmount'] ?? 0),
        'bid_amount' => (float)($input['bidAmount'] ?? 0),
        'commission_amount' => (float)($input['commissionAmount'] ?? 0),
        'payout_date' => $input['payoutDate'] ?? ($input['paymentDate'] ?? date('Y-m-d')),
        'payout_mode' => $input['payoutMode'] ?? ($input['paymentMode'] ?? 'Cash'),
        'reference_no' => $input['referenceNo'] ?? '',
        'status' => $input['status'] ?? 'Completed',
        'notes' => $input['notes'] ?? '',
        'created_by' => $session['userId'],
    ]);

    jsonResponse(['success' => true, 'id' => $id, 'message' => "Payout recorded successfully"]);
}

if ($action === 'delete') {
    requirePermission($session, 'PAYMENTS_DELETE');
    $input = getJsonInput();
    $chitId = $input['chitId'] ?? ($_GET['chitId'] ?? '');
    $monthNumber = isset($input['monthNumber']) ? (int)$input['monthNumber'] : (isset($_GET['monthNumber']) ? (int)$_GET['monthNumber'] : null);

    if (empty($chitId) || $monthNumber === null) {
        jsonError("chitId and monthNumber are required", 400);
    }

    $stmt = $pdo->prepare("DELETE FROM payouts WHERE chit_id = :chit_id AND month_number = :month_number AND company_id = :company_id");
    $stmt->execute([
        'chit_id' => $chitId,
        'month_number' => $monthNumber,
        'company_id' => $companyId
    ]);

    if ($stmt->rowCount() === 0) {
        jsonError("Payout not found or does not belong to your company", 404);
    }

    jsonResponse(['success' => true, 'message' => "Payout removed successfully"]);
}

jsonError("Unknown action", 404);
