const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const def = protoLoader.loadSync(
  path.join(__dirname, '..', '..', '..', 'shared', 'proto', 'product.proto'),
  { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true }
);
const proto = grpc.loadPackageDefinition(def).ecommerce.product;
const client = new proto.ProductService('localhost:50053', grpc.credentials.createInsecure());
const call = (m, req) => new Promise((r) => client[m](req, (err, res) => r({ err, res })));

(async () => {
  const list = await call('ListProducts', {});
  if (list.err) { console.error('ListProducts failed:', list.err.message); process.exit(1); }
  if (list.res.items.length > 0) {
    console.log(`Already ${list.res.items.length} product(s), skipping seed.`);
    return;
  }
  for (const p of [
    { pname: 'Laptop', price: 1500, quantity: 10 },
    { pname: 'Mouse', price: 25, quantity: 100 },
    { pname: 'Keyboard', price: 60, quantity: 50 },
  ]) {
    const r = await call('CreateProduct', p);
    console.log(r.err ? `FAIL ${p.pname}: ${r.err.message}` : `created pid=${r.res.pid} ${r.res.pname}`);
  }
})();