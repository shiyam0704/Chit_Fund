<?php
// ==============================================================================
// CHITS API ENDPOINT (Strict Multi-Tenant Scoping)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

// 1. LIST CHITS
if ($action === 'list') {
    requirePermission($session, 'CHITS_VIEW');
    $stmt = $pdo->prepare("SELECT * FROM chits WHERE company_id = :company_id ORDER BY created_at DESC");
    $stmt->execute(['company_id' => $companyId]);
    $raw = $stmt->fetchAll();
    jsonResponse(['success' => true, 'companyId' => $companyId, 'chits' => $raw]);
}

// 2. CREATE CHIT
if ($action === 'create') {
    requirePermission($session, 'CHITS_CREATE');
    $input = getJsonInput();
    if (empty($input['name']) || empty($input['chitAmount'])) {
        jsonError("Chit name and amount are required", 400);
    }

    try {
        $id = $input['id'] ?? ('CHIT-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));
        $count = (int)($input['membersCount'] ?? $input['memberCount'] ?? 10);
        $duration = (int)($input['durationMonths'] ?? 10);
        $base = (float)($input['baseMonthlyAmount'] ?? ($input['chitAmount'] / max(1, $count)));

        $params = [
            'id' => $id,
            'company_id' => $companyId,
            'name' => $input['name'],
            'chit_amount' => (float)$input['chitAmount'],
            'duration_months' => $duration,
            'members_count' => $count,
            'monthly_installment' => (float)($input['monthlyInstallment'] ?? $base),
            'base_monthly_amount' => $base,
            'initial_bid_amount' => (float)($input['initialBidAmount'] ?? 0),
            'bid_reduction_method' => $input['bidReductionMethod'] ?? 'Auto',
            'bid_reduction_value' => (float)($input['bidReductionValue'] ?? 0),
            'collected_amount' => (float)($input['collectedAmount'] ?? 0),
            'pending_amount' => (float)($input['pendingAmount'] ?? $input['chitAmount']),
            'start_date' => !empty($input['startDate']) ? $input['startDate'] : date('Y-m-d'),
            'end_date' => !empty($input['endDate']) ? $input['endDate'] : null,
            'commission_percentage' => (float)($input['commissionPercentage'] ?? 5),
            'grace_period_days' => (int)($input['gracePeriodDays'] ?? 5),
            'status' => $input['status'] ?? 'Active',
            'description' => $input['description'] ?? '',
            'installment_type' => $input['installmentType'] ?? 'Fixed',
            'monthly_increase_amount' => (float)($input['monthlyIncreaseAmount'] ?? 0),
            'step_up_config' => !empty($input['stepUpConfig']) ? json_encode($input['stepUpConfig']) : null,
            'auctions' => !empty($input['auctions']) ? json_encode($input['auctions']) : null,
            'is_configured' => isset($input['isConfigured']) ? ($input['isConfigured'] ? 1 : 0) : 1,
            'enrolled_member_ids' => !empty($input['enrolledMemberIds']) ? json_encode($input['enrolledMemberIds']) : null,
            'month_member_assignments' => !empty($input['monthMemberAssignments']) ? json_encode($input['monthMemberAssignments']) : null,
            'month_overrides' => !empty($input['monthOverrides']) ? json_encode($input['monthOverrides']) : null,
            'month_statuses' => !empty($input['monthStatuses']) ? json_encode($input['monthStatuses']) : null,
            'month_payouts' => !empty($input['monthPayouts']) ? json_encode($input['monthPayouts']) : null,
        ];

        // Check if chit with this id exists
        $chk = $pdo->prepare("SELECT id, company_id FROM chits WHERE id = :id LIMIT 1");
        $chk->execute(['id' => $id]);
        $existing = $chk->fetch();

        if ($existing) {
            // If it belongs to another company, strictly reject!
            if ($existing['company_id'] !== $companyId) {
                jsonError("Forbidden: Chit exists under another company", 403);
            }

            $uStmt = $pdo->prepare("
                UPDATE chits SET
                    company_id = :company_id,
                    name = :name,
                    chit_amount = :chit_amount,
                    duration_months = :duration_months,
                    members_count = :members_count,
                    monthly_installment = :monthly_installment,
                    base_monthly_amount = :base_monthly_amount,
                    initial_bid_amount = :initial_bid_amount,
                    bid_reduction_method = :bid_reduction_method,
                    bid_reduction_value = :bid_reduction_value,
                    collected_amount = :collected_amount,
                    pending_amount = :pending_amount,
                    start_date = :start_date,
                    end_date = :end_date,
                    commission_percentage = :commission_percentage,
                    grace_period_days = :grace_period_days,
                    status = :status,
                    description = :description,
                    installment_type = :installment_type,
                    monthly_increase_amount = :monthly_increase_amount,
                    step_up_config = :step_up_config,
                    auctions = :auctions,
                    is_configured = :is_configured,
                    enrolled_member_ids = :enrolled_member_ids,
                    month_member_assignments = :month_member_assignments,
                    month_overrides = :month_overrides,
                    month_statuses = :month_statuses,
                    month_payouts = :month_payouts
                WHERE id = :id AND company_id = :company_id
            ");
            $uStmt->execute($params);
            jsonResponse(['success' => true, 'id' => $id, 'message' => "Chit updated successfully"]);
        }

        $stmt = $pdo->prepare("
            INSERT INTO chits (
                id, company_id, name, chit_amount, duration_months, members_count,
                monthly_installment, base_monthly_amount, initial_bid_amount,
                bid_reduction_method, bid_reduction_value, collected_amount,
                pending_amount, start_date, end_date, commission_percentage,
                grace_period_days, status, description, installment_type,
                monthly_increase_amount, step_up_config, auctions, is_configured,
                enrolled_member_ids, month_member_assignments, month_overrides,
                month_statuses, month_payouts
            ) VALUES (
                :id, :company_id, :name, :chit_amount, :duration_months, :members_count,
                :monthly_installment, :base_monthly_amount, :initial_bid_amount,
                :bid_reduction_method, :bid_reduction_value, :collected_amount,
                :pending_amount, :start_date, :end_date, :commission_percentage,
                :grace_period_days, :status, :description, :installment_type,
                :monthly_increase_amount, :step_up_config, :auctions, :is_configured,
                :enrolled_member_ids, :month_member_assignments, :month_overrides,
                :month_statuses, :month_payouts
            )
        ");

        $stmt->execute($params);

        jsonResponse(['success' => true, 'id' => $id, 'message' => "Chit created successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to create chit: " . $e->getMessage(), 500);
    }
}

// 3. UPDATE CHIT
if ($action === 'update') {
    requirePermission($session, 'CHITS_EDIT');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    if (empty($id)) {
        jsonError("Chit ID is required", 400);
    }

    try {
        $chk = $pdo->prepare("SELECT id FROM chits WHERE id = :id AND company_id = :company_id LIMIT 1");
        $chk->execute(['id' => $id, 'company_id' => $companyId]);
        if (!$chk->fetch()) {
            jsonError("Chit not found or does not belong to your company", 404);
        }

        $fields = [];
        $params = ['id' => $id, 'company_id' => $companyId];

        $fieldMap = [
            'name' => 'name',
            'chitAmount' => 'chit_amount',
            'durationMonths' => 'duration_months',
            'membersCount' => 'members_count',
            'monthlyInstallment' => 'monthly_installment',
            'baseMonthlyAmount' => 'base_monthly_amount',
            'initialBidAmount' => 'initial_bid_amount',
            'bidReductionMethod' => 'bid_reduction_method',
            'bidReductionValue' => 'bid_reduction_value',
            'collectedAmount' => 'collected_amount',
            'pendingAmount' => 'pending_amount',
            'startDate' => 'start_date',
            'endDate' => 'end_date',
            'commissionPercentage' => 'commission_percentage',
            'gracePeriodDays' => 'grace_period_days',
            'status' => 'status',
            'description' => 'description',
            'installmentType' => 'installment_type',
            'monthlyIncreaseAmount' => 'monthly_increase_amount',
        ];

        foreach ($fieldMap as $jsKey => $dbCol) {
            if (isset($input[$jsKey])) {
                $fields[] = "$dbCol = :$dbCol";
                $params[$dbCol] = $input[$jsKey];
            }
        }

        $jsonMap = [
            'stepUpConfig' => 'step_up_config',
            'auctions' => 'auctions',
            'enrolledMemberIds' => 'enrolled_member_ids',
            'monthMemberAssignments' => 'month_member_assignments',
            'monthOverrides' => 'month_overrides',
            'monthStatuses' => 'month_statuses',
            'monthPayouts' => 'month_payouts',
        ];

        foreach ($jsonMap as $jsKey => $dbCol) {
            if (array_key_exists($jsKey, $input)) {
                $fields[] = "$dbCol = :$dbCol";
                $params[$dbCol] = !empty($input[$jsKey]) ? json_encode($input[$jsKey]) : null;
            }
        }

        if (isset($input['isConfigured'])) {
            $fields[] = "is_configured = :is_configured";
            $params['is_configured'] = $input['isConfigured'] ? 1 : 0;
        }

        if (!empty($fields)) {
            $sql = "UPDATE chits SET " . implode(', ', $fields) . " WHERE id = :id AND company_id = :company_id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        jsonResponse(['success' => true, 'id' => $id, 'message' => "Chit updated successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to update chit: " . $e->getMessage(), 500);
    }
}

// 4. DELETE CHIT
if ($action === 'delete') {
    requirePermission($session, 'CHITS_DELETE');
    $input = getJsonInput();
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        jsonError("Chit ID is required for delete", 400);
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM chits WHERE id = :id AND company_id = :company_id");
        $stmt->execute(['id' => $id, 'company_id' => $companyId]);

        if ($stmt->rowCount() === 0) {
            jsonError("Chit not found or does not belong to your company", 404);
        }

        jsonResponse(['success' => true, 'message' => "Chit deleted successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to delete chit: " . $e->getMessage(), 500);
    }
}

jsonError("Unknown action", 404);
