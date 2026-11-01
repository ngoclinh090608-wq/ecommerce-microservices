const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');

const BASE = process.env.GATEWAY_URL || `http://localhost:${process.env.PORT || 3000}`;
const ADMIN = { username: 'admin', password: 'Admin@12345' };
const STAFF = { username: 'staff', password: 'Staff@12345' };

const rc = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
rc.on('error', () => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) { payload = raw; headers['Content-Type'] = 'application/json'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  const res = await fetch(BASE + p, { method, headers, body: payload });
  let json = null;
  try { json = await res.json(); } catch { /* không phải JSON */ }
  return { status: res.status, json, headers: res.headers };
}

async function flushLimits() {
  const keys = await rc.sendCommand(['KEYS', 'rl:*']);
  if (keys.length) await rc.sendCommand(['DEL', ...keys]);
}

async function waitFor(fn, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(1000);
  }
  return null;
}

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
  if (!cond) failed++;
}
const is = (r, status) => r.status === status;

(async () => {
  await rc.connect();
  await flushLimits();
  const stamp = Date.now();
  const m1 = { username: `gw1_${stamp}`, password: 'Passw0rd123' };
  const m2 = { username: `gw2_${stamp}`, password: 'Passw0rd123' };
  const created = [];
  let r;

  r = await api('GET', '/api/health');
  check('API-HEALTH-01 health is UP', is(r, 200) && r.json.status === 'UP' && r.json.message === 'E-commerce API is running');

  // ---------- Auth, phần A (8 yêu cầu tới /api/auth)
  r = await api('POST', '/api/auth/register', { body: m1 });
  check('TC-IAM-01 register with username + password -> 201', is(r, 201) && r.json.uid > 0, JSON.stringify(r.json));
  const uid1 = r.json && r.json.uid;
  r = await api('POST', '/api/auth/register', { body: m1 });
  check('duplicate username -> 409', is(r, 409));
  r = await api('POST', '/api/auth/register', { body: { username: `gwx_${stamp}`, password: '' } });
  check('TC-IAM-03 empty password -> 400', is(r, 400));
  r = await api('POST', '/api/auth/register', { body: { username: `gwy_${stamp}` } });
  check('missing password -> 400', is(r, 400));
  r = await api('POST', '/api/auth/register', { raw: '{not json' });
  check('malformed JSON -> 400 with error body', is(r, 400) && r.json && r.json.status === 400);
  r = await api('POST', '/api/auth/login', { body: m1 });
  check('login ok with camelCase fields', is(r, 200) && !!r.json.accessToken && r.json.tokenType === 'Bearer' && r.json.expiresIn > 0);
  const t1 = r.json && r.json.accessToken;
  r = await api('POST', '/api/auth/login', { body: { username: m1.username, password: 'wrong-pass1' } });
  check('wrong password -> 401', is(r, 401));
  r = await api('POST', '/api/auth/login', { body: { username: m1.username } });
  check('login without password -> 400', is(r, 400));
  await flushLimits();

  // ---------- Auth, phần B
  r = await api('POST', '/api/auth/register', { body: m2 });
  const uid2 = r.json && r.json.uid;
  r = await api('POST', '/api/auth/login', { body: m2 });
  const t2 = r.json && r.json.accessToken;
  r = await api('POST', '/api/auth/login', { body: ADMIN });
  check('admin login', is(r, 200));
  const ta = r.json && r.json.accessToken;
  r = await api('POST', '/api/auth/login', { body: STAFF });
  check('shipment_staff login (seeded account)', is(r, 200));
  const ts = r.json && r.json.accessToken;

  // ---------- Xác thực JWT
  r = await api('GET', '/api/products');
  check('no token -> 401', is(r, 401));
  r = await api('GET', '/api/products', { token: 'garbage' });
  check('garbage token -> 401', is(r, 401));
  r = await api('GET', '/api/products', { token: t1.slice(0, -4) + 'AAAA' });
  check('tampered signature -> 401', is(r, 401));
  const secret = process.env.JWT_SECRET;
  r = await api('GET', '/api/products', { token: jwt.sign({ sub: String(uid1), role: 'member' }, secret, { expiresIn: -60 }) });
  check('expired token -> 401', is(r, 401));
  r = await api('GET', '/api/products', { token: jwt.sign({ sub: '1', role: 'admin' }, 'some-other-secret') });
  check('forged admin token (wrong secret) -> 401', is(r, 401));
  r = await api('GET', '/api/products', { token: jwt.sign({ sub: '1', role: 'admin' }, '', { algorithm: 'none' }) });
  check('unsigned token (alg none) -> 401', is(r, 401));

  // ---------- Sản phẩm
  r = await api('POST', '/api/products', { token: t1, body: { pname: 'x', price: 1, quantity: 1 } });
  check('member cannot create product -> 403', is(r, 403));
  r = await api('POST', '/api/products', { token: ta, body: { pname: `gw-${stamp}`, price: 1500, quantity: 10 } });
  check('admin creates product -> 201', is(r, 201) && r.json.pid > 0 && r.json.quantity === 10);
  const P = r.json && r.json.pid;
  created.push(P);
  r = await api('POST', '/api/products', { token: ta, body: { pname: 'bad', price: '12', quantity: 1 } });
  check('price as string -> 400', is(r, 400));
  r = await api('POST', '/api/products', { token: ta, body: { pname: 'bad', price: 5, quantity: 1.5 } });
  check('fractional quantity -> 400 (decision 10)', is(r, 400));
  r = await api('POST', '/api/products', { token: ta, body: { pname: 'bad', price: 5, quantity: -1 } });
  check('negative quantity -> 400', is(r, 400));

  r = await api('GET', '/api/products', { token: t1 });
  check('member lists products', is(r, 200) && Array.isArray(r.json.items) && r.json.items.some((p) => p.pid === P));
  r = await api('GET', '/api/products', { token: t1 });
  check('second list call is served from Redis (X-Cache: HIT)', is(r, 200) && r.headers.get('x-cache') === 'HIT');
  r = await api('GET', `/api/products/${P}`, { token: t1 });
  check('get product by id', is(r, 200) && r.json.pname === `gw-${stamp}`);
  r = await api('GET', '/api/products/abc', { token: t1 });
  check('non-numeric pid -> 400', is(r, 400));
  r = await api('GET', '/api/products/99999999', { token: t1 });
  check('order for unknown product -> 404', is(r, 404));

  r = await api('PUT', `/api/products/${P}`, { token: ta, body: { price: 1600 } });
  check('partial update (price only) -> 200', is(r, 200) && r.json.pid === P);
  r = await api('GET', `/api/products/${P}`, { token: t1 });
  check('cache invalidated, new price visible, quantity untouched', is(r, 200) && r.json.price === 1600 && r.json.quantity === 10);
  
  r = await api('PUT', `/api/products/${P}`, { token: ta, body: { quantity: 15 } });
  check('TC-PRO-05 update stock only -> 200', is(r, 200));
  r = await api('GET', `/api/products/${P}`, { token: t1 });
  check('stock updated, price untouched', is(r, 200) && r.json.quantity === 15 && r.json.price === 1600);

  r = await api('PUT', `/api/products/${P}`, { token: ta, body: {} });
  check('empty update -> 400', is(r, 400));
  r = await api('PUT', `/api/products/${P}`, { token: t1, body: { price: 1 } });
  check('member cannot update product -> 403', is(r, 403));
  r = await api('PUT', '/api/products/99999999', { token: ta, body: { price: 1 } });
  check('update unknown product -> 404', is(r, 404));
  r = await api('DELETE', `/api/products/${P}`, { token: t1 });
  check('member cannot delete product -> 403', is(r, 403));

  // ---------- Khách hàng
  const cust = await waitFor(async () => {
    const g = await api('GET', `/api/customers/${uid1}`, { token: t1 });
    return g.status === 200 ? g.json : null;
  });
  check('TC-CUS-01 member reads own customer (created from user-registered event)',
    !!cust && cust.uid === uid1 && cust.fullname === m1.username && cust.mid === 1, JSON.stringify(cust));
  r = await api('GET', `/api/customers/${uid2}`, { token: t1 });
  check("member cannot read another customer -> 403", is(r, 403));
  r = await api('GET', `/api/customers/${uid1}`);
  check('TC-CUS-05 customer without token -> 401', is(r, 401));
  r = await api('GET', '/api/customers/987654321', { token: ta });
  check('TC-CUS-02 unknown customer -> 404', is(r, 404));
  r = await api('PUT', `/api/customers/${uid1}`, { token: t1, body: { fullname: 'Gateway Test' } });
  check('TC-CUS-03 owner updates fullname -> 200', is(r, 200) && r.json.uid === uid1);
  r = await api('GET', `/api/customers/${uid1}`, { token: t1 });
  check('fullname persisted', is(r, 200) && r.json.fullname === 'Gateway Test');
  r = await api('PUT', `/api/customers/${uid1}`, { token: t1, body: { mid: 4 } });
  check('member cannot self-promote -> 403', is(r, 403));
  r = await api('PUT', `/api/customers/${uid1}`, { token: t1, body: { mid: 'x' } });
  check('mid as string -> 400', is(r, 400));
  r = await api('PUT', `/api/customers/${uid1}`, { token: t1, body: {} });
  check('empty customer update -> 400', is(r, 400));
  r = await api('PUT', `/api/customers/${uid1}`, { token: ta, body: { mid: 3 } });
  check('admin sets tier Gold -> 200', is(r, 200));
  r = await api('GET', `/api/customers/${uid1}`, { token: t1 });
  check('TC-CUS-04 membership shows mname and score', is(r, 200) && r.json.mname === 'Gold' && r.json.score === 500);

  // ---------- Đơn hàng
  r = await api('POST', '/api/products', { token: ta, body: { pname: `gw-order-${stamp}`, price: 100, quantity: 5 } });
  const OP = r.json && r.json.pid;
  created.push(OP);
  await api('GET', `/api/products/${OP}`, { token: t1 }); // đưa vào cache

  r = await api('POST', '/api/orders', { body: { items: [{ pid: OP, qty: 1 }] } });
  check('create order without token -> 401', is(r, 401));
  r = await api('POST', '/api/orders', { token: t1, body: { items: [{ pid: OP, qty: 2 }] } });
  check('TC-ORD-01 create order -> 201', is(r, 201) && r.json.oid > 0 && r.json.items[0].unit_price === 100, JSON.stringify(r.json));
  check('TC-ORD-04 Gold tier: discount 10, total 180', r.json && r.json.discount === 10 && r.json.total_amount === 180);
  check('create response carries shipment status PENDING', r.json && r.json.shipment && r.json.shipment.status === 'PENDING');
  const oid = r.json && r.json.oid;

  r = await api('GET', `/api/products/${OP}`, { token: t1 });
  check('order invalidated the cache: stock shows 3', is(r, 200) && r.json.quantity === 3);

  r = await api('POST', '/api/orders', { token: t1, body: { items: [{ pid: OP, qty: 99 }] } });
  check('TC-ORD-03 insufficient stock -> 409', is(r, 409));
  r = await api('POST', '/api/orders', { token: t1, body: { items: [{ pid: OP, qty: 1.5 }] } });
  check('fractional qty -> 400', is(r, 400));
  r = await api('POST', '/api/orders', { token: t1, body: { items: [{ pid: 99999999, qty: 1 }] } });
  check('unknown product -> 404', is(r, 404));
  r = await api('POST', '/api/orders', { token: t1, body: { items: [] } });
  check('empty items -> 400', is(r, 400));
  r = await api('POST', '/api/orders', { token: t1, body: { uid: 1, items: [{ pid: OP, qty: 1 }] } });
  check('client-sent uid is ignored (order belongs to the token owner)', is(r, 201) && r.json.uid === uid1);

  r = await api('GET', '/api/orders', { token: t1 });
  check('member lists only own orders', is(r, 200) && r.json.items.length >= 2 && r.json.items.every((o) => o.uid === uid1));
  r = await api('GET', `/api/orders/${oid}`, { token: t1 });
  check('owner reads own order with items', is(r, 200) && r.json.oid === oid && r.json.items.length === 1);
  r = await api('GET', `/api/orders/${oid}`, { token: t2 });
  check('other member -> 403', is(r, 403));
  r = await api('GET', `/api/orders/${oid}`, { token: ta });
  check('admin reads any order', is(r, 200) && r.json.uid === uid1);
  r = await api('GET', '/api/orders/99999999', { token: ta });
  check('unknown order -> 404', is(r, 404));

  // ---------- Giao hàng
  const withShipment = await waitFor(async () => {
    const g = await api('GET', `/api/orders/${oid}`, { token: t1 });
    return g.json && g.json.shipment && g.json.shipment.shipid ? g.json : null;
  });
  check('Order -> Kafka -> Shipment: order detail shows shipid and PENDING',
    !!withShipment && withShipment.shipment.status === 'PENDING', JSON.stringify(withShipment && withShipment.shipment));
  const shipid = withShipment && withShipment.shipment.shipid;

  r = await api('GET', `/api/shipments/${shipid}`, { token: t1 });
  check('owner reads own shipment', is(r, 200) && r.json.oid === oid);
  r = await api('GET', `/api/shipments/${shipid}`, { token: t2 });
  check('other member cannot read the shipment -> 403', is(r, 403));
  r = await api('GET', `/api/shipments/${shipid}`, { token: ts });
  check('shipment_staff reads any shipment', is(r, 200));
  r = await api('GET', '/api/shipments/99999999', { token: t1 });
  check('unknown shipment -> 404', is(r, 404));
  r = await api('PATCH', `/api/shipments/${shipid}/status`, { token: t1, body: { status: 'SHIPPING' } });
  check('member cannot update shipment -> 403', is(r, 403));
  r = await api('PATCH', `/api/shipments/${shipid}/status`, { token: ts, body: { status: 'SHIPPING' } });
  check('TC-SHP-03 staff sets SHIPPING -> 200', is(r, 200) && r.json.status === 'SHIPPING');
  r = await api('PATCH', `/api/shipments/${shipid}/status`, { token: ts, body: { status: 'FLYING' } });
  check('invalid status -> 400', is(r, 400));
  r = await api('PATCH', `/api/shipments/${shipid}/status`, { token: ts, body: {} });
  check('missing status -> 400', is(r, 400));
  r = await api('PATCH', `/api/shipments/${shipid}/status`, { token: ts, body: { status: 'PENDING' } });
  check('going backwards -> 409', is(r, 409));
  r = await api('PATCH', '/api/shipments/99999999/status', { token: ts, body: { status: 'SHIPPING' } });
  check('TC-SHP-04 unknown shipment -> 404', is(r, 404));
  r = await api('PATCH', `/api/shipments/${shipid}/status`, { token: ta, body: { status: 'DELIVERED' } });
  check('admin sets DELIVERED -> 200', is(r, 200));
  r = await api('GET', `/api/orders/${oid}`, { token: t1 });
  check('order detail now shows DELIVERED', is(r, 200) && r.json.shipment.status === 'DELIVERED');

  // ---------- Khác
  r = await api('GET', '/api/does-not-exist');
  check('unknown route -> 404 JSON', is(r, 404) && r.json && r.json.status === 404);

  // ---------- Giới hạn tốc độ
  await flushLimits();
  let limited = null;
  let sent = 0;
  for (let i = 0; i < 14 && !limited; i++) {
    const x = await api('POST', '/api/auth/login', { body: { username: 'nobody', password: 'wrongpass1' } });
    sent++;
    if (x.status === 429) limited = x;
  }
  check('rate limit: login is blocked with 429 after about 10 attempts', !!limited && sent >= 10 && sent <= 12, `after ${sent} attempts`);
  check('429 carries Retry-After and a JSON body', !!limited && !!limited.headers.get('retry-after') && limited.json.status === 429);
  r = await api('GET', '/api/products', { token: t1 });
  check('the login limiter does not block other endpoints', is(r, 200));
  r = await api('GET', '/api/health');
  check('health still reachable', is(r, 200));

  // ---------- Dọn dẹp
  for (const pid of created) await api('DELETE', `/api/products/${pid}`, { token: ta });
  await flushLimits();
  await rc.quit();
  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();