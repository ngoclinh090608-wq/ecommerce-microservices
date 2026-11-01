const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const config = require('../config');
const { HttpError, fromGrpc } = require('../lib/errors');

const opts = { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true };
const channelOptions = {
  'grpc.initial_reconnect_backoff_ms': 500,
  'grpc.max_reconnect_backoff_ms': 3000,
};

function make(file, pkg, svc, addr) {
  const def = protoLoader.loadSync(path.join(config.protoDir, file), opts);
  const p = grpc.loadPackageDefinition(def).ecommerce[pkg];
  return new p[svc](addr, grpc.credentials.createInsecure(), channelOptions);
}

const clients = {
  auth: make('auth.proto', 'auth', 'AuthService', config.grpc.auth),
  customer: make('customer.proto', 'customer', 'CustomerService', config.grpc.customer),
  product: make('product.proto', 'product', 'ProductService', config.grpc.product),
  order: make('order.proto', 'order', 'OrderService', config.grpc.order),
  shipment: make('shipment.proto', 'shipment', 'ShipmentService', config.grpc.shipment),
};

function ready(name, timeoutMs) {
  return new Promise((resolve, reject) => {
    clients[name].waitForReady(Date.now() + timeoutMs, (err) => (err ? reject(err) : resolve()));
  });
}

async function rpc(name, method, req, timeoutMs = 5000) {
  try {
    await ready(name, timeoutMs);
  } catch {
    throw new HttpError(503, 'Service temporarily unavailable');
  }
  return new Promise((resolve, reject) => {
    clients[name][method](req, { deadline: Date.now() + timeoutMs }, (err, res) =>
      err ? reject(fromGrpc(err)) : resolve(res)
    );
  });
}

async function isReady(name, timeoutMs = 1000) {
  try {
    await ready(name, timeoutMs);
    return true;
  } catch {
    return false;
  }
}

module.exports = { rpc, isReady, names: Object.keys(clients) };