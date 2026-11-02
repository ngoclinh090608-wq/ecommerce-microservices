const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('../api-gateway/node_modules/express');
const base = path.join(__dirname, '../api-gateway/src');
const { HttpError } = require(path.join(base, 'lib/errors'));
let shipment = null, createError = null, lookupCalls = 0;
const created = { oid: 81, uid: 701, discount: 10, total_amount: 180, items: [{ pid: 803, qty: 2, unit_price: 100 }], shipment_status: 'PENDING' };
for (const [name, exports] of [
  ['clients/grpcClients', { rpc: async (service, method, request) => {
    assert.equal(service, 'order'); assert.equal(method, 'CreateOrder'); assert.equal(request.uid, 701);
    if (createError) throw createError;
    return created;
  } }],
  ['lib/cache', { del: async () => {} }],
  ['lib/shipment', { waitForShipment: async () => { lookupCalls++; return shipment; } }],
]) {
  const id = require.resolve(path.join(base, name));
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = { uid: 701, role: 'member' }; next(); });
app.use('/api/orders', require(path.join(base, 'routes/orders')));
app.use(require(path.join(base, 'middlewares/errorHandler')));
let server, url;
before(async () => {
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  url = `http://127.0.0.1:${server.address().port}/api/orders`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });
const create = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: 1, items: [{ pid: 803, qty: 2 }] }) });
test('HTTP 201 returns actual shipment ID, discount total and Location', async () => {
  shipment = { shipid: 91, status: 'PENDING' };
  const response = await create();
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('location'), '/api/orders/81');
  const body = await response.json();
  assert.equal(body.uid, 701); assert.equal(body.total_amount, 180);
  assert.deepEqual(body.shipment, shipment);
});
test('committed order still returns 201 when async shipment is pending', async () => {
  shipment = null;
  const response = await create();
  assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).shipment, { shipid: null, status: 'PENDING' });
});
test('missing Customer returns HTTP 404 and never looks up a shipment', async () => {
  createError = new HttpError(404, 'Customer not found');
  const beforeCalls = lookupCalls;
  const response = await create();
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, 'Customer not found');
  assert.equal(lookupCalls, beforeCalls);
});
