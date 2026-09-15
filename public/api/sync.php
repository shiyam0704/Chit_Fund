<?php
// ==============================================================================
// CROSS-DEVICE REAL-TIME SYNC API ENDPOINT
// Returns strictly company-isolated authoritative business records
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$pdo = Database::getConnection();

try {
    // Check granular permissions for each module
    $canViewChits = hasUserPermission($session, 'chits.view');
    $canViewMembers = hasUserPermission($session, 'members.view');
    $canViewPayments = hasUserPermission($session, 'payments.view');
    $canViewAudit = hasUserPermission($session, 'audit_trail.view');

    // 1. Fetch Company Chits (STRICTLY company_id = :companyId)
    $chits = [];
    if ($canViewChits) {
        $cStmt = $pdo->prepare("SELECT * FROM chits WHERE company_id = :companyId ORDER BY created_at DESC");
        $cStmt->execute(['companyId' => $companyId]);
        $rawChits = $cStmt->fetchAll();
        foreach ($rawChits as $rc) {
            $chits[] = [
                'id' => $rc['id'],
                'companyId' => $rc['company_id'],
                'name' => $rc['name'],
                'chitAmount' => (float)$rc['chit_amount'],
                'durationMonths' => (int)$rc['duration_months'],
                'membersCount' => (int)$rc['members_count'],
                'memberCount' => (int)$rc['members_count'],
                'monthlyInstallment' => (float)$rc['monthly_installment'],
                'baseMonthlyAmount' => (float)$rc['base_monthly_amount'],
                'initialBidAmount' => (float)$rc['initial_bid_amount'],
                'bidReductionMethod' => $rc['bid_reduction_method'] ?: 'Auto',
                'bidReductionValue' => (float)$rc['bid_reduction_value'],
                'collectedAmount' => (float)$rc['collected_amount'],
                'pendingAmount' => (float)$rc['pending_amount'],
                'startDate' => $rc['start_date'],
                'endDate' => $rc['end_date'] ?: '',
                'commissionPercentage' => (float)$rc['commission_percentage'],
                'gracePeriodDays' => (int)$rc['grace_period_days'],
                'status' => $rc['status'],
                'description' => $rc['description'] ?: '',
                'installmentType' => $rc['installment_type'] ?: 'Fixed',
                'monthlyIncreaseAmount' => (float)$rc['monthly_increase_amount'],
                'stepUpConfig' => !empty($rc['step_up_config']) ? json_decode($rc['step_up_config'], true) : null,
                'auctions' => !empty($rc['auctions']) ? json_decode($rc['auctions'], true) : [],
                'isConfigured' => (bool)$rc['is_configured'],
                'enrolledMemberIds' => !empty($rc['enrolled_member_ids']) ? json_decode($rc['enrolled_member_ids'], true) : [],
                'monthMemberAssignments' => !empty($rc['month_member_assignments']) ? json_decode($rc['month_member_assignments'], true) : new stdClass(),
                'monthOverrides' => !empty($rc['month_overrides']) ? json_decode($rc['month_overrides'], true) : null,
                'monthStatuses' => !empty($rc['month_statuses']) ? json_decode($rc['month_statuses'], true) : null,
                'monthPayouts' => !empty($rc['month_payouts']) ? json_decode($rc['month_payouts'], true) : null,
            ];
        }
    }

    // 2. Fetch Company Members (STRICTLY company_id = :companyId)
    $members = [];
    if ($canViewMembers) {
        $mStmt = $pdo->prepare("SELECT * FROM members WHERE company_id = :companyId ORDER BY created_at DESC");
        $mStmt->execute(['companyId' => $companyId]);
        $rawMembers = $mStmt->fetchAll();
        foreach ($rawMembers as $rm) {
            $members[] = [
                'id' => $rm['id'],
                'companyId' => $rm['company_id'],
                'name' => $rm['name'],
                'phone' => $rm['phone'],
                'email' => $rm['email'] ?: '',
                'address' => $rm['address'] ?: '',
                'idProofType' => $rm['id_proof_type'] ?: '',
                'idProofNumber' => $rm['id_proof_number'] ?: '',
                'joinDate' => $rm['join_date'],
                'status' => $rm['status'],
                'enrolledChitIds' => !empty($rm['enrolled_chit_ids']) ? json_decode($rm['enrolled_chit_ids'], true) : [],
                'chitId' => $rm['chit_id'] ?: '',
                'chitName' => $rm['chit_name'] ?: '',
                'notes' => $rm['notes'] ?: '',
            ];
        }
    }

    // 3. Fetch Company Transactions (STRICTLY company_id = :companyId)
    $transactions = [];
    if ($canViewPayments) {
        $tStmt = $pdo->prepare("SELECT * FROM transactions WHERE company_id = :companyId ORDER BY payment_date DESC, created_at DESC");
        $tStmt->execute(['companyId' => $companyId]);
        $rawTxns = $tStmt->fetchAll();
        foreach ($rawTxns as $rt) {
            $transactions[] = [
                'id' => $rt['id'],
                'companyId' => $rt['company_id'],
                'chitId' => $rt['chit_id'],
                'memberId' => $rt['member_id'],
                'amount' => (float)$rt['amount'],
                'paymentDate' => $rt['payment_date'],
                'paymentMode' => $rt['payment_mode'],
                'referenceNo' => $rt['reference_no'] ?: '',
                'monthNumber' => $rt['month_number'] !== null ? (int)$rt['month_number'] : null,
                'monthId' => $rt['month_id'] ?: '',
                'type' => $rt['type'] ?: 'Collection',
                'status' => $rt['status'] ?: 'Completed',
                'notes' => $rt['notes'] ?: '',
                'createdBy' => $rt['created_by'] ?: '',
            ];
        }
    }

    // 4. Fetch Company Payouts (STRICTLY company_id = :companyId)
    $payouts = [];
    if ($canViewPayments || $canViewChits) {
        $pStmt = $pdo->prepare("SELECT * FROM payouts WHERE company_id = :companyId ORDER BY payout_date DESC");
        $pStmt->execute(['companyId' => $companyId]);
        $rawPayouts = $pStmt->fetchAll();
        foreach ($rawPayouts as $rp) {
            $payouts[] = [
                'id' => $rp['id'],
                'companyId' => $rp['company_id'],
                'chitId' => $rp['chit_id'],
                'memberId' => $rp['member_id'],
                'monthNumber' => (int)$rp['month_number'],
                'netAmount' => (float)$rp['net_amount'],
                'dividendAmount' => (float)$rp['dividend_amount'],
                'bidAmount' => (float)$rp['bid_amount'],
                'commissionAmount' => (float)$rp['commission_amount'],
                'payoutDate' => $rp['payout_date'],
                'payoutMode' => $rp['payout_mode'],
                'referenceNo' => $rp['reference_no'] ?: '',
                'status' => $rp['status'] ?: 'Completed',
                'notes' => $rp['notes'] ?: '',
                'createdBy' => $rp['created_by'] ?: '',
            ];
        }
    }

    // 5. Fetch Company Settings (STRICTLY company_id = :companyId)
    $sStmt = $pdo->prepare("SELECT settings_json FROM company_settings WHERE company_id = :companyId LIMIT 1");
    $sStmt->execute(['companyId' => $companyId]);
    $rawSettings = $sStmt->fetchColumn();
    $companySettings = $rawSettings ? json_decode($rawSettings, true) : null;

    // 6. Fetch Company Audit Logs (STRICTLY company_id = :companyId)
    $auditLogs = [];
    if ($canViewAudit) {
        $aStmt = $pdo->prepare("SELECT * FROM audit_logs WHERE company_id = :companyId ORDER BY created_at DESC LIMIT 200");
        $aStmt->execute(['companyId' => $companyId]);
        $rawAudit = $aStmt->fetchAll();
        foreach ($rawAudit as $ra) {
            $auditLogs[] = [
                'id' => $ra['id'],
                'companyId' => $ra['company_id'],
                'userId' => $ra['user_id'],
                'userName' => $ra['user_name'],
                'userRole' => $ra['user_role'],
                'action' => $ra['action'],
                'module' => $ra['module'],
                'recordId' => $ra['record_id'] ?: '',
                'recordName' => $ra['record_name'] ?: '',
                'description' => $ra['description'],
                'beforeData' => !empty($ra['before_data']) ? json_decode($ra['before_data'], true) : null,
                'afterData' => !empty($ra['after_data']) ? json_decode($ra['after_data'], true) : null,
                'ipAddress' => $ra['ip_address'] ?: '',
                'status' => $ra['status'] ?: 'Success',
                'createdAt' => $ra['created_at'],
            ];
        }
    }

    jsonResponse([
        'success' => true,
        'companyId' => $companyId,
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
        'data' => [
            'chits' => $chits,
            'members' => $members,
            'transactions' => $transactions,
            'payouts' => $payouts,
            'companySettings' => $companySettings,
            'auditLogs' => $auditLogs,
        ],
    ]);
} catch (Exception $e) {
    jsonError("Sync failed: " . $e->getMessage(), 500);
}
