<?php
// ==============================================================================
// TRANSACTIONS API ENDPOINT (Collections & Payments)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

// Ensure company exists
try {
    $cCheck = $pdo->prepare("INSERT IGNORE INTO companies (id, name, status) VALUES (:id, 'Chit Fund Management', 'Active')");
    $cCheck->execute(['id' => $companyId]);
} catch (Exception $ce) {
    // Ignore if already exists
}

if ($action === 'create') {
    requirePermission($session, 'PAYMENTS_CREATE');
    $input = getJsonInput();
    if (empty($input['chitId']) || empty($input['memberId']) || empty($input['amount'])) {
        jsonError("Chit ID, Member ID, and amount are required", 400);
    }

    try {
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
            'chit_id' => $input['chitId'],
            'member_id' => $input['memberId'],
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

        // Recalculate collected amount on chit
        $cUpdate = $pdo->prepare("
            UPDATE chits 
            SET collected_amount = (
                SELECT COALESCE(SUM(amount), 0) FROM transactions 
                WHERE chit_id = :chit_id AND company_id = :company_id AND type != 'Payout'
            )
            WHERE id = :chit_id AND company_id = :company_id
        ");
        $cUpdate->execute(['chit_id' => $input['chitId'], 'company_id' => $companyId]);

        jsonResponse(['success' => true, 'id' => $id, 'message' => "Payment recorded successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to record payment: " . $e->getMessage(), 500);
    }
}

if ($action === 'update') {
    requirePermission($session, 'PAYMENTS_EDIT');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    if (empty($id)) {
        jsonError("Transaction ID is required", 400);
    }

    $chk = $pdo->prepare("SELECT id, chit_id FROM transactions WHERE id = :id AND company_id = :company_id LIMIT 1");
    $chk->execute(['id' => $id, 'company_id' => $companyId]);
    $curr = $chk->fetch();
    if (!$curr) {
        jsonError("Transaction not found or unauthorized", 404);
    }

    $fields = [];
    $params = ['id' => $id, 'company_id' => $companyId];

    $fieldMap = [
        'amount' => 'amount',
        'paymentDate' => 'payment_date',
        'paymentMode' => 'payment_mode',
        'referenceNo' => 'reference_no',
        'monthNumber' => 'month_number',
        'monthId' => 'month_id',
        'type' => 'type',
        'status' => 'status',
        'notes' => 'notes',
    ];

    foreach ($fieldMap as $jsKey => $dbCol) {
        if (isset($input[$jsKey])) {
            $fields[] = "$dbCol = :$dbCol";
            $params[$dbCol] = $input[$jsKey];
        }
    }

    if (!empty($fields)) {
        $sql = "UPDATE transactions SET " . implode(', ', $fields) . " WHERE id = :id AND company_id = :company_id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        // Recalculate collected amount on chit
        $cUpdate = $pdo->prepare("
            UPDATE chits 
            SET collected_amount = (
                SELECT COALESCE(SUM(amount), 0) FROM transactions 
                WHERE chit_id = :chit_id AND company_id = :company_id AND type != 'Payout'
            )
            WHERE id = :chit_id AND company_id = :company_id
        ");
        $cUpdate->execute(['chit_id' => $curr['chit_id'], 'company_id' => $companyId]);
    }

    jsonResponse(['success' => true, 'id' => $id, 'message' => "Transaction updated successfully"]);
}

if ($action === 'delete') {
    requirePermission($session, 'PAYMENTS_DELETE');
    $input = getJsonInput();
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        jsonError("Transaction ID is required", 400);
    }

    $chk = $pdo->prepare("SELECT chit_id FROM transactions WHERE id = :id AND company_id = :company_id LIMIT 1");
    $chk->execute(['id' => $id, 'company_id' => $companyId]);
    $curr = $chk->fetch();

    $stmt = $pdo->prepare("DELETE FROM transactions WHERE id = :id AND company_id = :company_id");
    $stmt->execute(['id' => $id, 'company_id' => $companyId]);

    if ($curr) {
        $cUpdate = $pdo->prepare("
            UPDATE chits 
            SET collected_amount = (
                SELECT COALESCE(SUM(amount), 0) FROM transactions 
                WHERE chit_id = :chit_id AND company_id = :company_id AND type != 'Payout'
            )
            WHERE id = :chit_id AND company_id = :company_id
        ");
        $cUpdate->execute(['chit_id' => $curr['chit_id'], 'company_id' => $companyId]);
    }

    jsonResponse(['success' => true, 'message' => "Transaction deleted successfully"]);
}

jsonError("Unknown action", 404);
