const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const def = protoLoader.loadSync(
  path.join(__dirname, '..', '..', '..', 'shared', 'proto', 'auth.proto'),
  { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true }
);
const proto = grpc.loadPackageDefinition(def).ecommerce.auth;
const client = new proto.AuthService('localhost:50051', grpc.credentials.createInsecure());

const call = (method, req) =>
  new Promise((resolve) => client[method](req, (err, res) => resolve({ err, res })));

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
  if (!cond) failed++;
}

(async () => {
  const u = `user${Date.now()}`;
  const good = { username: u, password: 'Passw0rd123', email: `${u}@example.com`, phone: '0900000000' };

  let r = await call('Register', good);
  check('register ok', !r.err && r.res.uid > 0, `uid=${r.res && r.res.uid}`);

  r = await call('Register', good);
  check('duplicate -> ALREADY_EXISTS', r.err && r.err.code === grpc.status.ALREADY_EXISTS);

  r = await call('Register', { ...good, username: 'x', email: 'bad' });
  check('invalid data -> INVALID_ARGUMENT', r.err && r.err.code === grpc.status.INVALID_ARGUMENT);

  r = await call('Login', { username: u, password: good.password });
  check('login ok', !r.err && r.res.token_type === 'Bearer');
  const token = r.res && r.res.access_token;

  const payload = token ? jwt.decode(token) : {};
  check('jwt has sub and role=member', !!payload.sub && payload.role === 'member', JSON.stringify(payload));

  r = await call('Login', { username: u, password: 'wrong-password1' });
  check('wrong password -> UNAUTHENTICATED', r.err && r.err.code === grpc.status.UNAUTHENTICATED);

  r = await call('Login', { username: 'nobody-here', password: 'whatever123' });
  check('unknown user -> UNAUTHENTICATED (same code)', r.err && r.err.code === grpc.status.UNAUTHENTICATED);

  r = await call('VerifyToken', { token });
  check('verify valid token', r.res && r.res.valid === true && r.res.role === 'member');

  r = await call('VerifyToken', { token: token + 'x' });
  check('verify tampered token -> valid=false', r.res && r.res.valid === false);

  r = await call('Login', { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD });
  const adminPayload = r.res ? jwt.decode(r.res.access_token) : {};
  check('admin login, role=admin', adminPayload.role === 'admin');

  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();