const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const [uid, pid, qty] = process.argv.slice(2).map(Number);
const def = protoLoader.loadSync(
  path.join(__dirname, '..', '..', '..', 'shared', 'proto', 'order.proto'),
  { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true }
);
const proto = grpc.loadPackageDefinition(def).ecommerce.order;
const client = new proto.OrderService('localhost:50054', grpc.credentials.createInsecure());
const started = Date.now();
client.CreateOrder({ uid, items: [{ pid, qty }] }, (err, res) => {
  const ms = Date.now() - started;
  if (err) console.log(`ERROR code=${err.code} message="${err.details}" (${ms} ms)`);
  else console.log(JSON.stringify(res), `(${ms} ms)`);
});