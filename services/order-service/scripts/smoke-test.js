const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
require('dotenv').config();
const prisma = require('../src/infrastructure/prisma');

const protoDir = path.join(__dirname, '..', '..', '..', 'shared', 'proto');
const opts = { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true };
function makeClient(file, pkg, svc, addr) {
  const def = protoLoader.loadSync(path.join(protoDir, file), opts);
  const p = grpc.loadPackageDefinition(def).ecommerce[pkg];
  return new p[svc](addr, grpc.credentials.createInsecure());
}
const order = makeClient('order.proto', 'order', 'OrderService', 'localhost:50054');
const customer = makeClient('customer.proto', 'customer', 'CustomerService', 'localhost:50052');
const product = makeClient('product.proto', 'product', 'ProductService', 'localhost:50053');
const call = (c, m, req) => new Promise((r) => c[m](req, (err, res) => r({ err, res })));
const code = (r) => r.err && r.err.code;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
  if (!cond) failed++;
}

(async () => {
  const base = 900000 + Math.floor(Math.random() * 90000);
  const [U1, U2, U3, U4, U5, U6] = [0, 1, 2, 3, 4, 5].map((i) => base + i);
  const admin = { requester_uid: 1, requester_role: 'admin' };
  const member = (u) => ({ requester_uid: u, requester_role: 'member' });
  const tag = `ord-${Date.now()}`;
  const created = [];

  let r = await call(product, 'CreateProduct', { pname: `${tag}-laptop`, price: 1500, quantity: 10 });
  const P1 = r.res.pid;
  r = await call(product, 'CreateProduct', { pname: `${tag}-mouse`, price: 25, quantity: 100 });
  const P2 = r.res.pid;
  created.push(P1, P2);
  const stock = async (pid) => (await call(product, 'GetProduct', { pid })).res.quantity;

  // Khách theo hạng: U1 Standard, U2 Silver, U3 Gold, U4 Platinum
  for (const [u, mid] of [[U1, 1], [U2, 2], [U3, 3], [U4, 4]]) {
    await call(customer, 'CreateCustomer', { uid: u, fullname: `Order Test ${u}` });
    if (mid !== 1) await call(customer, 'UpdateCustomer', { uid: u, mid, ...admin });
  }

  // TC-ORD-01
  r = await call(order, 'CreateOrder', { uid: U1, items: [{ pid: P1, qty: 2 }, { pid: P2, qty: 1 }] });
  check('TC-ORD-01 create order', !r.err && r.res.oid > 0 && r.res.uid === U1 && r.res.items.length === 2,
    r.err ? r.err.message : `oid=${r.res.oid}`);
  const o1 = r.res;
  check('unit_price comes from Product Service',
    o1.items.find((i) => i.pid === P1).unit_price === 1500 && o1.items.find((i) => i.pid === P2).unit_price === 25);
  check('Standard tier: discount 0, total 3025', o1.discount === 0 && o1.total_amount === 3025);
  check('shipment_status PENDING', o1.shipment_status === 'PENDING');
  check('stock reduced (P1 8, P2 99)', (await stock(P1)) === 8 && (await stock(P2)) === 99);

  // TC-ORD-04
  for (const [u, pct, total] of [[U2, 5, 95], [U3, 10, 90], [U4, 15, 85]]) {
    r = await call(order, 'CreateOrder', { uid: u, items: [{ pid: P2, qty: 4 }] });
    check(`TC-ORD-04 discount ${pct}% -> total ${total}`,
      !r.err && r.res.discount === pct && r.res.total_amount === total,
      r.err ? r.err.message : `discount=${r.res.discount} total=${r.res.total_amount}`);
  }

  // TC-ORD-03
  const p1Before = await stock(P1);
  r = await call(order, 'CreateOrder', { uid: U1, items: [{ pid: P1, qty: 999 }] });
  check('TC-ORD-03 insufficient stock -> FAILED_PRECONDITION', code(r) === grpc.status.FAILED_PRECONDITION);
  check('stock unchanged after rejected order', (await stock(P1)) === p1Before);
  r = await call(order, 'ListOrders', member(U1));
  check('no order saved for the rejected request', !r.err && r.res.items.length === 1);

  const p2Before = await stock(P2);
  r = await call(order, 'CreateOrder', { uid: U1, items: [{ pid: P2, qty: 1 }, { pid: P1, qty: 9999 }] });
  check('multi-line order with one short line -> FAILED_PRECONDITION', code(r) === grpc.status.FAILED_PRECONDITION);
  check('first line stock restored', (await stock(P2)) === p2Before);

  r = await call(order, 'CreateOrder', { uid: U1, items: [{ pid: 99999999, qty: 1 }] });
  check('unknown product -> NOT_FOUND', code(r) === grpc.status.NOT_FOUND);

  r = await call(order, 'CreateOrder', { uid: U1, items: [] });
  check('empty items -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);
  r = await call(order, 'CreateOrder', { uid: U1, items: [{ pid: P2, qty: 0 }] });
  check('qty 0 -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);
  r = await call(order, 'CreateOrder', { uid: 0, items: [{ pid: P2, qty: 1 }] });
  check('missing uid -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);

  r = await call(order, 'CreateOrder', { uid: U1, items: [{ pid: P2, qty: 1 }, { pid: P2, qty: 2 }] });
  check('duplicate pid lines merged', !r.err && r.res.items.length === 1 && r.res.items[0].qty === 3);

  r = await call(order, 'CreateOrder', { uid: U5, items: [{ pid: P2, qty: 1 }] });
  check('customer without profile: order accepted, discount 0', !r.err && r.res.discount === 0);

  // Đọc đơn
  r = await call(order, 'GetOrder', { oid: o1.oid, ...member(U1) });
  check('owner reads own order', !r.err && r.res.oid === o1.oid && r.res.items.length === 2 && r.res.total_amount === 3025);
  r = await call(order, 'GetOrder', { oid: o1.oid, ...member(U6) });
  check('other member -> PERMISSION_DENIED', code(r) === grpc.status.PERMISSION_DENIED);
  r = await call(order, 'GetOrder', { oid: o1.oid, ...admin });
  check('admin reads any order', !r.err && r.res.uid === U1);
  r = await call(order, 'GetOrder', { oid: 99999999, ...admin });
  check('unknown order -> NOT_FOUND', code(r) === grpc.status.NOT_FOUND);

  r = await call(order, 'ListOrders', member(U1));
  check('member lists only own orders', !r.err && r.res.items.length >= 1 && r.res.items.every((o) => o.uid === U1));
  r = await call(order, 'ListOrders', admin);
  check('admin lists orders of several users', !r.err && new Set(r.res.items.map((o) => o.uid)).size >= 3);

  // TC-ORD-05: Outbox
  let ev = null;
  for (let i = 0; i < 15; i++) {
    ev = await prisma.outboxEvent.findFirst({ where: { topic: 'order-created', eventKey: String(o1.oid) } });
    if (ev && ev.publishedAt) break;
    await sleep(1000);
  }
  check('TC-ORD-05 outbox event recorded with the order', !!ev && ev.payload.oid === o1.oid && ev.payload.uid === U1);
  check('outbox event published to Kafka (publishedAt set)', !!ev && !!ev.publishedAt);

  for (const pid of created) await call(product, 'DeleteProduct', { pid });
  await prisma.$disconnect();
  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();