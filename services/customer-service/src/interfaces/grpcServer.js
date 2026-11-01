const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const config = require('../config');
const svc = require('../application/customerService');
const { AppError } = require('../domain/errors');

const def = protoLoader.loadSync(path.join(config.protoDir, 'customer.proto'), {
  keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true,
});
const proto = grpc.loadPackageDefinition(def).ecommerce.customer;

function wrap(fn) {
  return async (call, callback) => {
    try {
      callback(null, await fn(call.request));
    } catch (e) {
      if (e instanceof AppError) return callback({ code: e.code, message: e.message });
      console.error('[customer] unexpected error:', e);
      callback({ code: grpc.status.INTERNAL, message: 'Internal error' });
    }
  };
}

function start() {
  const server = new grpc.Server();
  server.addService(proto.CustomerService.service, {
    CreateCustomer: wrap(svc.createCustomer),
    GetCustomer: wrap(svc.getCustomer),
    UpdateCustomer: wrap(svc.updateCustomer),
    GetMembership: wrap(svc.getMembership),
  });
  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${config.grpcPort}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      console.log(`[customer] gRPC server listening on :${config.grpcPort}`);
      resolve(server);
    });
  });
}

module.exports = { start };