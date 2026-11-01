const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const config = require('../config');
const { AppError, unavailable } = require('../domain/errors');

const opts = { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true };

// Giới hạn thời gian chờ nối lại để service phục hồi nhanh khi phụ thuộc sống lại
const channelOptions = {
  'grpc.initial_reconnect_backoff_ms': 500,
  'grpc.max_reconnect_backoff_ms': 3000,
};

function load(file, pkg, svc, addr) {
  const def = protoLoader.loadSync(path.join(config.protoDir, file), opts);
  const p = grpc.loadPackageDefinition(def).ecommerce[pkg];
  return new p[svc](addr, grpc.credentials.createInsecure(), channelOptions);
}

const customer = load('customer.proto', 'customer', 'CustomerService', config.customerAddr);
const product = load('product.proto', 'product', 'ProductService', config.productAddr);

async function call(client, method, req, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;

  // Chờ kênh sẵn sàng (tối đa timeoutMs) thay vì báo lỗi ngay khi đang nối lại
  try {
    await new Promise((resolve, reject) => {
      client.waitForReady(deadline, (err) => (err ? reject(err) : resolve()));
    });
  } catch {
    throw unavailable('A dependent service is unavailable');
  }

  return new Promise((resolve, reject) => {
    client[method](req, { deadline }, (err, res) => {
      if (!err) return resolve(res);
      if (err.code === grpc.status.UNAVAILABLE || err.code === grpc.status.DEADLINE_EXCEEDED) {
        return reject(unavailable('A dependent service is unavailable'));
      }
      reject(new AppError(err.code, err.details || err.message));
    });
  });
}

module.exports = {
  getMembership: (uid) => call(customer, 'GetMembership', { uid }),
  reserveStock: (items) => call(product, 'ReserveStock', { items }),
  releaseStock: (items) => call(product, 'ReleaseStock', { items }),
};