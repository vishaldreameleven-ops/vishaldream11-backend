const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const BASE_URL = 'http://localhost:5000';
let adminToken = null;
let serverProcess = null;

// Helper to make HTTP requests
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, data: parsed, raw: data });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============ HEALTH CHECK ============
describe('Health Check', () => {
  it('GET /api/health - should return 200 OK', async () => {
    const res = await makeRequest('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'OK');
    assert.ok(res.data.timestamp);
    console.log('  PASS: Health check returns OK');
  });
});

// ============ ADMIN AUTH ============
describe('Admin Authentication', () => {
  it('POST /api/admin/login - should reject wrong credentials', async () => {
    const res = await makeRequest('POST', '/api/admin/login', {
      adminId: 'wrong',
      password: 'wrong'
    });
    assert.strictEqual(res.status, 401);
    assert.ok(res.data.message);
    console.log('  PASS: Wrong credentials rejected with 401');
  });

  it('POST /api/admin/login - should reject missing fields', async () => {
    const res = await makeRequest('POST', '/api/admin/login', {});
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Missing fields rejected with 401');
  });

  it('POST /api/admin/login - should accept correct credentials', async () => {
    const res = await makeRequest('POST', '/api/admin/login', {
      adminId: 'admin',
      password: 'admin123'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.message, 'Login successful');
    adminToken = res.data.token;
    console.log('  PASS: Correct credentials return token');
  });

  it('GET /api/admin/verify - should reject without token', async () => {
    const res = await makeRequest('GET', '/api/admin/verify');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: No token rejected with 401');
  });

  it('GET /api/admin/verify - should reject invalid token', async () => {
    const res = await makeRequest('GET', '/api/admin/verify', null, {
      Authorization: 'Bearer invalidtoken123'
    });
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Invalid token rejected with 401');
  });

  it('GET /api/admin/verify - should accept valid token', async () => {
    const res = await makeRequest('GET', '/api/admin/verify', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.valid, true);
    console.log('  PASS: Valid token accepted');
  });
});

// ============ PUBLIC PLANS ============
describe('Plans (Public)', () => {
  it('GET /api/plans - should return array of plans', async () => {
    const res = await makeRequest('GET', '/api/plans');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    if (res.data.length > 0) {
      const plan = res.data[0];
      assert.ok(plan.id, 'Plan should have id');
      assert.ok(plan.name, 'Plan should have name');
      assert.ok(typeof plan.price === 'number', 'Plan should have numeric price');
      console.log(`  PASS: Returns ${res.data.length} plans with correct structure`);
    } else {
      console.log('  PASS: Returns empty array (no plans in DB)');
    }
  });

  it('GET /api/plans/:id - should return 404 for invalid ID', async () => {
    const res = await makeRequest('GET', '/api/plans/000000000000000000000000');
    assert.strictEqual(res.status, 404);
    console.log('  PASS: Invalid plan ID returns 404');
  });
});

// ============ PUBLIC RANKS ============
describe('Ranks (Public)', () => {
  it('GET /api/ranks - should return array of ranks', async () => {
    const res = await makeRequest('GET', '/api/ranks');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    if (res.data.length > 0) {
      const rank = res.data[0];
      assert.ok(rank.id, 'Rank should have id');
      assert.ok(rank.name, 'Rank should have name');
      assert.ok(typeof rank.rankNumber === 'number', 'Rank should have rankNumber');
      console.log(`  PASS: Returns ${res.data.length} ranks with correct structure`);
    } else {
      console.log('  PASS: Returns empty array (no ranks in DB)');
    }
  });

  it('GET /api/ranks/:id - should return 404 for invalid ID', async () => {
    const res = await makeRequest('GET', '/api/ranks/000000000000000000000000');
    assert.strictEqual(res.status, 404);
    console.log('  PASS: Invalid rank ID returns 404');
  });
});

// ============ PUBLIC CONTENT ============
describe('Content (Public)', () => {
  it('GET /api/content/videos - should return array', async () => {
    const res = await makeRequest('GET', '/api/content/videos');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    console.log(`  PASS: Returns ${res.data.length} videos`);
  });

  it('GET /api/content/winners - should return array', async () => {
    const res = await makeRequest('GET', '/api/content/winners');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    console.log(`  PASS: Returns ${res.data.length} winners`);
  });
});

// ============ PUBLIC SETTINGS ============
describe('Public Settings', () => {
  it('GET /api/admin/public-settings - should return settings object', async () => {
    const res = await makeRequest('GET', '/api/admin/public-settings');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data);
    assert.ok(typeof res.data === 'object');
    // Should have expected public fields
    assert.ok('whatsappNumber' in res.data || 'upiId' in res.data);
    console.log('  PASS: Public settings returned');
  });

  it('GET /api/admin/featured-match - should return match data', async () => {
    const res = await makeRequest('GET', '/api/admin/featured-match');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data);
    console.log('  PASS: Featured match data returned');
  });

  it('GET /api/admin/timer - should return timer data', async () => {
    const res = await makeRequest('GET', '/api/admin/timer');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data);
    assert.ok('timerDeadline' in res.data);
    console.log('  PASS: Timer data returned');
  });

  it('GET /api/admin/rank-promo-image - should return promo image data', async () => {
    const res = await makeRequest('GET', '/api/admin/rank-promo-image');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data);
    assert.ok('rankPromoImage' in res.data);
    console.log('  PASS: Rank promo image data returned');
  });
});

// ============ ORDER VALIDATION ============
describe('Order Validation', () => {
  it('POST /api/orders - should reject empty body', async () => {
    const res = await makeRequest('POST', '/api/orders', {});
    assert.ok(res.status >= 400 && res.status < 500);
    console.log('  PASS: Empty order rejected with', res.status);
  });

  it('POST /api/orders - should reject missing name', async () => {
    const res = await makeRequest('POST', '/api/orders', {
      planId: '000000000000000000000000',
      phone: '9876543210',
      utrNumber: '1234567890123',
      planName: 'Test',
      amount: 100
    });
    assert.ok(res.status >= 400 && res.status < 500);
    console.log('  PASS: Missing name rejected');
  });

  it('POST /api/orders - should reject missing phone', async () => {
    const res = await makeRequest('POST', '/api/orders', {
      planId: '000000000000000000000000',
      name: 'Test User',
      utrNumber: '1234567890123',
      planName: 'Test',
      amount: 100
    });
    assert.ok(res.status >= 400 && res.status < 500);
    console.log('  PASS: Missing phone rejected');
  });

  it('POST /api/orders - should reject missing UTR', async () => {
    const res = await makeRequest('POST', '/api/orders', {
      planId: '000000000000000000000000',
      name: 'Test User',
      phone: '9876543210',
      planName: 'Test',
      amount: 100
    });
    assert.ok(res.status >= 400 && res.status < 500);
    console.log('  PASS: Missing UTR rejected');
  });

  it('POST /api/orders - should reject invalid phone number', async () => {
    const res = await makeRequest('POST', '/api/orders', {
      planId: '000000000000000000000000',
      name: 'Test User',
      phone: '1234',
      utrNumber: '1234567890123',
      planName: 'Test',
      amount: 100
    });
    assert.ok(res.status >= 400 && res.status < 500);
    console.log('  PASS: Invalid phone rejected');
  });

  it('POST /api/orders - should reject short UTR', async () => {
    const res = await makeRequest('POST', '/api/orders', {
      planId: '000000000000000000000000',
      name: 'Test User',
      phone: '9876543210',
      utrNumber: '123',
      planName: 'Test',
      amount: 100
    });
    assert.ok(res.status >= 400 && res.status < 500);
    console.log('  PASS: Short UTR rejected');
  });

  it('POST /api/orders/check - should return 404 for non-existent order', async () => {
    const res = await makeRequest('POST', '/api/orders/check', {
      orderId: 'ORD_NONEXISTENT_123',
      phone: '0000000000'
    });
    assert.strictEqual(res.status, 404);
    console.log('  PASS: Non-existent order returns 404');
  });
});

// ============ ADMIN PROTECTED ROUTES ============
describe('Admin Protected Routes (without token)', () => {
  it('GET /api/admin/dashboard - should reject without auth', async () => {
    const res = await makeRequest('GET', '/api/admin/dashboard');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Dashboard rejected without auth');
  });

  it('GET /api/admin/settings - should reject without auth', async () => {
    const res = await makeRequest('GET', '/api/admin/settings');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Settings rejected without auth');
  });

  it('GET /api/orders - should reject without auth', async () => {
    const res = await makeRequest('GET', '/api/orders');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Orders list rejected without auth');
  });

  it('GET /api/plans/all - should reject without auth', async () => {
    const res = await makeRequest('GET', '/api/plans/all');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Plans/all rejected without auth');
  });

  it('GET /api/ranks/all - should reject without auth', async () => {
    const res = await makeRequest('GET', '/api/ranks/all');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Ranks/all rejected without auth');
  });

  it('GET /api/content/videos/all - should reject without auth', async () => {
    const res = await makeRequest('GET', '/api/content/videos/all');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Videos/all rejected without auth');
  });

  it('GET /api/content/winners/all - should reject without auth', async () => {
    const res = await makeRequest('GET', '/api/content/winners/all');
    assert.strictEqual(res.status, 401);
    console.log('  PASS: Winners/all rejected without auth');
  });
});

// ============ ADMIN DASHBOARD (with token) ============
describe('Admin Dashboard (with auth)', () => {
  it('GET /api/admin/dashboard - should return stats', async () => {
    const res = await makeRequest('GET', '/api/admin/dashboard', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok('totalOrders' in res.data);
    assert.ok('pendingOrders' in res.data);
    assert.ok('approvedOrders' in res.data);
    assert.ok('rejectedOrders' in res.data);
    assert.ok('totalRevenue' in res.data);
    assert.ok('recentOrders' in res.data);
    assert.ok(typeof res.data.totalOrders === 'number');
    console.log(`  PASS: Dashboard returns stats (${res.data.totalOrders} total orders, revenue: ${res.data.totalRevenue})`);
  });

  it('GET /api/admin/dashboard?range=today - should filter by today', async () => {
    const res = await makeRequest('GET', '/api/admin/dashboard?range=today', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.dateRange, 'today');
    console.log('  PASS: Dashboard filters by today');
  });

  it('GET /api/admin/dashboard?range=week - should filter by week', async () => {
    const res = await makeRequest('GET', '/api/admin/dashboard?range=week', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.dateRange, 'week');
    console.log('  PASS: Dashboard filters by week');
  });

  it('GET /api/admin/settings - should return settings', async () => {
    const res = await makeRequest('GET', '/api/admin/settings', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data);
    console.log('  PASS: Admin settings returned');
  });

  it('GET /api/orders - should return orders list', async () => {
    const res = await makeRequest('GET', '/api/orders', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    console.log(`  PASS: Orders list returned (${res.data.length} orders)`);
  });

  it('GET /api/plans/all - should return all plans', async () => {
    const res = await makeRequest('GET', '/api/plans/all', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    console.log(`  PASS: All plans returned (${res.data.length})`);
  });

  it('GET /api/ranks/all - should return all ranks', async () => {
    const res = await makeRequest('GET', '/api/ranks/all', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    console.log(`  PASS: All ranks returned (${res.data.length})`);
  });

  it('GET /api/content/videos/all - should return all videos', async () => {
    const res = await makeRequest('GET', '/api/content/videos/all', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    console.log(`  PASS: All videos returned (${res.data.length})`);
  });

  it('GET /api/content/winners/all - should return all winners', async () => {
    const res = await makeRequest('GET', '/api/content/winners/all', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data));
    console.log(`  PASS: All winners returned (${res.data.length})`);
  });
});

// ============ 404 HANDLER ============
describe('404 Handler', () => {
  it('GET /api/nonexistent - should return 404', async () => {
    const res = await makeRequest('GET', '/api/nonexistent');
    assert.strictEqual(res.status, 404);
    console.log('  PASS: Unknown route returns 404');
  });
});
