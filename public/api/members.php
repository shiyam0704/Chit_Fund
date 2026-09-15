<?php
// ==============================================================================
// MEMBERS API ENDPOINT (Scoped strictly to authenticated company)
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
    requirePermission($session, 'MEMBERS_CREATE');
    $input = getJsonInput();
    if (empty($input['name']) || empty($input['phone'])) {
        jsonError("Member name and phone number are required", 400);
    }

    try {
        $id = $input['id'] ?? ('MEM-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));

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
            'id' => $id,
            'company_id' => $companyId,
            'name' => $input['name'],
            'phone' => $input['phone'],
            'email' => $input['email'] ?? '',
            'address' => $input['address'] ?? '',
            'id_proof_type' => $input['idProofType'] ?? '',
            'id_proof_number' => $input['idProofNumber'] ?? '',
            'join_date' => !empty($input['joinDate']) ? $input['joinDate'] : date('Y-m-d'),
            'status' => $input['status'] ?? 'Active',
            'enrolled_chit_ids' => !empty($input['enrolledChitIds']) ? json_encode($input['enrolledChitIds']) : null,
            'chit_id' => $input['chitId'] ?? '',
            'chit_name' => $input['chitName'] ?? '',
            'notes' => $input['notes'] ?? '',
        ]);

        jsonResponse(['success' => true, 'id' => $id, 'message' => "Member created successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to create member: " . $e->getMessage(), 500);
    }
}

if ($action === 'update') {
    requirePermission($session, 'MEMBERS_EDIT');
    $input = getJsonInput();
    $id = $input['id'] ?? '';
    if (empty($id)) {
        jsonError("Member ID is required", 400);
    }

    try {
        $chk = $pdo->prepare("SELECT id FROM members WHERE id = :id AND company_id = :company_id LIMIT 1");
        $chk->execute(['id' => $id, 'company_id' => $companyId]);
        if (!$chk->fetch()) {
            jsonError("Member not found or unauthorized", 404);
        }

        $fields = [];
        $params = ['id' => $id, 'company_id' => $companyId];

        $fieldMap = [
            'name' => 'name',
            'phone' => 'phone',
            'email' => 'email',
            'address' => 'address',
            'idProofType' => 'id_proof_type',
            'idProofNumber' => 'id_proof_number',
            'joinDate' => 'join_date',
            'status' => 'status',
            'chitId' => 'chit_id',
            'chitName' => 'chit_name',
            'notes' => 'notes',
        ];

        foreach ($fieldMap as $jsKey => $dbCol) {
            if (isset($input[$jsKey])) {
                $fields[] = "$dbCol = :$dbCol";
                $params[$dbCol] = $input[$jsKey];
            }
        }

        if (array_key_exists('enrolledChitIds', $input)) {
            $fields[] = "enrolled_chit_ids = :enrolled_chit_ids";
            $params['enrolled_chit_ids'] = !empty($input['enrolledChitIds']) ? json_encode($input['enrolledChitIds']) : null;
        }

        if (!empty($fields)) {
            $sql = "UPDATE members SET " . implode(', ', $fields) . " WHERE id = :id AND company_id = :company_id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }

        jsonResponse(['success' => true, 'id' => $id, 'message' => "Member updated successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to update member: " . $e->getMessage(), 500);
    }
}

if ($action === 'delete') {
    requirePermission($session, 'MEMBERS_DELETE');
    $input = getJsonInput();
    $id = $input['id'] ?? ($_GET['id'] ?? '');
    if (empty($id)) {
        jsonError("Member ID is required", 400);
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM members WHERE id = :id AND company_id = :company_id");
        $stmt->execute(['id' => $id, 'company_id' => $companyId]);

        jsonResponse(['success' => true, 'message' => "Member deleted successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to delete member: " . $e->getMessage(), 500);
    }
}

jsonError("Unknown action", 404);
