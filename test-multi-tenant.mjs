// test-multi-tenant.mjs
// Comprehensive verification of Multi-Tenant Company Isolation

const BASE_URL = 'http://localhost:5173/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, text };
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING MULTI-TENANT ISOLATION TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: Register and Setup Company A
  console.log('--- TEST 1: Company A Setup ---');
  const compARes = await request('companies.php?action=register', {
    method: 'POST',
    body: JSON.stringify({
      companyId: 'CMP-APEX-001',
      companyName: 'Apex Chits Ltd',
      adminName: 'Apex Admin',
      adminEmail: 'admin@apex.com',
      adminPassword: 'password123',
    }),
  });
  assert(compARes.ok || compARes.status === 409, 'Company A registered (or already initialized)');

  // Login Admin A
  const loginARes = await request('auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@apex.com', password: 'password123' }),
  });
  assert(loginARes.ok && loginARes.data?.token, 'Admin A logged in');
  const tokenA = loginARes.data.token;
  assert(loginARes.data.user.companyId === 'CMP-APEX-001', 'Admin A has companyId CMP-APEX-001');

  // Admin A creates Chit A1
  const chitARes = await request('chits.php?action=create', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      id: 'CHIT-APEX-101',
      name: 'Apex Gold 5L',
      chitAmount: 500000,
      durationMonths: 20,
      monthlyInstallment: 25000,
      memberCount: 20,
    }),
  });
  assert(chitARes.ok && chitARes.data?.success, 'Admin A created Chit A1');

  // Admin A creates Member A1
  const memARes = await request('members.php?action=create', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      id: 'MEM-APEX-001',
      chitId: 'CHIT-APEX-101',
      name: 'Apex Member One',
      phone: '9876543210',
    }),
  });
  assert(memARes.ok && memARes.data?.success, 'Admin A created Member A1');

  // Admin A creates Staff A
  const staffARes = await request('users.php?action=create', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      name: 'Apex Staff John',
      email: 'staff@apex.com',
      password: 'password123',
      role: 'Staff',
      status: 'Active',
      permissions: ['chits.view', 'members.view', 'collections.view', 'collections.create'],
    }),
  });
  assert(staffARes.ok || staffARes.status === 409, 'Admin A created Staff A');
  if (staffARes.ok) {
    assert(staffARes.data.user.companyId === 'CMP-APEX-001', 'Staff A inherited Company A id');
  }

  // Ensure Staff A has collections.create permission configured
  const usersListCheck = await request('users.php?action=list', { token: tokenA });
  const staffObj = usersListCheck.data.users?.find((u) => u.email === 'staff@apex.com');
  if (staffObj) {
    await request('users.php?action=update_permissions', {
      method: 'POST',
      token: tokenA,
      body: JSON.stringify({
        id: staffObj.id,
        permissions: ['chits.view', 'members.view', 'collections.view', 'collections.create', 'payments.view', 'payments.create'],
      }),
    });
  }

  // Login Staff A (Simulating Device / Session 2)
  const loginStaffARes = await request('auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify({ email: 'staff@apex.com', password: 'password123' }),
  });
  assert(loginStaffARes.ok && loginStaffARes.data?.token, 'Staff A logged in');
  const tokenStaffA = loginStaffARes.data.token;

  // Staff A syncs data
  const syncStaffARes = await request('sync.php', { token: tokenStaffA });
  assert(syncStaffARes.ok && syncStaffARes.data?.success, 'Staff A synced data');
  const staffAData = syncStaffARes.data.data;
  assert(staffAData.chits.some((c) => c.id === 'CHIT-APEX-101'), 'Staff A sees Chit A1');
  assert(staffAData.members.some((m) => m.id === 'MEM-APEX-001'), 'Staff A sees Member A1');


  // TEST 2: Register and Setup Company B
  console.log('\n--- TEST 2: Company B Setup ---');
  const compBRes = await request('companies.php?action=register', {
    method: 'POST',
    body: JSON.stringify({
      companyId: 'CMP-BHARAT-002',
      companyName: 'Bharat Chits Ltd',
      adminName: 'Bharat Admin',
      adminEmail: 'admin@bharat.com',
      adminPassword: 'password123',
    }),
  });
  assert(compBRes.ok || compBRes.status === 409, 'Company B registered (or already initialized)');

  // Login Admin B
  const loginBRes = await request('auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@bharat.com', password: 'password123' }),
  });
  assert(loginBRes.ok && loginBRes.data?.token, 'Admin B logged in');
  const tokenB = loginBRes.data.token;
  assert(loginBRes.data.user.companyId === 'CMP-BHARAT-002', 'Admin B has companyId CMP-BHARAT-002');

  // Admin B creates Chit B1
  const chitBRes = await request('chits.php?action=create', {
    method: 'POST',
    token: tokenB,
    body: JSON.stringify({
      id: 'CHIT-BHARAT-201',
      name: 'Bharat Silver 2L',
      chitAmount: 200000,
      durationMonths: 10,
      monthlyInstallment: 20000,
      memberCount: 10,
    }),
  });
  assert(chitBRes.ok && chitBRes.data?.success, 'Admin B created Chit B1');

  // Admin B creates Member B1
  const memBRes = await request('members.php?action=create', {
    method: 'POST',
    token: tokenB,
    body: JSON.stringify({
      id: 'MEM-BHARAT-001',
      chitId: 'CHIT-BHARAT-201',
      name: 'Bharat Member Priya',
      phone: '9123456789',
    }),
  });
  assert(memBRes.ok && memBRes.data?.success, 'Admin B created Member B1');

  // Admin B creates Staff B
  const staffBRes = await request('users.php?action=create', {
    method: 'POST',
    token: tokenB,
    body: JSON.stringify({
      name: 'Bharat Staff Ravi',
      email: 'staff@bharat.com',
      password: 'password123',
      role: 'Staff',
      status: 'Active',
      permissions: ['chits.view', 'members.view', 'collections.view'],
    }),
  });
  assert(staffBRes.ok || staffBRes.status === 409, 'Admin B created Staff B');
  if (staffBRes.ok) {
    assert(staffBRes.data.user.companyId === 'CMP-BHARAT-002', 'Staff B inherited Company B id');
  }

  // Login Staff B (Simulating Device / Session 3)
  const loginStaffBRes = await request('auth.php?action=login', {
    method: 'POST',
    body: JSON.stringify({ email: 'staff@bharat.com', password: 'password123' }),
  });
  assert(loginStaffBRes.ok && loginStaffBRes.data?.token, 'Staff B logged in');
  const tokenStaffB = loginStaffBRes.data.token;

  // Staff B syncs data
  const syncStaffBRes = await request('sync.php', { token: tokenStaffB });
  assert(syncStaffBRes.ok && syncStaffBRes.data?.success, 'Staff B synced data');
  const staffBData = syncStaffBRes.data.data;
  assert(staffBData.chits.some((c) => c.id === 'CHIT-BHARAT-201'), 'Staff B sees Chit B1');
  assert(staffBData.members.some((m) => m.id === 'MEM-BHARAT-001'), 'Staff B sees Member B1');


  // TEST 3: Cross-Company Isolation Verification
  console.log('\n--- TEST 3: Strict Cross-Company Isolation ---');
  // Check Company A vantage point
  assert(
    !staffAData.chits.some((c) => c.id === 'CHIT-BHARAT-201'),
    'Company A data sync DOES NOT contain Company B Chit B1 (0% leakage)'
  );
  assert(
    !staffAData.members.some((m) => m.id === 'MEM-BHARAT-001'),
    'Company A data sync DOES NOT contain Company B Member B1 (0% leakage)'
  );

  // Check Company B vantage point
  assert(
    !staffBData.chits.some((c) => c.id === 'CHIT-APEX-101'),
    'Company B data sync DOES NOT contain Company A Chit A1 (0% leakage)'
  );
  assert(
    !staffBData.members.some((m) => m.id === 'MEM-APEX-001'),
    'Company B data sync DOES NOT contain Company A Member A1 (0% leakage)'
  );

  // Check Users list isolation
  const usersListARes = await request('users.php?action=list', { token: tokenA });
  const usersA = usersListARes.data.users || [];
  assert(
    usersA.every((u) => u.companyId === 'CMP-APEX-001'),
    'Admin A users list only contains Company A accounts'
  );
  assert(
    !usersA.some((u) => u.email === 'admin@bharat.com' || u.email === 'staff@bharat.com'),
    'Admin A cannot see Company B users or admin'
  );

  const usersListBRes = await request('users.php?action=list', { token: tokenB });
  const usersB = usersListBRes.data.users || [];
  assert(
    usersB.every((u) => u.companyId === 'CMP-BHARAT-002'),
    'Admin B users list only contains Company B accounts'
  );
  assert(
    !usersB.some((u) => u.email === 'admin@apex.com' || u.email === 'staff@apex.com'),
    'Admin B cannot see Company A users or admin'
  );


  // TEST 4: IDOR Protection on Direct Resource Mutations
  console.log('\n--- TEST 4: IDOR Protection on Resource Mutation ---');
  // Admin A tries to delete Company B's Chit B1
  const illegalChitDelete = await request('chits.php?action=delete', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({ id: 'CHIT-BHARAT-201' }),
  });
  assert(
    !illegalChitDelete.ok || !illegalChitDelete.data?.success,
    'Admin A CANNOT delete Company B Chit B1 (Blocked by server tenant scoping)'
  );

  // Admin A tries to update Company B's Member B1
  const illegalMemUpdate = await request('members.php?action=update', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({ id: 'MEM-BHARAT-001', name: 'Hacked Name' }),
  });
  assert(
    !illegalMemUpdate.ok || !illegalMemUpdate.data?.success,
    'Admin A CANNOT update Company B Member B1 (Blocked by server tenant scoping)'
  );

  // Admin A tries to delete Company B's Staff B user account
  const staffBUser = usersB.find((u) => u.email === 'staff@bharat.com');
  if (staffBUser) {
    const illegalUserDelete = await request('users.php?action=delete', {
      method: 'POST',
      token: tokenA,
      body: JSON.stringify({ id: staffBUser.id }),
    });
    assert(
      !illegalUserDelete.ok || !illegalUserDelete.data?.success,
      'Admin A CANNOT delete Company B Staff B user account'
    );
  }

  // Verify Member B1 name remains pristine
  const syncBCheck = await request('sync.php', { token: tokenStaffB });
  const pristineMember = syncBCheck.data.data.members.find((m) => m.id === 'MEM-BHARAT-001');
  assert(pristineMember?.name === 'Bharat Member Priya', 'Company B data remained completely untouched');


  // TEST 5: Cross-Entity Foreign Key Validation
  console.log('\n--- TEST 5: Cross-Entity Foreign Key Isolation ---');
  // Admin A tries to create a Member referencing Company B's Chit B1
  const crossEntityMember = await request('members.php?action=create', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      name: 'Infiltrator Member',
      phone: '9999999999',
      chitId: 'CHIT-BHARAT-201', // Chit belonging to Company B!
    }),
  });
  assert(
    !crossEntityMember.ok || !crossEntityMember.data?.success,
    'Server REJECTS member creation referencing another company chit'
  );

  // Admin A tries to record a payment transaction referencing Company B's Chit B1
  const crossEntityTxn = await request('transactions.php?action=create', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      chitId: 'CHIT-BHARAT-201', // Chit belonging to Company B!
      memberId: 'MEM-APEX-001',
      amount: 5000,
      paymentMode: 'Cash',
      receiptNo: 'REC-TEST-001',
    }),
  });
  assert(
    !crossEntityTxn.ok || !crossEntityTxn.data?.success,
    'Server REJECTS transaction referencing another company chit'
  );


  // TEST 6: Client companyId Spoofing Rejection
  console.log('\n--- TEST 6: Spoofed companyId in Payload Ignored ---');
  const uniqueEmail = `spoofed_${Date.now()}@apex.com`;
  const spoofedUserRes = await request('users.php?action=create', {
    method: 'POST',
    token: tokenA,
    body: JSON.stringify({
      companyId: 'CMP-BHARAT-002', // Attempted spoof
      name: 'Spoofed User',
      email: uniqueEmail,
      password: 'password123',
      role: 'Staff',
      status: 'Active',
      permissions: ['chits.view'],
    }),
  });
  assert(spoofedUserRes.ok && spoofedUserRes.data?.success, 'User created');
  assert(
    spoofedUserRes.data.user.companyId === 'CMP-APEX-001',
    'Server forced session companyId CMP-APEX-001 (spoofed CMP-BHARAT-002 ignored)'
  );


  // TEST 7: Multi-Device Shared Data Within Same Company Unbroken
  console.log('\n--- TEST 7: Intra-Company Multi-Device Flow Intact ---');
  const uniqueReceipt = `REC-APEX-${Date.now()}`;
  const collRes = await request('transactions.php?action=create', {
    method: 'POST',
    token: tokenStaffA,
    body: JSON.stringify({
      chitId: 'CHIT-APEX-101',
      memberId: 'MEM-APEX-001',
      amount: 25000,
      paymentMode: 'UPI',
      receiptNo: uniqueReceipt,
    }),
  });
  assert(collRes.ok && collRes.data?.success, 'Staff A recorded collection for Member A1');

  // Admin A syncs on their device -> immediately sees Staff A collection
  const syncAdminACheck = await request('sync.php', { token: tokenA });
  const adminATxns = syncAdminACheck.data.data.transactions || [];
  assert(
    adminATxns.some((t) => t.receiptNo === uniqueReceipt && t.amount === 25000),
    'Admin A on Device 1 immediately sees collection recorded by Staff A on Device 2'
  );

  // Company B sync check -> sees 0 collections from Company A
  const syncBFinal = await request('sync.php', { token: tokenB });
  const bTxns = syncBFinal.data.data.transactions || [];
  assert(
    !bTxns.some((t) => t.receiptNo === uniqueReceipt),
    'Company B has ZERO visibility into Company A collections'
  );

  console.log('\n====================================================');
  console.log('🎉 ALL 7 MULTI-TENANT ISOLATION TESTS PASSED 100%!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
