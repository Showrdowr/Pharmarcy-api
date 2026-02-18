
interface ApiResponse {
  success?: boolean;
  message?: string;
  user?: Record<string, unknown>;
  token?: string;
  [key: string]: unknown;
}

const API_BASE = 'http://localhost:3001/api/v1';

async function testRegistration() {
  const testEmail = `test_${Date.now()}@example.com`;
  const testUsername = `user_${Date.now()}`;

  console.log('--- Phase 1: Successful Registration ---');
  const res1 = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Test User',
      email: testEmail,
      username: testUsername,
      password: 'password123',
      role: 'member'
    })
  });
  const data1 = await res1.json() as ApiResponse;
  console.log('Result 1:', data1);

  console.log('\n--- Phase 2: Duplicate Email Registration ---');
  const res2 = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Another User',
      email: testEmail, // same email
      username: `another_${Date.now()}`,
      password: 'password123',
      role: 'member'
    })
  });
  const data2 = await res2.json() as ApiResponse;
  console.log('Result 2 (Should Fail):', data2);
  if (data2.message === 'ชื่อ / อีเมล ของคุณซ้ำกับผู้ใช้งานคนอื่น') {
    console.log('[PASS] Duplicate email message is correct');
  } else {
    console.log('[FAIL] Duplicate email message is incorrect:', data2.message);
  }

  console.log('\n--- Phase 3: Duplicate Username Registration ---');
  const res3 = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Another User',
      email: `another_${Date.now()}@example.com`,
      username: testUsername, // same username
      password: 'password123',
      role: 'member'
    })
  });
  const data3 = await res3.json() as ApiResponse;
  console.log('Result 3 (Should Fail):', data3);
  if (data3.message === 'ชื่อ / อีเมล ของคุณซ้ำกับผู้ใช้งานคนอื่น') {
    console.log('[PASS] Duplicate username message is correct');
  } else {
    console.log('[FAIL] Duplicate username message is incorrect:', data3.message);
  }

  console.log('\n--- Phase 4: Login Failure ---');
  const res4 = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'wrong_password'
    })
  });
  const data4 = await res4.json() as ApiResponse;
  console.log('Result 4 (Should Fail):', data4);
  if (data4.message === 'Login failed') {
    console.log('[PASS] Login failure message is correct');
  } else {
    console.log('[FAIL] Login failure message is incorrect:', data4.message);
  }
}

testRegistration().catch(console.error);
