<?php
// ==============================================================================
// TRANSACTIONS API ENDPOINT (Strict Multi-Tenant Scoping & Integrity Validation)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

// 1. LIST TRANSACTIONS
if ($action === 'list') {
    requirePermission($session, 'PAYMENTS_VIEW');
    $stmt = $pdo->prepare("SELECT * FROM transactions WHERE company_id = :company_id ORDER BY payment_date DESC, created_at DESC");
    $stmt->execute(['company_id' => $companyId]);
    $raw = $stmt->fetchAll();
    jsonResponse(['success' => true, 'companyId' => $companyId, 'transactions' => $raw]);
}

// 2. CREATE TRANSACTION
if ($action === 'create') {
    requirePermission($session, 'PAYMENTS_CREATE');
    $input = getJsonInput();
    if (empty($input['chitId']) || empty($input['memberId']) || empty($input['amount'])) {
        jsonError("Chit ID, Member ID, and amount are required", 400);
    }

    try {
        $chitId = trim($input['chitId']);
        $memberId = trim($input['memberId']);

        // Cross-company validation: Verify chit belongs to this company
        $cChk = $pdo->prepare("SELECT id FROM chits WHERE id = :chit_id AND company_id = :company_id LIMIT 1");
        $cChk->execute(['chit_id' => $chitId, 'company_id' => $companyId]);
        if (!$cChk->fetch()) {
            jsonError("Invalid transaction: Chit does not exist or belongs to another company", 400);
        }

        // Cross-company validation: Verify member belongs to this company
        $mChk = $pdo->prepare("SELECT id FROM members WHERE id = :member_id AND company_id = :company_id LIMIT 1");
        $mChk->execute(['member_id' => $memberId, 'company_id' => $companyId]);
        if (!$mChk->fetch()) {
            jsonError("Invalid transaction: Member does not exist or belongs to another company", 400);
        }

        $id = $input['id'] ?? ('TXN-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));

        $stmt = $pdo->prepare("
            INSERT INTO transactions (
                id, company_id, chit_id, member_id, amount,
                payment_date, payment_mode, reference_no, month_number,
                month_id, type, status, notes, created_by
            ) VALUES (
                :id, :company_id, :chit_id, :member_id, :amount,
                :payment_date, :payment_mode, :reference_no, :month_number,
                :month_id, :type, :status, :notes, :created_by
            )
        ");

        $stmt->execute([
            'id' => $id,
            'company_id' => $companyId,
            'chit_id' => $chitId,
            'member_id' => $memberId,
            'amount' => (float)$input['amount'],
            'payment_date' => !empty($input['paymentDate']) ? $input['paymentDate'] : date('Y-m-d'),
            'payment_mode' => $input['paymentMode'] ?? 'Cash',
            'reference_no' => $input['referenceNo'] ?? '',
            'month_number' => isset($input['monthNumber']) ? (int)$input['monthNumber'] : null,
            'month_id' => $input['monthId'] ?? '',
            'type' => $input['type'] ?? 'Collection',
            'status' => $input['status'] ?? 'Completed',
            'notes' => $input['notes'] ?? '',
            'created_by' => $session['userId'],
        ]);

        // Recalculate collected amount on chit safely
        $cUpdate = $pdo->prepare("
            UPDATE chits 
            SET collected_amount = (
                SELECT COALESCE(SUM(amount), 0) FROM transactions 
                WHERE chit_id = :chit_id AND company_id = :company_id AND status = 'Completed'
            )
            WHERE id = :chit_id AND company_id = :company_id
        ");
        $cUpdate->execute(['chit_id' => $chitId, 'company_id' => $companyId]);

        jsonResponse(['success' => true, 'id' => $id, 'message' => "Transaction recorded successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to record transaction: " . $e->getMessage(), 500);
    }
}

// 3. DELETE TRANSACTION
if ($action === 'delete') {
    requirePermission($session, 'PAYMENTS_DELETE');
    $input = getJsonInput();
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        jsonError("Transaction ID is required for delete", 400);
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM transactions WHERE id = :id AND company_id = :company_id");
        $stmt->execute(['id' => $id, 'company_id' => $companyId]);

        if ($stmt->rowCount() === 0) {
            jsonError("Transaction not found or does not belong to your company", 404);
        }

        jsonResponse(['success' => true, 'message' => "Transaction deleted successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to delete transaction: " . $e->getMessage(), 500);
    }
}

jsonError("Unknown action", 404);
