const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.join(__dirname, '../api-gateway/src');
const { HttpError } = require(path.join(base, 'lib/errors'));
const id = require.resolve(path.join(base, 'clients/grpcClients'));
let lookup;
require.cache[id] = { id, filename: id, loaded: true, exports: { rpc: (...args) => lookup(...args) } };
const { waitForShipment } = require(path.join(base, 'lib/shipment'));
test('shipment created after an initial 404 supplies the real shipid', async () => {
  let calls = 0;
  lookup = async (service, method, request) => {
    assert.equal(service, 'shipment'); assert.equal(method, 'GetShipmentByOrder'); assert.equal(request.oid, 12);
    if (++calls === 1) throw new HttpError(404, 'not ready');
    return { shipid: 42, status: 'PENDING' };
  };
  assert.deepEqual(await waitForShipment(12, { timeoutMs: 200, pollMs: 1 }), { shipid: 42, status: 'PENDING' });
  assert.equal(calls, 2);
});
test('delayed Kafka delivery ends polling without inventing an ID', async () => {
  lookup = async () => { throw new HttpError(404, 'not ready'); };
  assert.equal(await waitForShipment(12, { timeoutMs: 15, pollMs: 1 }), null);
});
test('unavailable Shipment returns a deferred lookup instead of failing the committed order', async () => {
  lookup = async () => { throw new HttpError(503, 'unavailable'); };
  assert.equal(await waitForShipment(12), null);
});
