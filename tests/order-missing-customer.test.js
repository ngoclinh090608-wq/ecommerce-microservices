const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.join(__dirname, '../services/order-service/src');
const { notFound } = require(path.join(base, 'domain/errors'));
let stockCalls = 0, writes = 0;
for (const [name, value] of [
  ['infrastructure/grpcClients', { getMembership: async () => { throw notFound('Customer not found'); }, reserveStock: async () => { stockCalls++; } }],
  ['infrastructure/orderRepository', { createWithOutbox: async () => { writes++; } }],
]) {
  const id = require.resolve(path.join(base, name));
  require.cache[id] = { id, filename: id, loaded: true, exports: value };
}
const { createOrder } = require(path.join(base, 'application/orderService'));
test('unknown Customer cannot change stock or persist an order', async () => {
  await assert.rejects(createOrder({ uid: 123, items: [{ pid: 1, qty: 2 }] }), (e) => e.code === 5);
  assert.equal(stockCalls, 0);
  assert.equal(writes, 0);
});
