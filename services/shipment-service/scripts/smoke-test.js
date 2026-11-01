const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka, Partitioners } = require('kafkajs');
require('dotenv').config();
const config = require('../src/config');
const db = require('../src/infrastructure/db');
const Shipment = require('../src/infrastructure/shipmentModel');
const InvalidEvent = require('../src/infrastructure/invalidEventModel');

const protoDir = path.join(__dirname, '..', '..', '..', 'shared', 'proto');
const opts = { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true };
function makeClient(file, pkg, svc, addr) {
  const def = protoLoader.loadSync(path.join(protoDir, file), opts);
  const p = grpc.loadPackageDefinition(def).ecommerce[pkg];
  return new p[svc](addr, grpc.credentials.createInsecure());
}
const ship = makeClient('shipment.proto', 'shipment', 'ShipmentService', 'localhost:50055');
const call = (c, m, req) => new Promise((r) => c[m](req, (err, res) => r({ err, res })));
const code = (r) => r.err && r.err.code;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

(async () => {
  await db.connect();
  const kafka = new Kafka({ clientId: 'shipment-smoke', brokers: config.kafkaBrokers });
  const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
  await producer.connect();
  const send = (value) => producer.send({ topic: 'order-created', messages: [{ key: 'smoke', value }] });
  const evt = (oid) => JSON.stringify({ eventId: `smoke-${oid}-${Date.now()}`, oid, uid: 1, occurredAt: new Date().toISOString() });
  const byOrder = (oid) => async () => {
    const r = await call(ship, 'GetShipmentByOrder', { oid });
    return r.err ? null : r.res;
  };

  const base = 900000 + Math.floor(Math.random() * 90000);
  const [O1, O2, O3] = [base, base + 1, base + 2];

  // TC-SHP-01
  await send(evt(O1));
  const s1 = await waitFor(byOrder(O1));
  check('TC-SHP-01 valid event creates a PENDING shipment', !!s1 && s1.status === 'PENDING' && s1.oid === O1 && s1.shipid > 0,
    JSON.stringify(s1));

  // TC-SHP-05
  const dupe = evt(O2);
  await send(dupe);
  await send(dupe);
  await waitFor(async () => (await Shipment.countDocuments({ oid: O2 })) >= 1);
  await sleep(3000);
  check('TC-SHP-05 same event twice -> exactly one shipment', (await Shipment.countDocuments({ oid: O2 })) === 1);

  // TC-SHP-02
  const shipmentsBefore = await Shipment.countDocuments();
  const invalidBefore = await InvalidEvent.countDocuments();
  await send(JSON.stringify({ eventId: 'smoke-missing-oid', uid: 1 }));
  await send('this is not json');
  await send(JSON.stringify({ oid: 1.5 }));
  await waitFor(async () => (await InvalidEvent.countDocuments()) >= invalidBefore + 3);
  await sleep(1000);
  check('TC-SHP-02 3 invalid events recorded', (await InvalidEvent.countDocuments()) === invalidBefore + 3);
  check('invalid events created no shipment', (await Shipment.countDocuments()) === shipmentsBefore);

  // Cập nhật trạng thái
  let r = await call(ship, 'UpdateShipmentStatus', { shipid: s1.shipid, status: 'SHIPPING' });
  check('TC-SHP-03 PENDING -> SHIPPING', !r.err && r.res.status === 'SHIPPING');
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s1.shipid, status: 'SHIPPING' });
  check('repeating the same status is accepted', !r.err && r.res.status === 'SHIPPING');
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s1.shipid, status: 'PENDING' });
  check('going backwards -> FAILED_PRECONDITION', code(r) === grpc.status.FAILED_PRECONDITION);
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s1.shipid, status: 'FLYING' });
  check('unknown status -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s1.shipid, status: 'shipping' });
  check('lowercase status -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);
  r = await call(ship, 'UpdateShipmentStatus', { shipid: 99999999, status: 'SHIPPING' });
  check('TC-SHP-04 unknown shipment -> NOT_FOUND', code(r) === grpc.status.NOT_FOUND);
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s1.shipid, status: 'DELIVERED' });
  check('SHIPPING -> DELIVERED', !r.err && r.res.status === 'DELIVERED');
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s1.shipid, status: 'CANCELLED' });
  check('DELIVERED is final -> FAILED_PRECONDITION', code(r) === grpc.status.FAILED_PRECONDITION);

  await send(evt(O3));
  const s3 = await waitFor(byOrder(O3));
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s3.shipid, status: 'DELIVERED' });
  check('PENDING -> DELIVERED (skipping a step) -> FAILED_PRECONDITION', code(r) === grpc.status.FAILED_PRECONDITION);
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s3.shipid, status: 'CANCELLED' });
  check('PENDING -> CANCELLED', !r.err && r.res.status === 'CANCELLED');
  r = await call(ship, 'UpdateShipmentStatus', { shipid: s3.shipid, status: 'SHIPPING' });
  check('CANCELLED is final -> FAILED_PRECONDITION', code(r) === grpc.status.FAILED_PRECONDITION);

  // Đọc
  r = await call(ship, 'GetShipment', { shipid: s1.shipid });
  check('get shipment by shipid', !r.err && r.res.oid === O1 && r.res.status === 'DELIVERED');
  r = await call(ship, 'GetShipment', { shipid: 99999999 });
  check('get unknown shipid -> NOT_FOUND', code(r) === grpc.status.NOT_FOUND);
  r = await call(ship, 'GetShipmentByOrder', { oid: 99999999 });
  check('get by unknown oid -> NOT_FOUND', code(r) === grpc.status.NOT_FOUND);

  // Đầu-cuối qua Order Service
  if (process.argv.includes('--e2e')) {
    const order = makeClient('order.proto', 'order', 'OrderService', 'localhost:50054');
    const product = makeClient('product.proto', 'product', 'ProductService', 'localhost:50053');
    r = await call(product, 'CreateProduct', { pname: `ship-e2e-${Date.now()}`, price: 10, quantity: 5 });
    const pid = r.res.pid;
    r = await call(order, 'CreateOrder', { uid: base + 10, items: [{ pid, qty: 1 }] });
    check('e2e: order created', !r.err, r.err ? r.err.message : `oid=${r.res.oid}`);
    const oid = r.res && r.res.oid;
    const s = oid ? await waitFor(byOrder(oid)) : null;
    check('e2e: Order -> Outbox -> Kafka -> Shipment (PENDING)', !!s && s.status === 'PENDING', JSON.stringify(s));
    await call(product, 'DeleteProduct', { pid });
  }

  await producer.disconnect();
  await db.disconnect();
  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();