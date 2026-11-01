const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const dir = path.join(__dirname, '..', '..', 'shared', 'proto');
const opts = { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true };
let failed = false;

for (const name of ['auth', 'customer', 'product', 'order', 'shipment']) {
  try {
    const def = protoLoader.loadSync(path.join(dir, `${name}.proto`), opts);
    grpc.loadPackageDefinition(def);
    const services = Object.entries(def).filter(([, v]) => !v.format);
    for (const [svc, methods] of services) {
      console.log(`OK  ${name}.proto -> ${svc}: ${Object.keys(methods).join(', ')}`);
    }
  } catch (e) {
    failed = true;
    console.error(`FAIL ${name}.proto -> ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);