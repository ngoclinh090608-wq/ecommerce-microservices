const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const config = require('../config');
const svc = require('../application/productService');
const { AppError } = require('../domain/errors');

const def = protoLoader.loadSync(path.join(config.protoDir, 'product.proto'), {
  keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true,
});
const proto = grpc.loadPackageDefinition(def).ecommerce.product;

function wrap(fn) {
  return async (call, callback) => {
    try {
      callback(null, await fn(call.request));
    } catch (e) {
      if (e instanceof AppError) return callback({ code: e.code, message: e.message });
      console.error('[product] unexpected error:', e);
      callback({ code: grpc.status.INTERNAL, message: 'Internal error' });
    }
  };
}

function start() {
  const server = new grpc.Server();
  server.addService(proto.ProductService.service, {
    ListProducts: wrap(svc.listProducts),
    GetProduct: wrap(svc.getProduct),
    CreateProduct: wrap(svc.createProduct),
    UpdateProduct: wrap(svc.updateProduct),
    DeleteProduct: wrap(svc.deleteProduct),
    ReserveStock: wrap(svc.reserveStock),
    ReleaseStock: wrap(svc.releaseStock),
  });
  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${config.grpcPort}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      console.log(`[product] gRPC server listening on :${config.grpcPort}`);
      resolve(server);
    });
  });
}

module.exports = { start };