<?php
// ==============================================================================
// LOCALSTORAGE TO DATABASE MIGRATION API ENDPOINT
// Safely imports legacy LocalStorage data into the central database
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$pdo = Database::getConnection();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError("Method not allowed", 405);
}

// Only Admin or Super Admin can migrate data
if ($session['role'] !== 'Admin' && $session['role'] !== 'Super Admin') {
    jsonError("Only administrators can perform data migration", 403);
}

$input = getJsonInput();
$importedCount = [
    'chits' => 0,
    'members' => 0,
    'transactions' => 0,
    'payouts' => 0,
    'settings' => false,
];

try {
    $pdo->beginTransaction();

    // 1. Migrate Chits
    if (!empty($input['chits']) && is_array($input['chits'])) {
        foreach ($input['chits'] as $c) {
            if (empty($c['id']) || empty($c['name'])) continue;
            
            // Check if chit already exists in company
            $chk = $pdo->prepare("SELECT id FROM chits WHERE id = :id AND company_id = :company_id LIMIT 1");
            $chk->execute(['id' => $c['id'], 'company_id' => $companyId]);
            if ($chk->fetch()) continue; // Skip existing to prevent overwrite

            $stmt = $pdo->prepare("
                INSERT INTO chits (
                    id, company_id, name, chit_amount, duration_months, members_count,
                    monthly_installment, base_monthly_amount, initial_bid_amount,
                    bid_reduction_method, bid_reduction_value, collected_amount, pending_amount,
                    start_date, end_date, commission_percentage, grace_period_days, status,
                    description, installment_type, monthly_increase_amount, step_up_config,
                    auctions, is_configured, enrolled_member_ids, month_member_assignments,
                    month_overrides, month_statuses, month_payouts
                ) VALUES (
                    :id, :company_id, :name, :chit_amount, :duration_months, :members_count,
                    :monthly_installment, :base_monthly_amount, :initial_bid_amount,
                    :bid_reduction_method, :bid_reduction_value, :collected_amount, :pending_amount,
                    :start_date, :end_date, :commission_percentage, :grace_period_days, :status,
                    :description, :installment_type, :monthly_increase_amount, :step_up_config,
                    :auctions, :is_configured, :enrolled_member_ids, :month_member_assignments,
                    :month_overrides, :month_statuses, :month_payouts
                )
            ");
            $stmt->execute([
                'id' => $c['id'],
                'company_id' => $companyId,
                'name' => $c['name'],
                'chit_amount' => (float)($c['chitAmount'] ?? 0),
                'duration_months' => (int)($c['durationMonths'] ?? 10),
                'members_count' => (int)($c['membersCount'] ?? $c['memberCount'] ?? 10),
                'monthly_installment' => (float)($c['monthlyInstallment'] ?? 0),
                'base_monthly_amount' => (float)($c['baseMonthlyAmount'] ?? 0),
                'initial_bid_amount' => (float)($c['initialBidAmount'] ?? 0),
                'bid_reduction_method' => $c['bidReductionMethod'] ?? 'Auto',
                'bid_reduction_value' => (float)($c['bidReductionValue'] ?? 0),
                'collected_amount' => (float)($c['collectedAmount'] ?? 0),
                'pending_amount' => (float)($c['pendingAmount'] ?? 0),
                'start_date' => $c['startDate'] ?? date('Y-m-d'),
                'end_date' => $c['endDate'] ?? '',
                'commission_percentage' => (float)($c['commissionPercentage'] ?? 5),
                'grace_period_days' => (int)($c['gracePeriodDays'] ?? 5),
                'status' => $c['status'] ?? 'Active',
                'description' => $c['description'] ?? '',
                'installment_type' => $c['installmentType'] ?? 'Fixed',
                'monthly_increase_amount' => (float)($c['monthlyIncreaseAmount'] ?? 0),
                'step_up_config' => !empty($c['stepUpConfig']) ? json_encode($c['stepUpConfig']) : null,
                'auctions' => !empty($c['auctions']) ? json_encode($c['auctions']) : null,
                'is_configured' => isset($c['isConfigured']) ? ($c['isConfigured'] ? 1 : 0) : 1,
                'enrolled_member_ids' => !empty($c['enrolledMemberIds']) ? json_encode($c['enrolledMemberIds']) : null,
                'month_member_assignments' => !empty($c['monthMemberAssignments']) ? json_encode($c['monthMemberAssignments']) : null,
                'month_overrides' => !empty($c['monthOverrides']) ? json_encode($c['monthOverrides']) : null,
                'month_statuses' => !empty($c['monthStatuses']) ? json_encode($c['monthStatuses']) : null,
                'month_payouts' => !empty($c['monthPayouts']) ? json_encode($c['monthPayouts']) : null,
            ]);
            $importedCount['chits']++;
        }
    }

    // 2. Migrate Members
    if (!empty($input['members']) && is_array($input['members'])) {
        foreach ($input['members'] as $m) {
            if (empty($m['id']) || empty($m['name'])) continue;
            $chk = $pdo->prepare("SELECT id FROM members WHERE id = :id AND company_id = :company_id LIMIT 1");
            $chk->execute(['id' => $m['id'], 'company_id' => $companyId]);
            if ($chk->fetch()) continue;

            $stmt = $pdo->prepare("
                INSERT INTO members (
                    id, company_id, name, phone, email, address,
                    id_proof_type, id_proof_number, join_date, status,
                    enrolled_chit_ids, chit_id, chit_name, notes
                ) VALUES (
                    :id, :company_id, :name, :phone, :email, :address,
                    :id_proof_type, :id_proof_number, :join_date, :status,
                    :enrolled_chit_ids, :chit_id, :chit_name, :notes
                )
            ");
            $stmt->execute([
                'id' => $m['id'],
                'company_id' => $companyId,
                'name' => $m['name'],
                'phone' => $m['phone'] ?? '',
                'email' => $m['email'] ?? '',
                'address' => $m['address'] ?? '',
                'id_proof_type' => $m['idProofType'] ?? '',
                'id_proof_number' => $m['idProofNumber'] ?? '',
                'join_date' => $m['joinDate'] ?? date('Y-m-d'),
                'status' => $m['status'] ?? 'Active',
                'enrolled_chit_ids' => !empty($m['enrolledChitIds']) ? json_encode($m['enrolledChitIds']) : null,
                'chit_id' => $m['chitId'] ?? '',
                'chit_name' => $m['chitName'] ?? '',
                'notes' => $m['notes'] ?? '',
            ]);
            $importedCount['members']++;
        }
    }

    // 3. Migrate Transactions
    if (!empty($input['transactions']) && is_array($input['transactions'])) {
        foreach ($input['transactions'] as $t) {
            if (empty($t['id']) || empty($t['chitId']) || empty($t['memberId'])) continue;
            $chk = $pdo->prepare("SELECT id FROM transactions WHERE id = :id AND company_id = :company_id LIMIT 1");
            $chk->execute(['id' => $t['id'], 'company_id' => $companyId]);
            if ($chk->fetch()) continue;

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
                'id' => $t['id'],
                'company_id' => $companyId,
                'chit_id' => $t['chitId'],
                'member_id' => $t['memberId'],
                'amount' => (float)($t['amount'] ?? 0),
                'payment_date' => $t['paymentDate'] ?? date('Y-m-d'),
                'payment_mode' => $t['paymentMode'] ?? 'Cash',
                'reference_no' => $t['referenceNo'] ?? '',
                'month_number' => isset($t['monthNumber']) ? (int)$t['monthNumber'] : null,
                'month_id' => $t['monthId'] ?? '',
                'type' => $t['type'] ?? 'Collection',
                'status' => $t['status'] ?? 'Completed',
                'notes' => $t['notes'] ?? '',
                'created_by' => $session['userId'],
            ]);
            $importedCount['transactions']++;
        }
    }

    // 4. Migrate Payouts
    if (!empty($input['payouts']) && is_array($input['payouts'])) {
        foreach ($input['payouts'] as $p) {
            if (empty($p['id']) || empty($p['chitId']) || !isset($p['monthNumber'])) continue;
            $chk = $pdo->prepare("SELECT id FROM payouts WHERE id = :id AND company_id = :company_id LIMIT 1");
            $chk->execute(['id' => $p['id'], 'company_id' => $companyId]);
            if ($chk->fetch()) continue;

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
                'id' => $p['id'],
                'company_id' => $companyId,
                'chit_id' => $p['chitId'],
                'member_id' => $p['memberId'],
                'month_number' => (int)$p['monthNumber'],
                'net_amount' => (float)($p['netAmount'] ?? 0),
                'dividend_amount' => (float)($p['dividendAmount'] ?? 0),
                'bid_amount' => (float)($p['bidAmount'] ?? 0),
                'commission_amount' => (float)($p['commissionAmount'] ?? 0),
                'payout_date' => $p['paymentDate'] ?? date('Y-m-d'),
                'payout_mode' => $p['paymentMode'] ?? 'Cash',
                'reference_no' => $p['referenceNo'] ?? '',
                'status' => $p['status'] ?? 'Completed',
                'notes' => $p['notes'] ?? '',
                'created_by' => $session['userId'],
            ]);
            $importedCount['payouts']++;
        }
    }

    // 5. Migrate Company Settings
    if (!empty($input['companySettings']) && is_array($input['companySettings'])) {
        $jsonStr = json_encode($input['companySettings']);
        if (Database::getDriver() === 'sqlite') {
            $stmt = $pdo->prepare("INSERT INTO company_settings (company_id, settings_json) VALUES (:id, :settings) ON CONFLICT(company_id) DO UPDATE SET settings_json = :settings");
        } else {
            $stmt = $pdo->prepare("INSERT INTO company_settings (company_id, settings_json) VALUES (:id, :settings) ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json)");
        }
        $stmt->execute(['id' => $companyId, 'settings' => $jsonStr]);
        $importedCount['settings'] = true;
    }

    $pdo->commit();
    jsonResponse([
        'success' => true,
        'message' => "LocalStorage data successfully migrated to database",
        'imported' => $importedCount,
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    jsonError("Migration failed: " . $e->getMessage(), 500);
}
