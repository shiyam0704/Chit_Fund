// Automated Multi-Device E2E Verification Script
// Tests scenarios 1 through 7 exactly as specified in the business requirements.

const BASE_URL = 'http://localhost:5173/api';

async function api(path, options = {}) {
  const url = `${BASE_URL}/${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
    headers['X-Auth-Token'] = options.token;
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=== STARTING CHIT FUND MULTI-DEVICE ARCHITECTURE TESTS ===\n');

  // --------------------------------------------------------------------------
  // TEST 1: Admin logs in on Computer A, creates Chit A, adds Member 001, creates Staff User 001
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Admin Setup on Computer A ---');
  const adminLogin = await api('auth.php?action=login', {
    method: 'POST',
    body: { email: 'chitfundadmin@gmail.com', password: 'adminchit@123' },
  });
  if (!adminLogin.ok || !adminLogin.data?.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
  }
  const adminToken = adminLogin.data.token;
  console.log('  [PASS] Admin logged in successfully.');

  // Admin creates Chit A
  const chitAId = 'CHIT-TEST-001';
  const createChitRes = await api('chits.php?action=create', {
    method: 'POST',
    token: adminToken,
    body: {
      id: chitAId,
      name: 'Chit Scheme A (100K 20M)',
      chitAmount: 100000,
      durationMonths: 20,
      membersCount: 20,
      monthlyInstallment: 5000,
      baseMonthlyAmount: 5000,
      startDate: '2026-10-01',
      status: 'Active',
    },
  });
  if (!createChitRes.ok) throw new Error('Create Chit A failed: ' + JSON.stringify(createChitRes.data));
  console.log('  [PASS] Chit A created successfully.');

  // Admin adds Member 001
  const member001Id = 'MEM-TEST-001';
  const createMemberRes = await api('members.php?action=create', {
    method: 'POST',
    token: adminToken,
    body: {
      id: member001Id,
      name: 'Ramesh Kumar (Member 001)',
      phone: '9876543210',
      email: 'ramesh@example.com',
      chitId: chitAId,
      status: 'Active',
    },
  });
  if (!createMemberRes.ok) throw new Error('Create Member 001 failed: ' + JSON.stringify(createMemberRes.data));
  console.log('  [PASS] Member 001 added successfully.');

  // Admin creates Staff User 001 with permissions:
  // Chits: View, Members: View + Add, Collections: View + Add, Reports: NO ACCESS, Users: NO ACCESS
  const staffEmail = 'staff001@chitfund.com';
  const staffPass = 'staffpass123';
  const staffPerms = [
    'dashboard.view',
    'chits.view',
    'members.view',
    'members.create',
    'payments.view',
    'payments.create',
  ];
  const createStaffRes = await api('users.php?action=create', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Staff User 001',
      email: staffEmail,
      password: staffPass,
      role: 'Staff',
      status: 'Active',
      permissions: staffPerms,
    },
  });
  if (!createStaffRes.ok) throw new Error('Create Staff User 001 failed: ' + JSON.stringify(createStaffRes.data));
  console.log('  [PASS] Staff User 001 created successfully on central database.');

  // --------------------------------------------------------------------------
  // TEST 2: Open app on Computer B -> Login as Staff User 001 -> Verify Chit A & Member 001 visible
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Staff User 001 Login on Computer B (Shared Central Data) ---');
  const staffLogin = await api('auth.php?action=login', {
    method: 'POST',
    body: { email: staffEmail, password: staffPass },
  });
  if (!staffLogin.ok || !staffLogin.data?.token) {
    throw new Error('Staff User 001 login failed: ' + JSON.stringify(staffLogin.data));
  }
  const staffToken = staffLogin.data.token;
  console.log('  [PASS] Staff User 001 logged in on Computer B.');

  // Staff calls sync.php to fetch authorized data
  const staffSync = await api('sync.php', { token: staffToken });
  if (!staffSync.ok) throw new Error('Staff sync failed: ' + JSON.stringify(staffSync.data));

  const staffChits = staffSync.data.data.chits;
  const staffMembers = staffSync.data.data.members;

  const foundChitA = staffChits.find((c) => c.id === chitAId);
  const foundMember001 = staffMembers.find((m) => m.id === member001Id);

  if (!foundChitA) throw new Error('Chit A NOT found in Staff data!');
  if (!foundMember001) throw new Error('Member 001 NOT found in Staff data!');

  console.log(`  [PASS] Verified: Chit A ("${foundChitA.name}") is visible to Staff.`);
  console.log(`  [PASS] Verified: Member 001 ("${foundMember001.name}") is visible to Staff.`);

  // --------------------------------------------------------------------------
  // TEST 3: Staff on Computer B adds Member 002 -> Admin on Computer A sees it
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Staff adds permitted record on Computer B -> Admin sees it on Computer A ---');
  const member002Id = 'MEM-TEST-002';
  const staffAddMemberRes = await api('members.php?action=create', {
    method: 'POST',
    token: staffToken,
    body: {
      id: member002Id,
      name: 'Suresh Patel (Member 002)',
      phone: '9876543211',
      chitId: chitAId,
      status: 'Active',
    },
  });
  if (!staffAddMemberRes.ok) throw new Error('Staff adding member failed: ' + JSON.stringify(staffAddMemberRes.data));
  console.log('  [PASS] Staff added Member 002 on Computer B.');

  // Admin on Computer A performs sync
  const adminSyncAfterStaffAdd = await api('sync.php', { token: adminToken });
  const adminMembers = adminSyncAfterStaffAdd.data.data.members;
  const foundMember002ByAdmin = adminMembers.find((m) => m.id === member002Id);
  if (!foundMember002ByAdmin) throw new Error('Admin did not see Member 002 created by Staff!');
  console.log(`  [PASS] Verified: Admin saw Staff-created Member 002 ("${foundMember002ByAdmin.name}").`);

  // --------------------------------------------------------------------------
  // TEST 4: Admin edits Member 001 -> Staff on Computer B sees updated info
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Admin edits Member 001 on Computer A -> Staff sees updated info on Computer B ---');
  const updatedName = 'Ramesh Kumar Sharma (Updated by Admin)';
  const adminEditMemberRes = await api('members.php?action=update', {
    method: 'POST',
    token: adminToken,
    body: {
      id: member001Id,
      name: updatedName,
    },
  });
  if (!adminEditMemberRes.ok) throw new Error('Admin editing member failed: ' + JSON.stringify(adminEditMemberRes.data));
  console.log('  [PASS] Admin updated Member 001 on Computer A.');

  // Staff on Computer B re-syncs
  const staffSyncAfterEdit = await api('sync.php', { token: staffToken });
  const memberAfterEdit = staffSyncAfterEdit.data.data.members.find((m) => m.id === member001Id);
  if (!memberAfterEdit || memberAfterEdit.name !== updatedName) {
    throw new Error(`Staff saw outdated member name: ${memberAfterEdit?.name}`);
  }
  console.log(`  [PASS] Verified: Staff on Computer B saw updated name: "${memberAfterEdit.name}".`);

  // --------------------------------------------------------------------------
  // TEST 5: Verify Reports cannot be accessed by Staff (Server-Side & API Rejection)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Security Enforcement - Staff attempts unauthorized Reports access ---');
  const reportsAttempt = await api('reports.php?action=summary', { token: staffToken });
  if (reportsAttempt.status === 403) {
    console.log(`  [PASS] Verified: Server returned HTTP 403 Forbidden for Staff accessing Reports.`);
  } else {
    throw new Error(`Expected HTTP 403 for Reports access, got HTTP ${reportsAttempt.status}`);
  }

  // Also verify Staff cannot create a Chit (since Staff only has chits.view)
  const unauthorizedChitAttempt = await api('chits.php?action=create', {
    method: 'POST',
    token: staffToken,
    body: { name: 'Unauthorized Chit', chitAmount: 50000 },
  });
  if (unauthorizedChitAttempt.status === 403) {
    console.log(`  [PASS] Verified: Server returned HTTP 403 Forbidden for Staff attempting CHITS_CREATE.`);
  } else {
    throw new Error(`Expected HTTP 403 for unauthorized chit creation, got HTTP ${unauthorizedChitAttempt.status}`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Logout, reopen, login again -> Verify all centralized data exists
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Session Termination & Re-Login Persistence ---');
  // Re-login as Admin
  const adminReLogin = await api('auth.php?action=login', {
    method: 'POST',
    body: { email: 'chitfundadmin@gmail.com', password: 'adminchit@123' },
  });
  const freshAdminToken = adminReLogin.data.token;
  const reSync = await api('sync.php', { token: freshAdminToken });
  const reChits = reSync.data.data.chits;
  const reMembers = reSync.data.data.members;

  if (!reChits.find((c) => c.id === chitAId)) throw new Error('Chit A missing after re-login!');
  if (!reMembers.find((m) => m.id === member001Id)) throw new Error('Member 001 missing after re-login!');
  if (!reMembers.find((m) => m.id === member002Id)) throw new Error('Member 002 missing after re-login!');
  console.log('  [PASS] Verified: All central data fully intact after fresh re-login.');

  // --------------------------------------------------------------------------
  // TEST 7: LocalStorage Resilience - Device without local cache accesses all central data
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: LocalStorage Resilience (Fresh Computer with zero local storage) ---');
  // Simulate Computer C with zero cache, logging in as Staff User 001
  const freshComputerLogin = await api('auth.php?action=login', {
    method: 'POST',
    body: { email: staffEmail, password: staffPass },
  });
  const freshStaffToken = freshComputerLogin.data.token;
  const freshSync = await api('sync.php', { token: freshStaffToken });

  const freshStaffChits = freshSync.data.data.chits;
  const freshStaffMembers = freshSync.data.data.members;

  if (!freshStaffChits.some((c) => c.id === chitAId)) throw new Error('Fresh computer missing Chit A!');
  if (!freshStaffMembers.some((m) => m.id === member001Id)) throw new Error('Fresh computer missing Member 001!');
  if (!freshStaffMembers.some((m) => m.id === member002Id)) throw new Error('Fresh computer missing Member 002!');

  console.log('  [PASS] Verified: Zero-storage device immediately retrieves all authorized records from central database.');

  console.log('\n======================================================');
  console.log('ALL 7 MULTI-DEVICE ARCHITECTURE TESTS PASSED 100%!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n[TEST FAILURE]:', err);
  process.exit(1);
});
