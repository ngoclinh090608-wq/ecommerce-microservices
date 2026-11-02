const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareDemo } = require('../scripts/prepare-demo');
const token = `header.${Buffer.from(JSON.stringify({ sub: '701' })).toString('base64url')}.signature`;
function fixture({ existing = false, quantity = 20, loginFailure = false, standard = false } = {}) {
  const calls = [];
  let promoted = !standard;
  let stock = quantity;
  const api = async (method, route, options = {}) => {
    calls.push({ method, route, ...options });
    if (route === '/api/auth/login') {
      if (loginFailure && options.body.username === 'demo_gold') throw Object.assign(new Error('wrong credentials'), { status: 401 });
      return { accessToken: token };
    }
    if (route === '/api/auth/register') {
      if (existing) throw Object.assign(new Error('duplicate'), { status: 409 });
      return { uid: 701 };
    }
    if (route === '/api/customers/701' && method === 'PUT') { assert.equal(options.body.mid, 9); promoted = true; return { uid: 701 }; }
    if (route === '/api/customers/701' && method === 'GET') return { uid: 701, mname: promoted ? 'Gold' : 'Standard', score: promoted ? 500 : 0, mid: promoted ? 9 : 1 };
    if (route === '/api/products/803' && method === 'PUT') { stock = options.body.quantity ?? stock; return { pid: 803 }; }
    if (route === '/api/products/803' && method === 'GET') return { pid: 803, price: 100, quantity: stock };
    if (route === '/api/products' && method === 'GET') return { items: existing ? [{ pid: 803, pname: 'Prompt 3 Demo - 100', price: 100, quantity }] : [] };
    if (route === '/api/products' && method === 'POST') return { pid: 803, ...options.body };
    throw new Error(`Unexpected request ${method} ${route}`);
  };
  return { api, calls, goldMid: 9, admin: { username: 'admin', password: 'local-admin' }, demo: { username: 'demo_gold', password: 'local-demo' } };
}
test('demo uses returned IDs rather than fixed 65/82', async () => {
  const f = fixture();
  assert.deepEqual(await prepareDemo(f), { uid: 701, pid: 803, quantity: 20 });
});
test('repeated preparation reuses product and preserves stock', async () => {
  const f = fixture({ existing: true, quantity: 12 });
  assert.deepEqual(await prepareDemo(f), { uid: 701, pid: 803, quantity: 12 });
  assert.equal(f.calls.filter((c) => c.route.startsWith('/api/products') && c.method !== 'GET').length, 0);
});
test('insufficient demo stock requires an explicit reset', async () => {
  await assert.rejects(prepareDemo(fixture({ existing: true, quantity: 2 })), /--reset-stock/);
});
test('an existing account with different credentials is never overwritten', async () => {
  const f = fixture({ existing: true, loginFailure: true });
  await assert.rejects(prepareDemo(f), /wrong credentials/);
  assert.equal(f.calls.some((c) => c.method === 'PUT'), false);
});

test('configured Gold ID promotes the demo customer and is verified', async () => {
  const f = fixture({ standard: true });
  await prepareDemo(f);
  assert.equal(f.calls.filter((c) => c.method === 'PUT' && c.route === '/api/customers/701').length, 1);
});
test('explicit reset restores only the demo product stock to 20', async () => {
  const f = fixture({ existing: true, quantity: 2 });
  assert.equal((await prepareDemo({ ...f, resetStock: true })).quantity, 20);
  assert.deepEqual(f.calls.find((c) => c.method === 'PUT').body, { price: 100, quantity: 20 });
});
