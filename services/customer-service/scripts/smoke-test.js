const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const protoDir = path.join(__dirname, '..', '..', '..', 'shared', 'proto');
const opts = { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true };

function makeClient(file, pkg, svc, addr) {
  const def = protoLoader.loadSync(path.join(protoDir, file), opts);
  const p = grpc.loadPackageDefinition(def).ecommerce[pkg];
  return new p[svc](addr, grpc.credentials.createInsecure());
}
const cus = makeClient('customer.proto', 'customer', 'CustomerService', 'localhost:50052');
const auth = makeClient('auth.proto', 'auth', 'AuthService', 'localhost:50051');
const call = (m, req) => new Promise((r) => cus[m](req, (err, res) => r({ err, res })));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
  if (!cond) failed++;
}
const code = (r) => r.err && r.err.code;

(async () => {
  const base = 900000 + Math.floor(Math.random() * 90000);
  const A = base, B = base + 1;
  const asA = { requester_uid: A, requester_role: 'member' };
  const asB = { requester_uid: B, requester_role: 'member' };
  const asAdmin = { requester_uid: 1, requester_role: 'admin' };

  let r = await call('GetCustomer', { uid: base + 5000 });
  check('TC-CUS-02 unknown customer -> NOT_FOUND', code(r) === grpc.status.NOT_FOUND);

  r = await call('CreateCustomer', { uid: A, fullname: 'Test A' });
  check('create customer, default tier Standard', !r.err && r.res.mname === 'Standard' && r.res.score === 0);
  r = await call('CreateCustomer', { uid: A, fullname: 'Other Name' });
  check('create twice is idempotent (name unchanged)', !r.err && r.res.fullname === 'Test A');

  r = await call('GetCustomer', { uid: A });
  check('TC-CUS-01 get customer', !r.err && r.res.uid === A && r.res.fullname === 'Test A');

  r = await call('UpdateCustomer', { uid: A, fullname: 'Test A2', ...asA });
  check('TC-CUS-03 owner updates fullname', !r.err);
  r = await call('GetCustomer', { uid: A });
  check('fullname persisted', r.res && r.res.fullname === 'Test A2');

  await call('CreateCustomer', { uid: B, fullname: 'Test B' });
  r = await call('UpdateCustomer', { uid: A, fullname: 'Hacked', ...asB });
  check('other member cannot update -> PERMISSION_DENIED', code(r) === grpc.status.PERMISSION_DENIED);

  r = await call('UpdateCustomer', { uid: A, mid: 4, ...asA });
  check('member cannot self-promote -> PERMISSION_DENIED', code(r) === grpc.status.PERMISSION_DENIED);

  r = await call('UpdateCustomer', { uid: A, mid: 3, ...asAdmin });
  check('admin changes tier to Gold', !r.err);
  r = await call('GetMembership', { uid: A });
  check('TC-CUS-04 membership returns mname and score', r.res && r.res.mname === 'Gold' && r.res.score === 500);

  r = await call('UpdateCustomer', { uid: A, mid: 999, ...asAdmin });
  check('admin with unknown tier -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);

  r = await call('UpdateCustomer', { uid: A, ...asA });
  check('nothing to update -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);

  r = await call('UpdateCustomer', { uid: base + 6000, fullname: 'X', ...asAdmin });
  check('update unknown customer -> NOT_FOUND', code(r) === grpc.status.NOT_FOUND);

  const lazy = base + 7000;
  r = await call('GetMembership', { uid: lazy });
  check('GetMembership creates default profile', !r.err && r.res.mname === 'Standard');

  // Luồng thật: Auth -> Kafka -> Customer (cần Auth Service đang chạy)
  const uname = `e2e${Date.now()}`;

  r = await new Promise((res) =>
    auth.Register({ username: uname, password: 'Passw0rd123' }, (err, resp) => res({ err, res: resp }))
  );
  check('e2e: register via Auth', !r.err && r.res.uid > 0, r.err ? r.err.message : `uid=${r.res.uid}`);
  const newUid = r.res && r.res.uid;
  let found = null;
  for (let i = 0; i < 15 && !found; i++) {
    await sleep(1000);
    const g = await call('GetCustomer', { uid: newUid });
    if (!g.err) found = g.res;
  }
  check('e2e: Customer created from Kafka event', !!found && found.fullname === uname && found.mname === 'Standard',
    found ? JSON.stringify(found) : '(not found within 15s)');

  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();