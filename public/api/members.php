<?php
// ==============================================================================
// MEMBERS API ENDPOINT (Strict Multi-Tenant Scoping & Relationship Validation)
// ==============================================================================

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/middleware.php';

setCorsHeaders();
$session = authenticateUser();
$companyId = $session['companyId'];
$action = $_GET['action'] ?? 'list';
$pdo = Database::getConnection();

// 1. LIST MEMBERS
if ($action === 'list') {
    requirePermission($session, 'MEMBERS_VIEW');
    $stmt = $pdo->prepare("SELECT * FROM members WHERE company_id = :company_id ORDER BY created_at DESC");
    $stmt->execute(['company_id' => $companyId]);
    $raw = $stmt->fetchAll();
    jsonResponse(['success' => true, 'companyId' => $companyId, 'members' => $raw]);
}

// 2. CREATE MEMBER
if ($action === 'create') {
    requirePermission($session, 'MEMBERS_CREATE');
    $input = getJsonInput();
    if (empty($input['name']) || empty($input['phone'])) {
        jsonError("Member name and phone number are required", 400);
    }

    try {
        $chitId = !empty($input['chitId']) ? trim($input['chitId']) : '';
        $chitName = $input['chitName'] ?? '';

        // Cross-company validation: Member can only be linked to a Chit belonging to the same company!
        if (!empty($chitId)) {
            $cChk = $pdo->prepare("SELECT id, name FROM chits WHERE id = :chit_id AND company_id = :company_id LIMIT 1");
            $cChk->execute(['chit_id' => $chitId, 'company_id' => $companyId]);
            $matchedChit = $cChk->fetch();
            if (!$matchedChit) {
                jsonError("Invalid chit assignment: Chit does not exist or belongs to another company", 400);
            }
            if (empty($chitName)) {
                $chitName = $matchedChit['name'];
            }
        }

        $id = $input['id'] ?? ('MEM-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)));

        $params = [
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
            'chit_id' => $chitId,
            'chit_name' => $chitName,
            'notes' => $input['notes'] ?? '',
        ];

        // Check if member already exists
        $chk = $pdo->prepare("SELECT id, company_id FROM members WHERE id = :id LIMIT 1");
        $chk->execute(['id' => $id]);
        $existing = $chk->fetch();

        if ($existing) {
            if ($existing['company_id'] !== $companyId) {
                jsonError("Forbidden: Member exists under another company", 403);
            }

            $uStmt = $pdo->prepare("
                UPDATE members SET
                    company_id = :company_id,
                    name = :name,
                    phone = :phone,
                    email = :email,
                    address = :address,
                    id_proof_type = :id_proof_type,
                    id_proof_number = :id_proof_number,
                    join_date = :join_date,
                    status = :status,
                    enrolled_chit_ids = :enrolled_chit_ids,
                    chit_id = :chit_id,
                    chit_name = :chit_name,
                    notes = :notes
                WHERE id = :id AND company_id = :company_id
            ");
            $uStmt->execute($params);
            jsonResponse(['success' => true, 'id' => $id, 'message' => "Member updated successfully"]);
        }

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

        $stmt->execute($params);

        jsonResponse(['success' => true, 'id' => $id, 'message' => "Member created successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to create member: " . $e->getMessage(), 500);
    }
}

// 3. UPDATE MEMBER
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
            jsonError("Member not found or does not belong to your company", 404);
        }

        // Validate chit if updating chit_id
        if (!empty($input['chitId'])) {
            $cChk = $pdo->prepare("SELECT id FROM chits WHERE id = :chit_id AND company_id = :company_id LIMIT 1");
            $cChk->execute(['chit_id' => $input['chitId'], 'company_id' => $companyId]);
            if (!$cChk->fetch()) {
                jsonError("Invalid chit assignment: Chit does not exist or belongs to another company", 400);
            }
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

// 4. DELETE MEMBER
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

        if ($stmt->rowCount() === 0) {
            jsonError("Member not found or does not belong to your company", 404);
        }

        jsonResponse(['success' => true, 'message' => "Member deleted successfully"]);
    } catch (Exception $e) {
        jsonError("Failed to delete member: " . $e->getMessage(), 500);
    }
}

jsonError("Unknown action", 404);
